import { createClient } from '@supabase/supabase-js'
import { MT5Connector } from './mt5-connector'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class CopyTradingService {
  private mt5Connector: MT5Connector
  private isRunning = false
  private adminUserId: string | null = null

  constructor() {
    this.mt5Connector = new MT5Connector()
  }

  async start() {
    if (this.isRunning) {
      console.log('Copy trading service already running')
      return
    }

    console.log('Starting copy trading service...')
    this.isRunning = true

    // Connect to MT5
    await this.mt5Connector.connect()

    // Get admin user
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)
      .single()

    if (!admin) {
      console.error('No admin user found')
      return
    }

    this.adminUserId = admin.id

    // Start monitoring admin trades
    this.monitorAdminTrades()
  }

  async stop() {
    console.log('Stopping copy trading service...')
    this.isRunning = false
    await this.mt5Connector.disconnect()
  }

  private async monitorAdminTrades() {
    // Check for new admin trades every 2 seconds
    setInterval(async () => {
      if (!this.isRunning || !this.adminUserId) return

      try {
        // Get admin's MT5 account
        const { data: adminAccount } = await supabase
          .from('mt5_accounts')
          .select('*, brokers(*)')
          .eq('user_id', this.adminUserId)
          .eq('is_active', true)
          .single()

        if (!adminAccount) return

        // Get open trades from admin's MT5
        const openTrades = await this.mt5Connector.getOpenTrades({
          id: adminAccount.id,
          accountNumber: adminAccount.account_number,
          broker: adminAccount.brokers.name,
          serverAddress: adminAccount.brokers.server_address,
          password: Buffer.from(adminAccount.password_encrypted, 'base64').toString(),
        })

        // Check each trade if it's already been copied
        for (const trade of openTrades) {
          await this.processTrade(adminAccount.id, trade)
        }
      } catch (error) {
        console.error('Error monitoring admin trades:', error)
      }
    }, 2000)
  }

  private async processTrade(adminAccountId: string, trade: any) {
    // Check if this trade has already been copied
    const { data: existingCopy } = await supabase
      .from('copy_trades')
      .select('id')
      .eq('admin_ticket', trade.ticket)
      .single()

    if (existingCopy) {
      // Trade already copied
      return
    }

    // Get all active followers with active subscriptions
    const { data: followers } = await supabase
      .from('profiles')
      .select(`
        id,
        mt5_accounts!inner(*, brokers(*)),
        trading_settings(*),
        subscriptions!inner(*)
      `)
      .eq('is_admin', false)
      .eq('mt5_accounts.is_active', true)
      .in('subscriptions.status', ['active', 'trialing'])

    if (!followers || followers.length === 0) return

    // Copy trade to each follower
    for (const follower of followers) {
      await this.copyTradeToFollower(
        adminAccountId,
        follower as any,
        trade
      )
    }
  }

  private async copyTradeToFollower(
    adminAccountId: string,
    follower: any,
    adminTrade: any
  ) {
    try {
      const followerAccount = follower.mt5_accounts[0]
      const settings = follower.trading_settings[0]

      if (!followerAccount || !settings) {
        console.log(`No account or settings for follower ${follower.id}`)
        return
      }

      // Calculate position size based on settings
      let volume = adminTrade.volume

      if (settings.position_sizing_type === 'percentage') {
        // Get follower's account balance
        const accountInfo = await this.mt5Connector.getAccountInfo({
          id: followerAccount.id,
          accountNumber: followerAccount.account_number,
          broker: followerAccount.brokers.name,
          serverAddress: followerAccount.brokers.server_address,
          password: Buffer.from(followerAccount.password_encrypted, 'base64').toString(),
        })

        if (accountInfo?.balance) {
          // Calculate volume based on percentage risk
          const riskAmount = (accountInfo.balance * settings.position_size_value) / 100
          volume = riskAmount / 10000 // Simplified calculation
        }
      } else {
        // Fixed lot size
        volume = settings.position_size_value
      }

      // Check if follower has reached max open positions
      const { count } = await supabase
        .from('copy_trades')
        .select('*', { count: 'exact', head: true })
        .eq('follower_user_id', follower.id)
        .eq('status', 'opened')

      if (count && count >= settings.max_open_positions) {
        console.log(`Follower ${follower.id} reached max open positions`)
        return
      }

      // Login to follower's MT5 account
      const loginSuccess = await this.mt5Connector.login({
        id: followerAccount.id,
        accountNumber: followerAccount.account_number,
        broker: followerAccount.brokers.name,
        serverAddress: followerAccount.brokers.server_address,
        password: Buffer.from(followerAccount.password_encrypted, 'base64').toString(),
      })

      if (!loginSuccess) {
        throw new Error('Failed to login to follower MT5 account')
      }

      // Open trade on follower's account
      const result = await this.mt5Connector.openTrade(
        {
          id: followerAccount.id,
          accountNumber: followerAccount.account_number,
          broker: followerAccount.brokers.name,
          serverAddress: followerAccount.brokers.server_address,
          password: Buffer.from(followerAccount.password_encrypted, 'base64').toString(),
        },
        adminTrade.symbol,
        adminTrade.orderType,
        volume,
        adminTrade.stopLoss,
        adminTrade.takeProfit
      )

      // Record the copy trade
      await supabase.from('copy_trades').insert({
        admin_user_id: this.adminUserId!,
        follower_user_id: follower.id,
        admin_mt5_account_id: adminAccountId,
        follower_mt5_account_id: followerAccount.id,
        symbol: adminTrade.symbol,
        order_type: adminTrade.orderType,
        volume,
        open_price: adminTrade.openPrice,
        stop_loss: adminTrade.stopLoss,
        take_profit: adminTrade.takeProfit,
        admin_ticket: adminTrade.ticket,
        follower_ticket: result.ticket,
        status: result.success ? 'opened' : 'failed',
        error_message: result.error,
        opened_at: result.success ? new Date().toISOString() : null,
      })

      console.log(
        `Trade copied to follower ${follower.id}: ${result.success ? 'SUCCESS' : 'FAILED'}`
      )
    } catch (error: any) {
      console.error(`Error copying trade to follower ${follower.id}:`, error)

      // Record failed copy
      await supabase.from('copy_trades').insert({
        admin_user_id: this.adminUserId!,
        follower_user_id: follower.id,
        admin_mt5_account_id: adminAccountId,
        follower_mt5_account_id: follower.mt5_accounts[0]?.id,
        symbol: adminTrade.symbol,
        order_type: adminTrade.orderType,
        volume: adminTrade.volume,
        open_price: adminTrade.openPrice,
        stop_loss: adminTrade.stopLoss,
        take_profit: adminTrade.takeProfit,
        admin_ticket: adminTrade.ticket,
        status: 'failed',
        error_message: error.message,
      })
    }
  }

  async closeUserPositions(userId: string) {
    try {
      // Get all open trades for user
      const { data: openTrades } = await supabase
        .from('copy_trades')
        .select('*, mt5_accounts!copy_trades_follower_mt5_account_id_fkey(*, brokers(*))')
        .eq('follower_user_id', userId)
        .eq('status', 'opened')

      if (!openTrades || openTrades.length === 0) return

      for (const trade of openTrades) {
        if (!trade.follower_ticket) continue

        const account = trade.mt5_accounts as any

        // Close the trade
        const result = await this.mt5Connector.closeTrade(
          {
            id: account.id,
            accountNumber: account.account_number,
            broker: account.brokers.name,
            serverAddress: account.brokers.server_address,
            password: Buffer.from(account.password_encrypted, 'base64').toString(),
          },
          trade.follower_ticket
        )

        // Update trade status
        await supabase
          .from('copy_trades')
          .update({
            status: result.success ? 'closed' : 'failed',
            closed_at: result.success ? new Date().toISOString() : null,
            error_message: result.error,
          })
          .eq('id', trade.id)
      }

      console.log(`Closed all positions for user ${userId}`)
    } catch (error) {
      console.error(`Error closing positions for user ${userId}:`, error)
    }
  }
}

// Singleton instance
let copyTradingService: CopyTradingService | null = null

export function getCopyTradingService(): CopyTradingService {
  if (!copyTradingService) {
    copyTradingService = new CopyTradingService()
  }
  return copyTradingService
}

