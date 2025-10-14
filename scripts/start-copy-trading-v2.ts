/**
 * Script pour démarrer le service de copy trading
 * 
 * Usage:
 *   npm run copy-trade
 * 
 * Ce script:
 * 1. Monitore les comptes MT5 admin
 * 2. Détecte les nouvelles positions
 * 3. Les copie sur les comptes utilisateurs avec adaptation des lots
 * 4. Gère le mapping des symboles selon les brokers
 */

import { MetaApiPositionMonitor } from '../services/metaapi-position-monitor'
import * as dotenv from 'dotenv'

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🚀 L\'IMPRIMANTE - Copy Trading Service')
  console.log('=====================================\n')

  // Vérifier les variables d'environnement
  if (!process.env.METAAPI_TOKEN) {
    console.error('❌ METAAPI_TOKEN manquant dans .env.local')
    process.exit(1)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Variables Supabase manquantes dans .env.local')
    process.exit(1)
  }

  console.log('✅ Configuration OK\n')

  // Créer et démarrer le monitor
  const monitor = new MetaApiPositionMonitor()
  
  try {
    await monitor.startMonitoring()

    console.log('\n✅ Copy trading service démarré!')
    console.log('📊 Monitoring des positions en cours...')
    console.log('🛑 Appuyez sur Ctrl+C pour arrêter\n')

    // Garder le script en cours d'exécution
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Arrêt du service...')
      monitor.stopMonitoring()
      console.log('✅ Service arrêté proprement')
      process.exit(0)
    })

    // Empêcher le script de se terminer
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Erreur:', error)
    monitor.stopMonitoring()
    process.exit(1)
  }
}

main()

