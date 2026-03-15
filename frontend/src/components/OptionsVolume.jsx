import React, { useState, useEffect } from 'react'

function fmt(n, decimals) {
  if (n == null) return '-'
  return Number(n).toFixed(decimals != null ? decimals : 2)
}

function fmtInt(n) {
  if (n == null || n === 0) return '-'
  return Number(n).toLocaleString()
}

export default function OptionsVolume({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedExpiry, setSelectedExpiry] = useState(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedExpiry(null)
    fetch(`/api/options/${ticker}`)
      .then(res => res.json())
      .then(d => {
        setData(d)
        setSelectedExpiry(d.selected_expiry || null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [ticker])

  const handleExpiryChange = (expiry) => {
    setSelectedExpiry(expiry)
    setLoading(true)
    fetch(`/api/options/${ticker}?expiry=${expiry}`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  if (loading && !data) {
    return (
      <div className="panel">
        <div className="panel-loading">
          <div className="loading-spinner-sm" />
          <span>Loading options data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="error-banner">⚠ {error}</div>
      </div>
    )
  }

  if (!data) return null

  const calls = data.calls || []
  const puts = data.puts || []
  const expirations = data.expirations || []
  const put_call_ratio = data.put_call_ratio
  const total_call_volume = data.total_call_volume
  const total_put_volume = data.total_put_volume
  const displayExpiries = expirations.slice(0, 6)

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">OPTIONS CHAIN</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {put_call_ratio != null && (
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              P/C RATIO: <span style={{ color: put_call_ratio > 1 ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {put_call_ratio}
              </span>
            </div>
          )}
          {total_call_volume != null && (
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              CALL VOL: <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{fmtInt(total_call_volume)}</span>
            </div>
          )}
          {total_put_volume != null && (
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              PUT VOL: <span style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{fmtInt(total_put_volume)}</span>
            </div>
          )}
        </div>
      </div>

      {displayExpiries.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {displayExpiries.map(exp => (
            <button
              key={exp}
              onClick={() => handleExpiryChange(exp)}
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                background: selectedExpiry === exp ? 'var(--accent)' : 'var(--bg3)',
                color: selectedExpiry === exp ? 'var(--bg)' : 'var(--white)',
                border: `1px solid ${selectedExpiry === exp ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {exp}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--muted)', fontSize: '0.85rem' }}>
          <div className="loading-spinner-sm" />
          <span>Loading chain...</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.1em', marginBottom: 8 }}>CALLS</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>STRIKE</th><th>BID</th><th>ASK</th><th>VOLUME</th><th>OPEN INT</th><th>IV%</th>
                </tr>
              </thead>
              <tbody>
                {calls.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>No data</td></tr>
                ) : calls.map((c, i) => (
                  <tr key={i} style={{ opacity: c.inTheMoney ? 1 : 0.65 }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: c.inTheMoney ? 700 : 400 }}>{fmt(c.strike)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmt(c.bid)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmt(c.ask)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{fmtInt(c.volume)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmtInt(c.openInterest)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{c.impliedVolatility}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.1em', marginBottom: 8 }}>PUTS</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>STRIKE</th><th>BID</th><th>ASK</th><th>VOLUME</th><th>OPEN INT</th><th>IV%</th>
                </tr>
              </thead>
              <tbody>
                {puts.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>No data</td></tr>
                ) : puts.map((p, i) => (
                  <tr key={i} style={{ opacity: p.inTheMoney ? 1 : 0.65 }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: p.inTheMoney ? 700 : 400 }}>{fmt(p.strike)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmt(p.bid)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmt(p.ask)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{fmtInt(p.volume)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmtInt(p.openInterest)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.impliedVolatility}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
