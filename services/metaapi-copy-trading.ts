import { createClient } from '@supabase/supabase-js'
import { MetaApiConnector } from './metaapi-connector'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class MetaApiCopyTradingService {
  private metaApi: MetaApiConnector
  private isRunning = false
  private adminUserId: string | null = null
  private monitoringInterval: any

  constructor() {
    this.metaApi = new MetaApiConnector(process.env.METAAPI_TOKEN!)
  }

  async start() {
    if (this.isRunning) {
      console.log('Copy trading service already running')
      return
    }

    console.log('🚀 Starting MetaApi Copy Trading Service...')
    this.isRunning = true

    // Get admin user
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)
      .single()

    if (!admin) {
      console.error('❌ No admin user found')
      return
    }

    this.adminUserId = admin.id
    console.log(`✅ Admin user: ${this.adminUserId}`)

    // Connect admin account
    await this.connectAdminAccount()

    // Start monitoring
    this.startMonitoring()

    console.log('✅ Copy Trading Service is running')
  }

  async stop() {
    console.log('⏳ Stopping copy trading service...')
    this.isRunning = false

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    await this.metaApi.disconnectAll()
    console.log('✅ Service stopped')
  }

  private async connectAdminAccount() {
    try {
      const { data: adminAccount } = await supabase
        .from('mt5_accounts')
        .select('*')
        .eq('user_id', this.adminUserId!)
        .eq('is_active', true)
        .single()

      if (!adminAccount) {
        console.log('⚠️ No active admin MT5 account found')
        return
      }

      await this.metaApi.connectAccount({
        id: adminAccount.id,
        accountNumber: adminAccount.account_number,
        broker: adminAccount.broker_name || 'Unknown',
        serverAddress: adminAccount.server_name || 'Unknown',
        password: Buffer.from(adminAccount.password_encrypted, 'base64').toString(),
      })

      console.log('✅ Admin account connected')
    } catch (error) {
      console.error('❌ Failed to connect admin account:', error)
    }
  }

  private startMonitoring() {
    // Monitor every 3 seconds
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        await this.checkAdminPositions()
      } catch (error) {
        console.error('❌ Monitoring error:', error)
      }
    }, 3000)
  }

  private async checkAdminPositions() {
    const { data: adminAccount } = await supabase
      .from('mt5_accounts')
      .select('id')
      .eq('user_id', this.adminUserId!)
      .eq('is_active', true)
      .single()

    if (!adminAccount) return

    const positions = await this.metaApi.getOpenPositions(adminAccount.id)

    for (const position of positions) {
      await this.processPosition(adminAccount.id, position)
    }
  }

  private async processPosition(adminAccountId: string, position: any) {
    // Check if already copied
    const { data: existing } = await supabase
      .from('copy_trades')
      .select('id')
      .eq('admin_ticket', position.ticket)
      .single()

    if (existing) return

    console.log(`📊 New position detected: ${position.symbol} ${position.orderType}`)

    // Get active followers
    const { data: followers } = await supabase
      .from('profiles')
      .select(`
        id,
        mt5_accounts!inner(*),
        trading_settings(*)
      `)
      .eq('is_admin', false)
      .eq('mt5_accounts.is_active', true)

    if (!followers || followers.length === 0) {
      console.log('⚠️ No followers to copy to')
      return
    }

    console.log(`👥 Copying to ${followers.length} followers...`)

    for (const follower of followers) {
      await this.copyToFollower(adminAccountId, follower as any, position)
    }
  }

  private async copyToFollower(
    adminAccountId: string,
    follower: any,
    position: any
  ) {
    try {
      const followerAccount = follower.mt5_accounts[0]
      const settings = follower.trading_settings?.[0]

      if (!followerAccount) {
        console.log(`⚠️ No MT5 account for follower ${follower.id}`)
        return
      }

      // Calculate volume
      let volume = position.volume

      if (settings?.position_sizing_type === 'percentage') {
        const accountInfo = await this.metaApi.getAccountInfo(followerAccount.id)
        if (accountInfo?.balance) {
          const riskAmount = (accountInfo.balance * settings.position_size_value) / 100
          volume = Math.max(0.01, Math.round((riskAmount / 1000) * 100) / 100)
        }
      } else if (settings?.position_size_value) {
        volume = settings.position_size_value
      }

      // Check max positions
      if (settings?.max_open_positions) {
        const { count } = await supabase
          .from('copy_trades')
          .select('*', { count: 'exact', head: true })
          .eq('follower_user_id', follower.id)
          .eq('status', 'opened')

        if (count && count >= settings.max_open_positions) {
          console.log(`⚠️ Follower ${follower.id} reached max positions`)
          return
        }
      }

      // Connect follower account if needed
      if (!this.metaApi.getConnection(followerAccount.id)) {
        await this.metaApi.connectAccount({
          id: followerAccount.id,
          accountNumber: followerAccount.account_number,
          broker: followerAccount.broker_name || 'Unknown',
          serverAddress: followerAccount.server_name || 'Unknown',
          password: Buffer.from(followerAccount.password_encrypted, 'base64').toString(),
        })
      }

      // Open trade
      const result = await this.metaApi.openTrade(
        followerAccount.id,
        position.symbol,
        position.orderType,
        volume,
        position.stopLoss,
        position.takeProfit
      )

      // Record in database
      await supabase.from('copy_trades').insert({
        admin_user_id: this.adminUserId!,
        follower_user_id: follower.id,
        admin_mt5_account_id: adminAccountId,
        follower_mt5_account_id: followerAccount.id,
        symbol: position.symbol,
        order_type: position.orderType,
        volume,
        open_price: position.openPrice,
        stop_loss: position.stopLoss,
        take_profit: position.takeProfit,
        admin_ticket: position.ticket,
        follower_ticket: result.ticket ? parseInt(result.ticket) : null,
        status: result.success ? 'opened' : 'failed',
        error_message: result.error,
        opened_at: result.success ? new Date().toISOString() : null,
      })

      console.log(
        `${result.success ? '✅' : '❌'} Copy to ${follower.id}: ${
          result.success ? 'SUCCESS' : result.error
        }`
      )
    } catch (error: any) {
      console.error(`❌ Error copying to follower ${follower.id}:`, error)

      await supabase.from('copy_trades').insert({
        admin_user_id: this.adminUserId!,
        follower_user_id: follower.id,
        admin_mt5_account_id: adminAccountId,
        follower_mt5_account_id: follower.mt5_accounts[0]?.id,
        symbol: position.symbol,
        order_type: position.orderType,
        volume: position.volume,
        open_price: position.openPrice,
        admin_ticket: position.ticket,
        status: 'failed',
        error_message: error.message,
      })
    }
  }

  async closeUserPositions(userId: string) {
    try {
      const { data: openTrades } = await supabase
        .from('copy_trades')
        .select('*, mt5_accounts!copy_trades_follower_mt5_account_id_fkey(*)')
        .eq('follower_user_id', userId)
        .eq('status', 'opened')

      if (!openTrades || openTrades.length === 0) return

      for (const trade of openTrades) {
        if (!trade.follower_ticket) continue

        const account = trade.mt5_accounts as any

        const result = await this.metaApi.closeTrade(
          account.id,
          trade.follower_ticket.toString()
        )

        await supabase
          .from('copy_trades')
          .update({
            status: result.success ? 'closed' : 'failed',
            closed_at: result.success ? new Date().toISOString() : null,
            error_message: result.error,
          })
          .eq('id', trade.id)
      }

      console.log(`✅ Closed all positions for user ${userId}`)
    } catch (error) {
      console.error(`❌ Error closing positions for user ${userId}:`, error)
    }
  }
}

// Singleton instance
let copyTradingService: MetaApiCopyTradingService | null = null

export function getMetaApiCopyTradingService(): MetaApiCopyTradingService {
  if (!copyTradingService) {
    copyTradingService = new MetaApiCopyTradingService()
  }
  return copyTradingService
}

