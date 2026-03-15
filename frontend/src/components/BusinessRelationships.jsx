import { useState, useEffect } from 'react'

const REL_CONFIG = {
  customers: { label: 'CUSTOMERS', color: '#4fa3e0', icon: '→' },
  suppliers: { label: 'SUPPLIERS', color: '#ffb300', icon: '←' },
  partners:  { label: 'PARTNERS',  color: '#00d084', icon: '⇄' },
  competitors: { label: 'COMPETITORS', color: '#ff3b3b', icon: '⚔' },
  acquisitions: { label: 'ACQUISITIONS', color: '#aa88ff', icon: '⊕' },
  other: { label: 'OTHER', color: '#888', icon: '·' },
}

export default function BusinessRelationships({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [loadingMsg, setLoadingMsg] = useState('Fetching 10-K filing...')

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setData(null)
    setError(null)

    const msgs = [
      'Fetching 10-K filing...',
      'Reading SEC EDGAR...',
      'Analyzing business relationships...',
      'Extracting companies...',
      'Almost done...'
    ]
    let msgIdx = 0
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length
      setLoadingMsg(msgs[msgIdx])
    }, 3000)

    fetch(`/api/business/${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error)
        } else {
          setData(d)
        }
        setLoading(false)
        clearInterval(interval)
      })
      .catch(err => {
        setError('Failed to load relationships. The SEC EDGAR server may be slow.')
        setLoading(false)
        clearInterval(interval)
      })

    return () => clearInterval(interval)
  }, [ticker])

  const handleRetry = () => {
    setError(null)
    setData(null)
    setLoading(true)
    fetch(`/api/business/${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load relationships. The SEC EDGAR server may be slow.')
        setLoading(false)
      })
  }

  if (!ticker) return null

  const categories = Object.keys(REL_CONFIG)

  const getRows = () => {
    if (!data || !data.grouped) return []
    if (activeCategory === 'all') return data.relationships || []
    return data.grouped[activeCategory] || []
  }

  const getCategoryCount = (cat) => {
    if (!data?.grouped) return 0
    return (data.grouped[cat] || []).length
  }

  const rows = getRows()

  return (
    <div className="panel relationships-panel">
      <div className="panel-header">
        <span className="panel-title">BUSINESS RELATIONSHIPS</span>
        {data && <span className="panel-subtitle">{data.total} companies found in 10-K</span>}
      </div>

      {loading && (
        <div style={{padding: '4px 20px 0 20px', color: '#555', fontSize: '11px', fontFamily: 'Courier New'}}>
          Reading SEC EDGAR 10-K filing — this may take 30–60 seconds
        </div>
      )}

      {data && (
        <div className="rel-tabs">
          <button
            className={`rel-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            ALL ({data.total})
          </button>
          {categories.map(cat => {
            const count = getCategoryCount(cat)
            if (count === 0) return null
            const cfg = REL_CONFIG[cat]
            return (
              <button
                key={cat}
                className={`rel-tab ${activeCategory === cat ? 'active' : ''}`}
                style={activeCategory === cat ? { borderColor: cfg.color, color: cfg.color } : {}}
                onClick={() => setActiveCategory(cat)}
              >
                {cfg.icon} {cfg.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <div className="panel-loading">
          <div className="loading-spinner-sm"></div>
          <span>{loadingMsg}</span>
        </div>
      )}

      {!loading && error && (
        <div className="panel-empty" style={{color: '#ff3b3b', flexDirection: 'column', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <div>{error}</div>
          <button className="retry-btn" onClick={handleRetry}>RETRY</button>
        </div>
      )}

      {!loading && !error && data && data.total === 0 && (
        <div className="panel-empty" style={{flexDirection: 'column', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <div>No business relationships found in this 10-K filing.</div>
          <div style={{color: '#555', fontSize: '11px'}}>The parser may not have found relationship keywords in this filing.</div>
          <button className="retry-btn" style={{borderColor: '#555', color: '#555'}} onClick={handleRetry}>RETRY</button>
        </div>
      )}

      {!loading && !error && data && rows.length === 0 && data.total > 0 && (
        <div className="panel-empty">No relationships found in this category</div>
      )}

      {!loading && !error && data && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>COMPANY</th>
                <th>RELATIONSHIP</th>
                <th>CONTRACT / VALUE</th>
                <th>CONTEXT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const relKey = r.relationship?.toLowerCase()
                const cfg = REL_CONFIG[relKey] || REL_CONFIG.other
                return (
                  <tr key={i}>
                    <td className="bold">{r.company}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: cfg.color + '22',
                          color: cfg.color,
                          border: `1px solid ${cfg.color}44`
                        }}
                      >
                        {cfg.icon} {r.relationship}
                      </span>
                    </td>
                    <td style={{ color: '#ffb300' }}>{r.value || '—'}</td>
                    <td className="muted small context-cell" title={r.context}>
                      {r.context?.substring(0, 100)}...
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
