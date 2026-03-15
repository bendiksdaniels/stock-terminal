const TTL = 60 * 60 * 1000 // 1 hour in ms

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem('st_cache:' + key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL) return null
    return data
  } catch {
    return null
  }
}

export function cacheSet(key, data) {
  try {
    localStorage.setItem('st_cache:' + key, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // storage full — ignore
  }
}

export async function cachedFetch(url, key) {
  const online = navigator.onLine
  const cached = cacheGet(key)

  // If offline, return cached data immediately (even if stale)
  if (!online) {
    if (cached) return cached
    throw new Error('No internet connection and no cached data available')
  }

  // Online: try to fetch fresh data
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cacheSet(key, data)
    return data
  } catch (err) {
    // Network error but we have cache — use it
    if (cached) return cached
    throw err
  }
}
