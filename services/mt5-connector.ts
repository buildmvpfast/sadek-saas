/**
 * MT5 Connector Service
 * 
 * This service connects to MetaTrader 5 via ZeroMQ
 * You need to install the MT5 ZeroMQ EA on your MT5 terminal
 * 
 * Download: https://github.com/dingmaotu/mql-zmq
 */

import zmq from 'zeromq'

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

export class MT5Connector {
  private socket: any
  private isConnected = false

  constructor(private zmqAddress: string = 'tcp://localhost:5555') {}

  async connect(): Promise<boolean> {
    try {
      this.socket = new zmq.Request()
      await this.socket.connect(this.zmqAddress)
      this.isConnected = true
      console.log('Connected to MT5 via ZeroMQ')
      return true
    } catch (error) {
      console.error('Failed to connect to MT5:', error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.close()
      this.isConnected = false
    }
  }

  async login(account: MT5Account): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Not connected to MT5')
    }

    try {
      const command = {
        action: 'LOGIN',
        account: account.accountNumber,
        password: account.password,
        server: account.serverAddress,
      }

      await this.socket.send(JSON.stringify(command))
      const [response] = await this.socket.receive()
      const result = JSON.parse(response.toString())

      return result.success === true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  async openTrade(
    account: MT5Account,
    symbol: string,
    orderType: 'BUY' | 'SELL',
    volume: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<{ success: boolean; ticket?: number; error?: string }> {
    if (!this.isConnected) {
      throw new Error('Not connected to MT5')
    }

    try {
      const command = {
        action: 'TRADE',
        type: orderType,
        symbol,
        volume,
        sl: stopLoss || 0,
        tp: takeProfit || 0,
        account: account.accountNumber,
      }

      await this.socket.send(JSON.stringify(command))
      const [response] = await this.socket.receive()
      const result = JSON.parse(response.toString())

      if (result.success) {
        return { success: true, ticket: result.ticket }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      console.error('Trade failed:', error)
      return { success: false, error: error.message }
    }
  }

  async closeTrade(
    account: MT5Account,
    ticket: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected) {
      throw new Error('Not connected to MT5')
    }

    try {
      const command = {
        action: 'CLOSE',
        ticket,
        account: account.accountNumber,
      }

      await this.socket.send(JSON.stringify(command))
      const [response] = await this.socket.receive()
      const result = JSON.parse(response.toString())

      return {
        success: result.success,
        error: result.error,
      }
    } catch (error: any) {
      console.error('Close trade failed:', error)
      return { success: false, error: error.message }
    }
  }

  async getOpenTrades(account: MT5Account): Promise<MT5Trade[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to MT5')
    }

    try {
      const command = {
        action: 'GET_OPEN_TRADES',
        account: account.accountNumber,
      }

      await this.socket.send(JSON.stringify(command))
      const [response] = await this.socket.receive()
      const result = JSON.parse(response.toString())

      return result.trades || []
    } catch (error) {
      console.error('Get open trades failed:', error)
      return []
    }
  }

  async getAccountInfo(account: MT5Account): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MT5')
    }

    try {
      const command = {
        action: 'GET_ACCOUNT_INFO',
        account: account.accountNumber,
      }

      await this.socket.send(JSON.stringify(command))
      const [response] = await this.socket.receive()
      const result = JSON.parse(response.toString())

      return result
    } catch (error) {
      console.error('Get account info failed:', error)
      return null
    }
  }
}

