#!/usr/bin/env node

/**
 * Script to start the copy trading service with MetaApi
 * Run this script separately: npm run copy-trading
 */

import { getMetaApiCopyTradingService } from '../services/metaapi-copy-trading'

async function main() {
  console.log('🚀 Starting MetaApi Copy Trading Service...')
  
  const service = getMetaApiCopyTradingService()
  await service.start()

  console.log('✅ Copy Trading Service is running')
  console.log('Press Ctrl+C to stop')

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏳ Stopping copy trading service...')
    await service.stop()
    console.log('✅ Service stopped')
    process.exit(0)
  })
}

main().catch((error) => {
  console.error('❌ Error starting service:', error)
  process.exit(1)
})

