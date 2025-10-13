/**
 * MetaApi Connector Service
 * Documentation: https://metaapi.cloud/docs/client/
 */

import MetaApi from 'metaapi.cloud-sdk'

export interface MT5Account {
  id: string
  accountNumber: number
  broker: string
  serverAddress: string
  password: string
}

export interface MT5Trade {
  ticket: number
  symbol: string
  orderType: string
  volume: number
  openPrice: number
  stopLoss?: number
  takeProfit?: number
}

export class MetaApiConnector {
  private metaApi: any
  private connections: Map<string, any> = new Map()

  constructor(private apiToken: string) {
    this.metaApi = new MetaApi(apiToken)
  }

  /**
   * Connecte un compte MT5 via MetaApi
   */
  async connectAccount(account: MT5Account): Promise<any> {
    try {
      // Vérifier si le compte existe déjà
      const accounts = await this.metaApi.metatraderAccountApi.getAccounts()
      let metaApiAccount = accounts.find(
        (a: any) => a.login === account.accountNumber.toString()
      )

      // Créer le compte s'il n'existe pas
      if (!metaApiAccount) {
        metaApiAccount = await this.metaApi.metatraderAccountApi.createAccount({
          name: `Account ${account.accountNumber}`,
          type: 'cloud',
          login: account.accountNumber.toString(),
          password: account.password,
          server: account.serverAddress,
          platform: 'mt5',
          magic: 123456,
        })

        await metaApiAccount.deploy()
        await metaApiAccount.waitDeployed()
      }

      // Créer la connexion
      const connection = metaApiAccount.getRPCConnection()
      await connection.connect()
      await connection.waitSynchronized()

      this.connections.set(account.id, {
        account: metaApiAccount,
        connection,
      })

      console.log(`✅ Connected to MT5 account ${account.accountNumber}`)
      return connection
    } catch (error: any) {
      console.error(`❌ Failed to connect account ${account.accountNumber}:`, error)
      throw error
    }
  }

  /**
   * Récupère la connexion d'un compte
   */
  getConnection(accountId: string): any {
    const conn = this.connections.get(accountId)
    return conn?.connection
  }

  /**
   * Ouvre une position
   */
  async openTrade(
    accountId: string,
    symbol: string,
    orderType: 'BUY' | 'SELL',
    volume: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<{ success: boolean; ticket?: number; error?: string }> {
    try {
      const connection = this.getConnection(accountId)
      if (!connection) {
        throw new Error('Account not connected')
      }

      const tradeType = orderType === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL'

      const result = await connection.createMarketBuyOrder(
        symbol,
        volume,
        stopLoss,
        takeProfit
      )

      if (result && result.orderId) {
        return {
          success: true,
          ticket: result.orderId,
        }
      }

      return { success: false, error: 'No order ID returned' }
    } catch (error: any) {
      console.error('Trade failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Ferme une position
   */
  async closeTrade(
    accountId: string,
    positionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = this.getConnection(accountId)
      if (!connection) {
        throw new Error('Account not connected')
      }

      await connection.closePosition(positionId)

      return { success: true }
    } catch (error: any) {
      console.error('Close trade failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Récupère les positions ouvertes
   */
  async getOpenPositions(accountId: string): Promise<MT5Trade[]> {
    try {
      const connection = this.getConnection(accountId)
      if (!connection) {
        throw new Error('Account not connected')
      }

      const positions = await connection.getPositions()

      return positions.map((pos: any) => ({
        ticket: pos.id,
        symbol: pos.symbol,
        orderType: pos.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
        volume: pos.volume,
        openPrice: pos.openPrice,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
      }))
    } catch (error) {
      console.error('Get positions failed:', error)
      return []
    }
  }

  /**
   * Récupère les informations du compte
   */
  async getAccountInfo(accountId: string): Promise<any> {
    try {
      const connection = this.getConnection(accountId)
      if (!connection) {
        throw new Error('Account not connected')
      }

      const accountInfo = await connection.getAccountInformation()

      return {
        success: true,
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        margin: accountInfo.margin,
        freeMargin: accountInfo.freeMargin,
      }
    } catch (error: any) {
      console.error('Get account info failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Déconnecte un compte
   */
  async disconnectAccount(accountId: string): Promise<void> {
    const conn = this.connections.get(accountId)
    if (conn) {
      await conn.connection.close()
      this.connections.delete(accountId)
      console.log(`Disconnected account ${accountId}`)
    }
  }

  /**
   * Déconnecte tous les comptes
   */
  async disconnectAll(): Promise<void> {
    for (const [accountId] of this.connections) {
      await this.disconnectAccount(accountId)
    }
  }
}

