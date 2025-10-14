import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { MetaApiPositionMonitor } from './services/MetaApiPositionMonitor'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors())
app.use(express.json())

// Service instance
let monitor: MetaApiPositionMonitor | null = null

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'L\'IMPRIMANTE Copy Trading Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    monitoring: monitor !== null,
  })
})

// Start monitoring
app.post('/api/start', async (req: Request, res: Response) => {
  try {
    if (monitor) {
      return res.json({
        success: true,
        message: 'Service already running',
      })
    }

    console.log('🚀 Starting copy trading service...')
    monitor = new MetaApiPositionMonitor()
    await monitor.startMonitoring()

    res.json({
      success: true,
      message: 'Copy trading service started successfully',
    })
  } catch (error: any) {
    console.error('❌ Error starting service:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Stop monitoring
app.post('/api/stop', async (req: Request, res: Response) => {
  try {
    if (!monitor) {
      return res.json({
        success: true,
        message: 'Service not running',
      })
    }

    console.log('⏸️ Stopping copy trading service...')
    await monitor.stopMonitoring()
    monitor = null

    res.json({
      success: true,
      message: 'Copy trading service stopped',
    })
  } catch (error: any) {
    console.error('❌ Error stopping service:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get status
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    running: monitor !== null,
    uptime: process.uptime(),
  })
})

// Start server
app.listen(PORT, () => {
  console.log('🚀 L\'IMPRIMANTE Copy Trading Backend')
  console.log('=====================================')
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🎛️ API: http://localhost:${PORT}/api`)
  console.log('')

  // Auto-start monitoring in production
  if (process.env.NODE_ENV === 'production' && process.env.AUTO_START === 'true') {
    console.log('🔄 Auto-starting monitoring...')
    setTimeout(async () => {
      try {
        monitor = new MetaApiPositionMonitor()
        await monitor.startMonitoring()
        console.log('✅ Auto-start completed')
      } catch (error) {
        console.error('❌ Auto-start failed:', error)
      }
    }, 2000)
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM received, shutting down gracefully...')
  if (monitor) {
    await monitor.stopMonitoring()
  }
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('\n📛 SIGINT received, shutting down gracefully...')
  if (monitor) {
    await monitor.stopMonitoring()
  }
  process.exit(0)
})

