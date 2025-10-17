// Cache côté client simple
class ClientCache {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  set(key: string, data: any, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    })
  }

  get(key: string) {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.timestamp) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }

  clear() {
    this.cache.clear()
  }

  delete(key: string) {
    this.cache.delete(key)
  }
}

export const clientCache = new ClientCache()
