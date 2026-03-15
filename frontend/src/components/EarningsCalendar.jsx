import { useState, useEffect } from 'react'
import { cachedFetch } from '../utils/cache'

export default function EarningsCalendar({ ticker, preloadedData }) {
  const [data, setData] = useState(preloadedData || null)
  const [loading, setLoading] = useState(!preloadedData)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (preloadedData) { setData(preloadedData); setLoading(false); return }
    if (!ticker) return
    setLoading(true)
    setData(null)
    setError(null)
    cachedFetch(`/api/earnings-calendar/${ticker}`, `earnings-calendar:${ticker}`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to fetch earnings data'); setLoading(false) })
  }, [ticker, preloadedData])

  if (loading) return (
    <div className="panel-loading">
      <div className="loading-spinner-sm" />
      <span>Loading earnings data...</span>
    </div>
  )

  if (error) return <div className="panel-error">{error}</div>

  if (!data) return null

  const history = data.history || []
  const upcoming = history.filter(h => h.upcoming)
  const past = history.filter(h => !h.upcoming)

  return (
    <div style={{ padding: '18px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="panel-title">EARNINGS CALENDAR</div>
          <div className="panel-subtitle" style={{ marginTop: 3 }}>{data.company}</div>
        </div>
        {data.beat_streak != null && data.beat_streak > 0 && (
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--green)',
            borderRadius: 'var(--radius)', padding: '8px 14px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
              {data.beat_streak}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 0.5, fontWeight: 600 }}>
              BEAT STREAK
            </div>
          </div>
        )}
      </div>

      {/* Next Earnings + Estimates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {/* Next Date Card */}
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 16px'
        }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>
            NEXT EARNINGS
          </div>
          {data.next_date ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                {data.next_date}
              </div>
              {data.days_until != null && (
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: data.days_until <= 7 ? 'var(--amber)' : data.days_until <= 30 ? 'var(--accent)' : 'var(--muted)'
                }}>
                  {data.days_until === 0 ? 'TODAY' : data.days_until === 1 ? 'TOMORROW' : `in ${data.days_until} days`}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Not scheduled</div>
          )}
        </div>

        {/* EPS Estimate */}
        {data.eps_estimate != null && (
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px'
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>
              EPS ESTIMATE
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              ${Number(data.eps_estimate).toFixed(2)}
            </div>
            {data.eps_low != null && data.eps_high != null && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Range: ${Number(data.eps_low).toFixed(2)} – ${Number(data.eps_high).toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* Revenue Estimate */}
        {data.rev_estimate != null && (
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px'
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>
              REVENUE ESTIMATE
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              {formatBig(data.rev_estimate)}
            </div>
            {data.rev_low != null && data.rev_high != null && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Range: {formatBig(data.rev_low)} – {formatBig(data.rev_high)}
              </div>
            )}
          </div>
        )}

        {/* Dividend Dates */}
        {(data.div_date || data.ex_div_date) && (
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px'
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>
              DIVIDEND
            </div>
            {data.ex_div_date && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Ex-Div: </span>
                <span style={{ fontSize: 13, color: 'var(--white2)', fontFamily: 'var(--font-mono)' }}>{data.ex_div_date}</span>
              </div>
            )}
            {data.div_date && (
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Pay: </span>
                <span style={{ fontSize: 13, color: 'var(--white2)', fontFamily: 'var(--font-mono)' }}>{data.div_date}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Earnings History Table */}
      {past.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>
            EARNINGS HISTORY
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['DATE', 'EPS EST.', 'REPORTED', 'SURPRISE', 'RESULT'].map(h => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: h === 'DATE' ? 'left' : 'right',
                      color: 'var(--muted)', fontWeight: 700, fontSize: 10, letterSpacing: 0.5,
                      whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {past.slice(0, 12).map((row, i) => {
                  const beat = row.beat === true
                  const miss = row.beat === false
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 10px', color: 'var(--white2)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {row.date}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {row.eps_estimate != null ? `$${Number(row.eps_estimate).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)',
                        color: beat ? 'var(--green)' : miss ? 'var(--red)' : 'var(--white2)' }}>
                        {row.eps_reported != null ? `$${Number(row.eps_reported).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)',
                        color: row.surprise_pct > 0 ? 'var(--green)' : row.surprise_pct < 0 ? 'var(--red)' : 'var(--muted)' }}>
                        {row.surprise_pct != null
                          ? `${row.surprise_pct > 0 ? '+' : ''}${Number(row.surprise_pct).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        {beat ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)',
                            border: '1px solid var(--green)', borderRadius: 10, padding: '2px 8px' }}>BEAT</span>
                        ) : miss ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)',
                            border: '1px solid var(--red)', borderRadius: 10, padding: '2px 8px' }}>MISS</span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {past.length === 0 && !data.next_date && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No earnings data available for {data.company}
        </div>
      )}
    </div>
  )
}

function formatBig(n) {
  if (n == null) return 'N/A'
  if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (Math.abs(n) >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toLocaleString()
}
