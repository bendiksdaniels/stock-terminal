import { useState, useEffect } from 'react'
import { getAlerts, addAlert, removeAlert } from '../utils/alertsStore'
import { requestNotificationPermission } from '../utils/alertsNotify'

export default function AlertsModal({ onClose, currentTicker, currentPrice }) {
  const [alerts, setAlerts]   = useState([])
  const [tab, setTab]         = useState('active')
  const [form, setForm]       = useState({ type: 'price', ticker: currentTicker || '', direction: 'above', target: '' })
  const [permStatus, setPermStatus] = useState(Notification?.permission || 'default')

  useEffect(() => { setAlerts(getAlerts()) }, [])

  const refresh = () => setAlerts(getAlerts())

  const handleAdd = async () => {
    if (!form.ticker || !form.target) return
    await requestNotificationPermission()
    setPermStatus(Notification?.permission || 'default')
    addAlert(form)
    refresh()
    setTab('active')
  }

  const handleRemove = (id) => { removeAlert(id); refresh() }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', width: 480, maxHeight: '70vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--white2)' }}>PRICE ALERTS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Notification permission warning */}
        {permStatus !== 'granted' && (
          <div style={{ padding: '8px 18px', background: 'rgba(251,191,36,0.1)', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
            <span style={{ fontSize: 11, color: '#fbbf24' }}>
              ⚠ Browser notifications {permStatus === 'denied' ? 'blocked — enable in browser settings' : 'not yet enabled'}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {['active','add'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              background: tab === t ? 'var(--bg3)' : 'var(--bg1)',
              color: tab === t ? 'var(--white2)' : 'var(--muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            }}>{t === 'active' ? `ACTIVE (${alerts.filter(a => !a.triggered).length})` : '+ ADD ALERT'}</button>
          ))}
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '14px 18px' }}>
          {tab === 'active' ? (
            alerts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '30px 0' }}>
                No alerts set. Use "+ Add Alert" to create one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map(a => (
                  <div key={a.id} style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${a.triggered ? 'var(--green)' : 'var(--accent)'}`,
                    borderRadius: 'var(--radius)', padding: '10px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)' }}>
                        {a.ticker} {a.direction === 'above' ? '▲' : '▼'} ${a.target}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {a.triggered ? `✓ Triggered ${a.triggeredAt?.slice(0,10)}` : 'Watching...'}
                      </div>
                    </div>
                    <button onClick={() => handleRemove(a.id)} style={{
                      background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
                      borderRadius: 'var(--radius)', padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, letterSpacing: 0.5, fontWeight: 700 }}>TICKER</div>
                <input
                  value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="AAPL"
                  style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--white2)',
                    fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, letterSpacing: 0.5, fontWeight: 700 }}>DIRECTION</div>
                  <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--white2)',
                    fontSize: 12, outline: 'none',
                  }}>
                    <option value="above">Price rises above</option>
                    <option value="below">Price falls below</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, letterSpacing: 0.5, fontWeight: 700 }}>TARGET PRICE ($)</div>
                  <input
                    type="number" step="0.01"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    placeholder={currentPrice ? currentPrice.toFixed(2) : '0.00'}
                    style={{
                      width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--white2)',
                      fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <button onClick={handleAdd} style={{
                background: 'var(--accent)', border: 'none', color: '#000',
                padding: '10px', borderRadius: 'var(--radius)',
                fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: 'pointer',
              }}>+ SET ALERT</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
