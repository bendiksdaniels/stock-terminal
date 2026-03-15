import { useState, useEffect } from 'react'

const TX_COLORS = {
  Buy: '#00d084',
  Sell: '#ff3b3b',
  Option: '#4fa3e0',
  Gift: '#aa88ff',
  Unknown: '#666'
}

function formatNumber(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

function formatShares(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function InsiderTrades({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('transactions')

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    fetch(`/api/insiders/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load insider data'); setLoading(false) })
  }, [ticker])

  if (!ticker) return null

  return (
    <div className="panel insider-panel">
      <div className="panel-header">
        <span className="panel-title">INSIDER ACTIVITY</span>
        <div className="insider-tabs">
          <button
            className={`insider-tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            TRANSACTIONS
          </button>
          <button
            className={`insider-tab ${activeTab === 'holdings' ? 'active' : ''}`}
            onClick={() => setActiveTab('holdings')}
          >
            HOLDINGS
          </button>
        </div>
      </div>

      {loading && <div className="panel-loading">Loading insider data...</div>}
      {error && <div className="panel-error">{error}</div>}

      {data && activeTab === 'transactions' && (
        <div className="table-scroll">
          {data.transactions.length === 0 ? (
            <div className="panel-empty">No insider transactions found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>INSIDER</th>
                  <th>POSITION</th>
                  <th>TYPE</th>
                  <th>SHARES</th>
                  <th>VALUE</th>
                  <th>STILL HOLDING</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx, i) => (
                  <tr key={i}>
                    <td className="muted">{tx.date}</td>
                    <td className="bold">{tx.insider}</td>
                    <td className="muted small">{tx.position}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: TX_COLORS[tx.transaction] + '22',
                          color: TX_COLORS[tx.transaction],
                          border: `1px solid ${TX_COLORS[tx.transaction]}44`
                        }}
                      >
                        {tx.transaction === 'Buy' ? '▲ BUY' : tx.transaction === 'Sell' ? '▼ SELL' : tx.transaction.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: TX_COLORS[tx.transaction] }}>{formatShares(tx.shares)}</td>
                    <td>{formatNumber(tx.value)}</td>
                    <td className="muted">
                      {tx.shares_held != null ? (
                        <span>
                          {formatShares(tx.shares_held)}
                          {tx.pct_outstanding != null && (
                            <span className="pct-label"> ({(tx.pct_outstanding * 100).toFixed(3)}%)</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {data && activeTab === 'holdings' && (
        <div className="table-scroll">
          {data.holdings.length === 0 ? (
            <div className="panel-empty">No holdings data found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>INSIDER</th>
                  <th>POSITION</th>
                  <th>SHARES HELD</th>
                  <th>% OUTSTANDING</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((h, i) => (
                  <tr key={i}>
                    <td className="bold">{h.position}</td>
                    <td className="muted small">{h.position}</td>
                    <td>{formatShares(h.shares_held)}</td>
                    <td>{h.pct_outstanding != null ? `${(h.pct_outstanding * 100).toFixed(3)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
