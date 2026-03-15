import { useState, useEffect } from 'react'
import EarningsCalendar from './EarningsCalendar'
import { cachedFetch } from '../utils/cache'

export default function EarningsDateCard({ ticker }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setData(null)
    cachedFetch(`/api/earnings-calendar/${ticker}`, `earnings-calendar:${ticker}`)
      .then(d => setData(d))
      .catch(() => {})
  }, [ticker])

  const daysUntil = data?.days_until
  const urgency = daysUntil != null && daysUntil <= 7
    ? 'var(--amber)'
    : daysUntil != null && daysUntil <= 30
    ? 'var(--accent)'
    : 'var(--muted)'

  return (
    <>
      <div
        className="stat-card"
        onClick={() => setOpen(true)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title="Click to view earnings calendar"
      >
        <div className="stat-label">NEXT EARNINGS</div>
        {data ? (
          <>
            <div className="stat-value" style={{ fontSize: 15 }}>
              {data.next_date || 'N/A'}
            </div>
            {daysUntil != null && (
              <div className="stat-subvalue" style={{ color: urgency, fontWeight: 600 }}>
                {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil}d`}
              </div>
            )}
          </>
        ) : (
          <div className="stat-value" style={{ color: 'var(--muted)', fontSize: 15 }}>—</div>
        )}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-window"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 720, width: '95vw', maxHeight: '85vh', overflowY: 'auto', padding: 0 }}
          >
            <div className="modal-header" style={{ padding: '12px 20px' }}>
              <div className="modal-meta">
                <span className="modal-publisher">EARNINGS CALENDAR</span>
                {data?.company && (
                  <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>· {data.company}</span>
                )}
              </div>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <EarningsCalendar ticker={ticker} preloadedData={data} />
          </div>
        </div>
      )}
    </>
  )
}
