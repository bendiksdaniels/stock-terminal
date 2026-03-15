import { useState, useEffect } from 'react'

function formatVal(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1000000) return `${v < 0 ? '-' : ''}$${(abs / 1000000).toFixed(2)}T`
  if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}B`
  return `${v < 0 ? '-' : ''}$${abs.toFixed(1)}M`
}

const STATEMENT_TABS = [
  { key: 'income_statement',    label: 'INCOME STATEMENT' },
  { key: 'balance_sheet',       label: 'BALANCE SHEET' },
  { key: 'cash_flow',           label: 'CASH FLOW' },
  { key: 'quarterly_income',    label: 'QUARTERLY' },
]

const KEY_METRICS = new Set([
  'Total Revenue', 'Revenue', 'Gross Profit', 'Operating Income',
  'Net Income', 'EBITDA', 'Total Assets', 'Total Debt',
  'Stockholders Equity', 'Total Liabilities Net Minority Interest',
  'Free Cash Flow', 'Operating Cash Flow', 'Capital Expenditure',
  'Cash And Cash Equivalents', 'Total Liabilities',
])

export default function FullFinancials({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('income_statement')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setData(null)
    fetch(`/api/statements/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (!ticker) return null

  const rows = data?.[activeTab] || []
  const years = data?.years || []

  const quarterCols = rows.length > 0
    ? Object.keys(rows[0]).filter(k => k !== 'metric').slice(0, 8)
    : []
  const cols = activeTab === 'quarterly_income' ? quarterCols : years

  const filtered = search
    ? rows.filter(r => r.metric.toLowerCase().includes(search.toLowerCase()))
    : rows

  return (
    <div className="panel full-financials-panel">
      <div className="panel-header">
        <span className="panel-title">FINANCIAL STATEMENTS</span>
        <span className="panel-subtitle">{data?.currency || 'USD (in Millions)'}</span>
      </div>

      <div className="financials-nav">
        <div className="financials-tabs">
          {STATEMENT_TABS.map(tab => (
            <button
              key={tab.key}
              className={`fin-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setSearch('') }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          className="fin-search"
          placeholder="Filter metrics..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="panel-loading"><div className="loading-spinner-sm" /><span>Loading financial statements...</span></div>}

      {!loading && data && (
        <div className="table-scroll">
          {filtered.length === 0 ? (
            <div className="panel-empty">No data found</div>
          ) : (
            <table className="data-table fin-table">
              <thead>
                <tr>
                  <th className="metric-col">METRIC</th>
                  {cols.map(y => <th key={y} style={{ textAlign: 'right' }}>{y}</th>)}
                  {cols.length > 1 && <th style={{ textAlign: 'right', color: 'var(--amber)' }}>YoY</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const isKey = KEY_METRICS.has(row.metric)
                  const vals = cols.map(y => row[y])
                  let yoy = null
                  if (vals.length >= 2 && vals[0] != null && vals[1] != null && vals[1] !== 0) {
                    yoy = ((vals[0] - vals[1]) / Math.abs(vals[1])) * 100
                  }
                  return (
                    <tr key={i} className={isKey ? 'key-row' : ''}>
                      <td className={`metric-name ${isKey ? 'key-metric' : 'muted'}`}>
                        {row.metric}
                      </td>
                      {vals.map((v, j) => (
                        <td key={j} style={{ textAlign: 'right', color: v != null && v < 0 ? 'var(--red)' : 'var(--white2)' }}>
                          {formatVal(v)}
                        </td>
                      ))}
                      {cols.length > 1 && (
                        <td style={{
                          textAlign: 'right',
                          color: yoy == null ? 'var(--muted)' : yoy >= 0 ? 'var(--green)' : 'var(--red)',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {yoy == null ? '—' : `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
