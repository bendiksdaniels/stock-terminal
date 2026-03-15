const KEY = 'st_alerts'

export function getAlerts() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveAlerts(alerts) {
  localStorage.setItem(KEY, JSON.stringify(alerts))
}

export function addAlert(alert) {
  const alerts = getAlerts()
  const id = Date.now().toString()
  alerts.push({ ...alert, id, triggered: false, createdAt: new Date().toISOString() })
  saveAlerts(alerts)
  return id
}

export function removeAlert(id) {
  saveAlerts(getAlerts().filter(a => a.id !== id))
}

export function markTriggered(id) {
  const alerts = getAlerts()
  const idx = alerts.findIndex(a => a.id === id)
  if (idx >= 0) { alerts[idx].triggered = true; alerts[idx].triggeredAt = new Date().toISOString() }
  saveAlerts(alerts)
}
