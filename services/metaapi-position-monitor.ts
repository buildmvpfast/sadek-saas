import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Position = {
  id: string
  symbol: string
  type: string // 'POSITION_TYPE_BUY' or 'POSITION_TYPE_SELL'
  volume: number
  openPrice: number
  stopLoss?: number
  takeProfit?: number
  profit: number
  swap: number
  commission: number
  time: string
}

type AdminAccount = {
  id: string
  user_id: string
  account_number: number
  broker_name: string
  server_name: string
  metaapi_account_id: string
}

export class MetaApiPositionMonitor {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()
  private processedPositions: Set<string> = new Set() // Pour éviter les duplicatas

  /**
   * Démarre le monitoring de tous les comptes admin actifs
   */
  async startMonitoring() {
    console.log('🚀 Démarrage du monitoring des positions admin...')

    // Récupérer tous les comptes admin actifs
    const { data: adminAccounts, error } = await supabase
      .from('mt5_accounts')
      .select('*')
      .eq('is_admin_account', true)
      .eq('is_active', true)

    if (error) {
      console.error('Erreur récupération comptes admin:', error)
      return
    }

    if (!adminAccounts || adminAccounts.length === 0) {
      console.log('⚠️ Aucun compte admin actif trouvé')
      return
    }

    console.log(`✅ ${adminAccounts.length} compte(s) admin trouvé(s)`)

    // Démarrer le monitoring pour chaque compte
    for (const account of adminAccounts) {
      this.monitorAccount(account as AdminAccount)
    }
  }

  /**
   * Monitore un compte admin spécifique
   */
  private async monitorAccount(account: AdminAccount) {
    console.log(`📊 Monitoring du compte admin: ${account.account_number}`)

    if (!account.metaapi_account_id) {
      console.error(`❌ Compte ${account.account_number} n'a pas de MetaApi ID`)
      return
    }

    // Vérifier les positions toutes les 5 secondes
    const interval = setInterval(async () => {
      try {
        await this.checkPositions(account)
      } catch (error) {
        console.error(`Erreur monitoring compte ${account.account_number}:`, error)
      }
    }, 5000) // 5 secondes

    this.monitoringIntervals.set(account.id, interval)
  }

  /**
   * Vérifie les positions ouvertes d'un compte admin
   */
  private async checkPositions(account: AdminAccount) {
    try {
      // Appeler l'API MetaApi pour récupérer les positions
      const response = await fetch(
        `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${account.metaapi_account_id}/positions`,
        {
          headers: {
            'auth-token': process.env.METAAPI_TOKEN!,
          },
        }
      )

      if (!response.ok) {
        console.error(`Erreur API MetaApi: ${response.status}`)
        return
      }

      const positions: Position[] = await response.json()

      // Traiter chaque position
      for (const position of positions) {
        await this.handleNewPosition(account, position)
      }

      // Vérifier les positions fermées
      await this.checkClosedPositions(account, positions)
    } catch (error) {
      console.error('Erreur lors de la vérification des positions:', error)
    }
  }

  /**
   * Traite une nouvelle position détectée
   */
  private async handleNewPosition(account: AdminAccount, position: Position) {
    const positionKey = `${account.metaapi_account_id}-${position.id}`

    // Si déjà traitée, ignorer
    if (this.processedPositions.has(positionKey)) {
      return
    }

    console.log(`🆕 Nouvelle position détectée: ${position.symbol} ${position.type}`)

    // Marquer comme traitée
    this.processedPositions.add(positionKey)

    // Détecter le symbole standard (GOLD, SOL30, BTC)
    const standardSymbol = await this.getStandardSymbol(
      account.broker_name,
      position.symbol
    )

    if (!standardSymbol) {
      console.log(`⚠️ Symbole ${position.symbol} non reconnu, ignoré`)
      return
    }

    console.log(`✅ Symbole mappé: ${position.symbol} → ${standardSymbol}`)

    // Copier cette position sur tous les comptes utilisateurs
    await this.copyPositionToUsers(account, position, standardSymbol)
  }

  /**
   * Copie une position sur tous les comptes utilisateurs actifs
   */
  private async copyPositionToUsers(
    adminAccount: AdminAccount,
    position: Position,
    standardSymbol: string
  ) {
    console.log(`📤 Copie de la position sur les comptes utilisateurs...`)

    // Récupérer tous les utilisateurs avec:
    // 1. Abonnement actif
    // 2. Au moins un compte MT5 actif
    // 3. Trading settings configurés
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        mt5_accounts!inner(
          id,
          account_number,
          broker_name,
          server_name,
          metaapi_account_id,
          is_active
        ),
        subscriptions!inner(
          status
        ),
        trading_settings(
          position_sizing_type,
          gold_lot_size,
          btc_lot_size,
          eth_lot_size,
          sol_lot_size,
          us30_lot_size,
          nas100_lot_size,
          ger40_lot_size,
          uk100_lot_size,
          spx500_lot_size,
          eurusd_lot_size,
          gbpusd_lot_size,
          usdjpy_lot_size,
          usdchf_lot_size,
          usdcad_lot_size,
          audusd_lot_size,
          nzdusd_lot_size,
          eurgbp_lot_size,
          eurjpy_lot_size,
          gbpjpy_lot_size,
          position_percentage,
          max_open_positions
        )
      `)
      .eq('mt5_accounts.is_active', true)
      .in('subscriptions.status', ['active', 'trialing'])

    if (error) {
      console.error('Erreur récupération utilisateurs:', error)
      return
    }

    if (!users || users.length === 0) {
      console.log('⚠️ Aucun utilisateur éligible pour le copy trading')
      return
    }

    console.log(`✅ ${users.length} utilisateur(s) éligible(s)`)

    // Copier sur chaque utilisateur
    for (const user of users) {
      const userMt5Accounts = Array.isArray(user.mt5_accounts)
        ? user.mt5_accounts
        : [user.mt5_accounts]

      for (const userAccount of userMt5Accounts) {
        try {
          await this.copyPositionToUserAccount(
            adminAccount,
            position,
            standardSymbol,
            user,
            userAccount
          )
        } catch (error) {
          console.error(`Erreur copie pour user ${user.id}:`, error)
        }
      }
    }
  }

  /**
   * Copie une position sur un compte utilisateur spécifique
   */
  private async copyPositionToUserAccount(
    adminAccount: AdminAccount,
    position: Position,
    standardSymbol: string,
    user: any,
    userAccount: any
  ) {
    // Double-check subscription is still active before copying
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .single()

    if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) {
      console.log(`⛔ User ${user.id} abonnement inactif (${sub?.status}), copie ignorée`)
      return
    }

    // Also verify account is still active
    if (!userAccount.is_active) {
      console.log(`⛔ Compte ${userAccount.account_number} inactif, copie ignorée`)
      return
    }
    // Mapper le symbole au broker de l'utilisateur
    const userSymbol = await this.getBrokerSymbol(
      userAccount.broker_name,
      standardSymbol
    )

    if (!userSymbol) {
      console.log(`⚠️ Pas de mapping pour ${standardSymbol} sur ${userAccount.broker_name}`)
      return
    }

    // Calculer le volume selon les settings utilisateur
    const settings = user.trading_settings
    let userVolume = 0.01 // Défaut

    if (settings && settings.position_sizing_type === 'lot') {
      const lotMap: Record<string, string> = {
        GOLD: 'gold_lot_size',
        BTC: 'btc_lot_size',
        ETH: 'eth_lot_size',
        SOL30: 'sol_lot_size',
        US30: 'us30_lot_size',
        NAS100: 'nas100_lot_size',
        GER40: 'ger40_lot_size',
        UK100: 'uk100_lot_size',
        SPX500: 'spx500_lot_size',
        EURUSD: 'eurusd_lot_size',
        GBPUSD: 'gbpusd_lot_size',
        USDJPY: 'usdjpy_lot_size',
        USDCHF: 'usdchf_lot_size',
        USDCAD: 'usdcad_lot_size',
        AUDUSD: 'audusd_lot_size',
        NZDUSD: 'nzdusd_lot_size',
        EURGBP: 'eurgbp_lot_size',
        EURJPY: 'eurjpy_lot_size',
        GBPJPY: 'gbpjpy_lot_size',
      }
      const key = lotMap[standardSymbol]
      userVolume = key ? parseFloat(settings[key]) || 0.01 : 0.01
    } else if (settings && settings.position_sizing_type === 'percentage') {
      // Calculer selon le pourcentage
      // TODO: récupérer le capital du compte pour calculer
      userVolume = parseFloat(settings.position_percentage) / 100 || 0.01
    }

    console.log(
      `📊 User ${userAccount.account_number}: ${userSymbol} ${userVolume} lots`
    )

    // Envoyer l'ordre via MetaApi
    const orderResult = await this.sendTradeOrder(
      userAccount.metaapi_account_id,
      {
        symbol: userSymbol,
        actionType: position.type === 'POSITION_TYPE_BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        volume: userVolume,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
      }
    )

    if (orderResult.success) {
      console.log(`✅ Ordre copié pour user ${userAccount.account_number}`)

      // Enregistrer dans copy_trades
      await supabase.from('copy_trades').insert({
        admin_user_id: adminAccount.user_id,
        follower_user_id: user.id,
        admin_mt5_account_id: adminAccount.id,
        follower_mt5_account_id: userAccount.id,
        symbol: userSymbol,
        order_type: position.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
        volume: userVolume,
        open_price: orderResult.openPrice || position.openPrice,
        stop_loss: position.stopLoss,
        take_profit: position.takeProfit,
        admin_ticket: parseInt(position.id),
        follower_ticket: orderResult.positionId ? parseInt(orderResult.positionId) : null,
        status: 'opened',
        opened_at: new Date().toISOString(),
      })
    } else {
      console.error(`❌ Échec ordre pour user ${userAccount.account_number}:`, orderResult.error)

      // Enregistrer l'échec
      await supabase.from('copy_trades').insert({
        admin_user_id: adminAccount.user_id,
        follower_user_id: user.id,
        admin_mt5_account_id: adminAccount.id,
        follower_mt5_account_id: userAccount.id,
        symbol: userSymbol,
        order_type: position.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
        volume: userVolume,
        open_price: position.openPrice,
        admin_ticket: parseInt(position.id),
        status: 'failed',
        error_message: orderResult.error,
      })
    }
  }

  /**
   * Envoie un ordre de trade via MetaApi
   */
  private async sendTradeOrder(
    metaApiAccountId: string,
    order: {
      symbol: string
      actionType: string
      volume: number
      stopLoss?: number
      takeProfit?: number
    }
  ): Promise<{ success: boolean; positionId?: string; openPrice?: number; error?: string }> {
    try {
      const response = await fetch(
        `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${metaApiAccountId}/trade`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'auth-token': process.env.METAAPI_TOKEN!,
          },
          body: JSON.stringify(order),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Trade failed' }
      }

      return {
        success: true,
        positionId: data.positionId || data.orderId,
        openPrice: data.price,
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Vérifie les positions fermées et les copie
   */
  private async checkClosedPositions(account: AdminAccount, openPositions: Position[]) {
    const openPositionIds = new Set(openPositions.map((p) => p.id))

    // Nettoyer les positions traitées qui ne sont plus ouvertes
    const positionKeys = Array.from(this.processedPositions)
    for (const positionKey of positionKeys) {
      if (positionKey.startsWith(`${account.metaapi_account_id}-`)) {
        const positionId = positionKey.split('-')[1]
        if (!openPositionIds.has(positionId)) {
          // Cette position a été fermée
          console.log(`🔴 Position fermée détectée: ${positionId}`)
          await this.closeUserPositions(account, positionId)
          this.processedPositions.delete(positionKey)
        }
      }
    }
  }

  /**
   * Ferme les positions utilisateurs correspondantes
   */
  private async closeUserPositions(adminAccount: AdminAccount, adminPositionId: string) {
    // Récupérer tous les copy_trades correspondants
    const { data: copyTrades } = await supabase
      .from('copy_trades')
      .select('*, mt5_accounts!inner(metaapi_account_id)')
      .eq('admin_ticket', parseInt(adminPositionId))
      .eq('status', 'opened')

    if (!copyTrades || copyTrades.length === 0) {
      return
    }

    console.log(`📤 Fermeture de ${copyTrades.length} position(s) copiée(s)`)

    for (const trade of copyTrades) {
      try {
        // Fermer la position via MetaApi
        if (trade.follower_ticket && trade.mt5_accounts.metaapi_account_id) {
          await this.closePosition(
            trade.mt5_accounts.metaapi_account_id,
            trade.follower_ticket.toString()
          )
        }

        // Mettre à jour le statut
        await supabase
          .from('copy_trades')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
          })
          .eq('id', trade.id)

        console.log(`✅ Position fermée pour trade ${trade.id}`)
      } catch (error) {
        console.error(`Erreur fermeture trade ${trade.id}:`, error)
      }
    }
  }

  /**
   * Ferme une position via MetaApi
   */
  private async closePosition(metaApiAccountId: string, positionId: string) {
    const response = await fetch(
      `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${metaApiAccountId}/positions/${positionId}/close`,
      {
        method: 'POST',
        headers: {
          'auth-token': process.env.METAAPI_TOKEN!,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to close position: ${response.status}`)
    }
  }

  /**
   * Récupère le symbole standard depuis un symbole broker
   */
  private async getStandardSymbol(brokerName: string, brokerSymbol: string): Promise<string | null> {
    const { data } = await supabase
      .from('symbol_mappings')
      .select('standard_symbol')
      .eq('broker_name', brokerName)
      .eq('broker_symbol', brokerSymbol)
      .single()

    if (data) {
      return data.standard_symbol
    }

    // Fallback: deviner selon le nom
    const symbol = brokerSymbol.toUpperCase()
    if (symbol.includes('XAU') || symbol.includes('GOLD')) return 'GOLD'
    if (symbol.includes('SOL')) return 'SOL30'
    if (symbol.includes('BTC') || symbol.includes('BITCOIN')) return 'BTC'

    return null
  }

  /**
   * Récupère le symbole broker depuis un symbole standard
   */
  private async getBrokerSymbol(brokerName: string, standardSymbol: string): Promise<string | null> {
    const { data } = await supabase
      .from('symbol_mappings')
      .select('broker_symbol')
      .eq('broker_name', brokerName)
      .eq('standard_symbol', standardSymbol)
      .single()

    return data?.broker_symbol || null
  }

  /**
   * Arrête le monitoring
   */
  stopMonitoring() {
    console.log('⏸️ Arrêt du monitoring...')
    const intervals = Array.from(this.monitoringIntervals.entries())
    for (const [accountId, interval] of intervals) {
      clearInterval(interval)
      console.log(`✅ Monitoring arrêté pour compte ${accountId}`)
    }
    this.monitoringIntervals.clear()
    this.processedPositions.clear()
  }
}

