import { useEffect, useRef } from 'react'
import { getAlerts, markTriggered } from '../utils/alertsStore'
import { sendNotification } from '../utils/alertsNotify'

export function useAlertPoller(currentTicker, currentPrice) {
  const priceRef = useRef(currentPrice)
  priceRef.current = currentPrice

  useEffect(() => {
    const interval = setInterval(() => {
      const alerts = getAlerts().filter(a => !a.triggered)
      if (!alerts.length) return

      for (const alert of alerts) {
        if (alert.type !== 'price') continue
        const price = priceRef.current
        if (price == null) continue
        const target = parseFloat(alert.target)
        const hit = alert.direction === 'above' ? price >= target : price <= target
        if (hit) {
          markTriggered(alert.id)
          sendNotification(
            `${alert.ticker} Price Alert`,
            `${alert.ticker} is now $${price.toFixed(2)} (target: $${target})`,
          )
        }
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])
}
