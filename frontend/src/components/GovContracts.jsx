import React, { useState, useEffect } from 'react'

function formatAmount(n) {
  if (n == null || n === 0) return '$0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${n.toLocaleString()}`
}

export default function GovContracts({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/contracts/${ticker}`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-loading">
          <div className="loading-spinner-sm" />
          <span>Loading government contracts...</span>
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

  const contracts = data?.contracts || []
  const total = data?.total || 0
  const company = data?.company || ticker

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">GOVERNMENT CONTRACTS</div>
          <div className="panel-subtitle" style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>
            {company}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Contract Value</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            {formatAmount(total)}
          </div>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: '0.9rem' }}>
          No government contracts data available
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>AWARD DATE</th>
                <th>AGENCY</th>
                <th>DESCRIPTION</th>
                <th>AMOUNT</th>
                <th>TYPE</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{c.date || '-'}</td>
                  <td>{c.agency || '-'}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description || 'N/A'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', textAlign: 'right' }}>
                    {formatAmount(c.amount)}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{c.type || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
