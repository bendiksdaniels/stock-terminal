import { useState, useEffect, useRef } from 'react'

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function loadPortfolios() {
  try { return JSON.parse(localStorage.getItem('st_portfolios') || '[]') } catch { return [] }
}

function savePortfolios(portfolios) {
  localStorage.setItem('st_portfolios', JSON.stringify(portfolios))
}

function fmtPrice(n) {
  if (n == null) return '\u2014'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n) {
  if (n == null) return '\u2014'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function fmtLarge(n) {
  if (n == null) return '\u2014'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-$' : '$'
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K'
  return (n < 0 ? '-$' : '$') + abs.toFixed(2)
}

export default function PortfolioPage({ onSearchStock }) {
  const [portfolios, setPortfolios] = useState(loadPortfolios)
  const [activeId, setActiveId] = useState(() => loadPortfolios()[0]?.id || null)
  const [prices, setPrices] = useState({})
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ ticker: '', shares: '', price: '' })
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const fileRef = useRef()

  const persist = (updated) => {
    setPortfolios(updated)
    savePortfolios(updated)
  }

  const activePortfolio = portfolios.find(p => p.id === activeId) || null

  useEffect(() => {
    if (!activePortfolio) return
    activePortfolio.positions.forEach(pos => {
      if (!prices[pos.ticker]) {
        fetch('/api/stock/' + pos.ticker)
          .then(r => r.json())
          .then(d => { if (d.price) setPrices(prev => ({ ...prev, [pos.ticker]: d })) })
          .catch(() => {})
      }
    })
  }, [activePortfolio?.id, activePortfolio?.positions.length])

  const createPortfolio = () => {
    const name = 'Portfolio ' + (portfolios.length + 1)
    const newP = { id: generateId(), name, positions: [] }
    const updated = [...portfolios, newP]
    persist(updated)
    setActiveId(newP.id)
  }

  const deletePortfolio = (id) => {
    const updated = portfolios.filter(p => p.id !== id)
    persist(updated)
    if (activeId === id) setActiveId(updated[0]?.id || null)
  }

  const updatePositions = (id, positions) => {
    persist(portfolios.map(p => p.id === id ? { ...p, positions } : p))
  }

  const renameCurrent = () => {
    if (!activePortfolio || !nameValue.trim()) return
    persist(portfolios.map(p => p.id === activeId ? { ...p, name: nameValue.trim() } : p))
    setEditingName(false)
  }

  const addPosition = () => {
    if (!form.ticker || !form.shares || !form.price || !activePortfolio) return
    const ticker = form.ticker.toUpperCase()
    const existing = activePortfolio.positions.findIndex(p => p.ticker === ticker)
    let positions
    if (existing >= 0) {
      positions = activePortfolio.positions.map((p, i) =>
        i === existing ? { ...p, shares: parseFloat(form.shares), avg_price: parseFloat(form.price) } : p
      )
    } else {
      positions = [...activePortfolio.positions, { ticker, shares: parseFloat(form.shares), avg_price: parseFloat(form.price) }]
    }
    updatePositions(activeId, positions)
    setForm({ ticker: '', shares: '', price: '' })
    setAdding(false)
  }

  const removePosition = (ticker) => {
    if (!activePortfolio) return
    updatePositions(activeId, activePortfolio.positions.filter(p => p.ticker !== ticker))
  }

  const handleFileImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !activePortfolio) return
    setImporting(true)
    setImportError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/import-portfolio', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Import failed')
      if (!data.positions?.length) throw new Error('No positions detected')
      setPreview(data.positions)
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = (positions) => {
    if (!activePortfolio) return
    const updated = [...activePortfolio.positions]
    positions.forEach(pos => {
      const idx = updated.findIndex(p => p.ticker === pos.ticker)
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], shares: pos.shares, avg_price: pos.avg_price || updated[idx].avg_price }
      } else {
        updated.push(pos)
      }
    })
    updatePositions(activeId, updated)
    setPreview(null)
  }

  const stats = activePortfolio ? (() => {
    let totalValue = 0, totalCost = 0
    activePortfolio.positions.forEach(pos => {
      const current = prices[pos.ticker]?.price || 0
      totalValue += pos.shares * current
      totalCost += pos.shares * pos.avg_price
    })
    const pnl = totalValue - totalCost
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0
    return { totalValue, totalCost, pnl, pnlPct }
  })() : null

  return (
    <div className="portfolio-page">
      <aside className="portfolio-list-panel">
        <div className="portfolio-list-header">
          <span className="portfolio-list-title">PORTFOLIOS</span>
          <button type="button" className="pf-new-btn" onClick={createPortfolio}>+ New</button>
        </div>
        {portfolios.length === 0 && (
          <div className="portfolio-list-empty">No portfolios yet.<br />Click + New to create one.</div>
        )}
        {portfolios.map(p => {
          let val = 0, cost = 0
          p.positions.forEach(pos => {
            const cur = prices[pos.ticker]?.price || 0
            val += pos.shares * cur
            cost += pos.shares * pos.avg_price
          })
          const pnl = val - cost
          const isActive = p.id === activeId
          return (
            <div
              key={p.id}
              className={'portfolio-list-item ' + (isActive ? 'active' : '')}
              onClick={() => setActiveId(p.id)}
            >
              <div className="pli-top">
                <span className="pli-name">{p.name}</span>
                <button
                  type="button"
                  className="pli-delete"
                  onClick={e => { e.stopPropagation(); deletePortfolio(p.id) }}
                  title="Delete portfolio"
                >&times;</button>
              </div>
              <div className="pli-bottom">
                <span className="pli-positions">{p.positions.length} positions</span>
                {val > 0 && (
                  <span className={'pli-pnl ' + (pnl >= 0 ? 'positive' : 'negative')}>
                    {pnl >= 0 ? '+' : ''}{fmtLarge(pnl)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </aside>

      <div className="portfolio-detail">
        {!activePortfolio ? (
          <div className="portfolio-empty-state">
            <div className="landing-title" style={{ fontSize: 22 }}>No Portfolio Selected</div>
            <div className="landing-sub">Create a new portfolio to get started</div>
            <button type="button" className="pf-new-btn" style={{ marginTop: 20, padding: '10px 28px', fontSize: 13 }} onClick={createPortfolio}>+ Create Portfolio</button>
          </div>
        ) : (
          <>
            <div className="pf-detail-header">
              <div className="pf-name-row">
                {editingName ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="port-input"
                      style={{ fontSize: 20, fontWeight: 700, width: 260 }}
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameCurrent(); if (e.key === 'Escape') setEditingName(false) }}
                      autoFocus
                    />
                    <button type="button" className="add-favorite-btn" onClick={renameCurrent}>Save</button>
                    <button type="button" className="cancel-btn" onClick={() => setEditingName(false)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 className="pf-title">{activePortfolio.name}</h2>
                    <button type="button" className="pf-rename-btn" onClick={() => { setNameValue(activePortfolio.name); setEditingName(true) }}>&#9998; Rename</button>
                  </div>
                )}
              </div>

              {stats && (
                <div className="pf-stats-row">
                  <div className="pf-stat-card">
                    <div className="pf-stat-label">TOTAL VALUE</div>
                    <div className="pf-stat-value">{fmtPrice(stats.totalValue)}</div>
                  </div>
                  <div className="pf-stat-card">
                    <div className="pf-stat-label">INVESTED</div>
                    <div className="pf-stat-value">{fmtPrice(stats.totalCost)}</div>
                  </div>
                  <div className="pf-stat-card">
                    <div className="pf-stat-label">TOTAL P&amp;L</div>
                    <div className={'pf-stat-value ' + (stats.pnl >= 0 ? 'positive' : 'negative')}>
                      {stats.pnl >= 0 ? '+' : ''}{fmtLarge(stats.pnl)}
                    </div>
                  </div>
                  <div className="pf-stat-card">
                    <div className="pf-stat-label">RETURN</div>
                    <div className={'pf-stat-value ' + (stats.pnlPct >= 0 ? 'positive' : 'negative')}>
                      {fmtPct(stats.pnlPct)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pf-positions-section">
              <div className="pf-section-header">
                <span className="section-label">POSITIONS</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="add-favorite-btn" onClick={() => setAdding(a => !a)}>
                    {adding ? 'Cancel' : '+ Add Position'}
                  </button>
                  <label className="import-btn" style={{ padding: '6px 14px', cursor: 'pointer' }}>
                    {importing ? '\u27F3 Importing...' : '\u2B06 Import Excel/CSV'}
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileImport} disabled={importing} />
                  </label>
                </div>
              </div>

              {importError && (
                <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 0' }}>&#9888; {importError}</div>
              )}

              {adding && (
                <div className="add-position-form" style={{ marginBottom: 16 }}>
                  <input className="port-input" placeholder="Ticker (e.g. AAPL)" value={form.ticker}
                    onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} />
                  <input className="port-input" placeholder="Shares" type="number" value={form.shares}
                    onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
                  <input className="port-input" placeholder="Avg Buy Price ($)" type="number" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="add-favorite-btn" onClick={addPosition}>Add</button>
                  </div>
                </div>
              )}

              {activePortfolio.positions.length === 0 ? (
                <div className="panel-empty">No positions yet. Add one manually or import a file.</div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table pf-table">
                    <thead>
                      <tr>
                        <th>TICKER</th>
                        <th style={{ textAlign: 'right' }}>SHARES</th>
                        <th style={{ textAlign: 'right' }}>AVG PRICE</th>
                        <th style={{ textAlign: 'right' }}>CURRENT</th>
                        <th style={{ textAlign: 'right' }}>VALUE</th>
                        <th style={{ textAlign: 'right' }}>P&amp;L</th>
                        <th style={{ textAlign: 'right' }}>RETURN</th>
                        <th style={{ textAlign: 'right' }}>WEIGHT</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePortfolio.positions.map(pos => {
                        const d = prices[pos.ticker]
                        const current = d?.price || 0
                        const value = pos.shares * current
                        const cost = pos.shares * pos.avg_price
                        const pnl = value - cost
                        const ret = cost > 0 ? (pnl / cost) * 100 : 0
                        const weight = stats?.totalValue > 0 ? (value / stats.totalValue) * 100 : 0
                        const pos2 = pnl >= 0
                        return (
                          <tr key={pos.ticker} style={{ cursor: 'pointer' }} onClick={() => onSearchStock(pos.ticker)}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: 'var(--accent-soft)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pos.ticker}</span>
                                {d?.name && <span style={{ color: 'var(--muted)', fontSize: 10 }}>{d.name.split(' ').slice(0,3).join(' ')}</span>}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{pos.shares.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtPrice(pos.avg_price)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: current ? 'var(--white2)' : 'var(--muted)' }}>
                              {current ? fmtPrice(current) : '\u2014'}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{current ? fmtPrice(value) : '\u2014'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: pos2 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {current ? (pos2 ? '+' : '') + fmtLarge(pnl) : '\u2014'}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: pos2 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {current ? fmtPct(ret) : '\u2014'}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                              {current ? weight.toFixed(1) + '%' : '\u2014'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="remove-fav"
                                style={{ fontSize: 16 }}
                                onClick={e => { e.stopPropagation(); removePosition(pos.ticker) }}
                              >&times;</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {preview && (
        <ImportPreviewModal
          positions={preview}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  )
}

function ImportPreviewModal({ positions, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => new Set(positions.map((_, i) => i)))
  const toggle = (i) => setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  const confirmed = positions.filter((_, i) => selected.has(i))
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-window" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '80vh' }}>
        <div className="modal-header">
          <div className="modal-meta"><span className="modal-publisher">IMPORT PREVIEW</span></div>
          <button type="button" className="modal-close" onClick={onCancel}>&#10005;</button>
        </div>
        <div style={{ padding: '10px 18px 6px', color: 'var(--muted)', fontSize: 12 }}>
          {positions.length} positions detected &middot; {selected.size} selected
        </div>
        <div style={{ overflowY: 'auto', maxHeight: '50vh', padding: '0 18px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 4px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}></th>
                <th style={{ padding: '6px 4px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>TICKER</th>
                <th style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--muted)', fontWeight: 600 }}>SHARES</th>
                <th style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--muted)', fontWeight: 600 }}>AVG PRICE</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected.has(i) ? 'var(--bg3)' : 'transparent' }} onClick={() => toggle(i)}>
                  <td style={{ padding: '7px 4px' }}><input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} /></td>
                  <td style={{ padding: '7px 4px', color: 'var(--accent-soft)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{pos.ticker}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'right', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>{pos.shares}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'right', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>{pos.avg_price ? '$' + pos.avg_price.toFixed(2) : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="add-favorite-btn" style={{ flex: 1 }} onClick={() => onConfirm(confirmed)}>
            Import {selected.size} Position{selected.size !== 1 ? 's' : ''}
          </button>
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
