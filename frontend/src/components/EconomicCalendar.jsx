import { useState, useEffect } from 'react'

const EVENT_COLOR = {
  'FOMC Rate Decision': '#3b82f6',
  'CPI (Inflation)':    '#f59e0b',
  'Non-Farm Payrolls':  '#10b981',
  'GDP (Advance)':      '#a78bfa',
  'PCE Price Index':    '#fb923c',
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toDateString())
  return Math.round(diff / 86400000)
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    fetch('/api/economic-calendar')
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>Loading...</div>

  const eventTypes = ['all', ...new Set(events.map(e => e.event))]
  const filtered = filter === 'all' ? events : events.filter(e => e.event === filter)

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 10 }}>UPCOMING MACRO EVENTS</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        {eventTypes.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700,
            cursor: 'pointer', border: '1px solid var(--border)',
            background: filter === t ? 'var(--accent)' : 'var(--bg3)',
            color: filter === t ? '#000' : 'var(--muted)',
          }}>{t === 'all' ? 'ALL' : t.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {filtered.slice(0, 20).map((e, i) => {
          const days = daysUntil(e.date)
          const color = EVENT_COLOR[e.event] || 'var(--accent)'
          const isToday = days === 0
          const isPast  = days < 0
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: isToday ? `${color}15` : 'var(--bg3)',
              border: `1px solid ${isToday ? color + '60' : 'var(--border)'}`,
              borderLeft: `3px solid ${isPast ? 'var(--border)' : color}`,
              borderRadius: 4, opacity: isPast ? 0.5 : 1,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', minWidth: 80 }}>{e.date}</div>
              <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: isPast ? 'var(--muted)' : 'var(--white2)' }}>{e.event}</div>
              <div style={{
                fontSize: 9, fontWeight: 800, color: isToday ? color : days <= 7 ? '#f59e0b' : 'var(--muted)',
                minWidth: 50, textAlign: 'right',
              }}>
                {isPast ? 'PAST' : isToday ? 'TODAY' : `${days}d`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
