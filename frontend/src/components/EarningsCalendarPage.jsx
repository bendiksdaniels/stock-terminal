import { useState, useEffect } from 'react'
import { cachedFetch } from '../utils/cache'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI']

function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10)
}

function fmtLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isToday(date) {
  return fmtDate(date) === fmtDate(new Date())
}

export default function EarningsCalendarPage({ onSearchStock }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)  // 0 = current week

  const baseMonday = getMondayOf(new Date())

  useEffect(() => {
    setLoading(true)
    cachedFetch('/api/earnings-week?weeks=8', 'earnings-week:8')
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const weekStart = addDays(baseMonday, weekOffset * 7)

  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

  const grouped = data?.grouped || {}

  const totalThisWeek = weekDays.reduce((n, d) => n + (grouped[fmtDate(d)]?.length || 0), 0)

  return (
    <div className="portfolio-page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      {/* Page header */}
      <div style={{
        padding: '24px 32px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>
              EARNINGS CALENDAR
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Upcoming earnings from major S&P 500 companies · click any ticker to view
            </div>
          </div>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setWeekOffset(w => w - 1)}
              disabled={weekOffset <= -1}
              style={{ padding: '6px 14px' }}
            >← Prev</button>
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white2)' }}>
                {fmtLabel(weekStart)} – {fmtLabel(addDays(weekStart, 4))}
              </div>
              {weekOffset === 0 && (
                <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 0.5, fontWeight: 700, marginTop: 2 }}>
                  THIS WEEK
                </div>
              )}
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
                >
                  Back to Today
                </button>
              )}
            </div>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 7}
              style={{ padding: '6px 14px' }}
            >Next →</button>
          </div>
        </div>

        {/* Week summary */}
        {!loading && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '3px 12px', fontSize: 11, color: 'var(--muted)', fontWeight: 600
            }}>
              {totalThisWeek} earnings this week
            </span>
            {weekDays.map(d => {
              const count = grouped[fmtDate(d)]?.length || 0
              if (!count) return null
              return (
                <span key={fmtDate(d)} style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '3px 12px', fontSize: 11,
                  color: isToday(d) ? 'var(--accent)' : 'var(--white2)', fontWeight: 600
                }}>
                  {DAY_SHORT[weekDays.indexOf(d)]}: {count}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, padding: '20px 32px', overflowY: 'auto' }}>
        {loading ? (
          <div className="panel-loading" style={{ marginTop: 60 }}>
            <div className="loading-spinner-sm" />
            <span>Fetching earnings dates for S&amp;P 500 companies...</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            minHeight: 400,
          }}>
            {weekDays.map((day, di) => {
              const key    = fmtDate(day)
              const items  = grouped[key] || []
              const today  = isToday(day)
              const past   = day < new Date() && !today

              return (
                <div key={key} style={{
                  background: 'var(--bg2)',
                  border: `1px solid ${today ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}>
                  {/* Day header */}
                  <div style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    background: today ? 'var(--bg3)' : 'transparent',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, letterSpacing: 0.8,
                      color: today ? 'var(--accent)' : past ? 'var(--muted)' : 'var(--white2)',
                    }}>{DAY_SHORT[di]}</span>
                    <span style={{
                      fontSize: 11,
                      color: today ? 'var(--accent)' : 'var(--muted)',
                    }}>{fmtLabel(day)}</span>
                    {today && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                        color: 'var(--accent)', border: '1px solid var(--accent)',
                        borderRadius: 10, padding: '1px 6px',
                      }}>TODAY</span>
                    )}
                    {items.length > 0 && !today && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
                        {items.length}
                      </span>
                    )}
                  </div>

                  {/* Ticker cards */}
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.length === 0 ? (
                      <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--border)', fontSize: 11 }}>
                        —
                      </div>
                    ) : (
                      items.map(item => (
                        <button
                          key={item.ticker}
                          type="button"
                          onClick={() => onSearchStock(item.ticker)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'var(--bg3)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
                            textAlign: 'left', width: '100%', transition: 'border-color 0.15s',
                            opacity: past ? 0.6 : 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{
                              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                              color: 'var(--accent-soft)',
                            }}>{item.ticker}</div>
                            <div style={{
                              fontSize: 10, color: 'var(--muted)', marginTop: 1,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              maxWidth: 120,
                            }}>{item.company}</div>
                          </div>
                          {item.eps_estimate != null && (
                            <div style={{
                              fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
                              whiteSpace: 'nowrap', marginLeft: 6,
                            }}>
                              e ${item.eps_estimate.toFixed(2)}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
