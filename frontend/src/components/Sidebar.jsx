import { useState, useEffect } from 'react'
import NewsModal from './NewsModal'
import NotesPanel from './NotesPanel'
import EconomicCalendar from './EconomicCalendar'

function NewsPanel({ ticker }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    const url = ticker ? `/api/news/${ticker}` : '/api/market-news'
    fetch(url)
      .then(r => r.json())
      .then(d => { setNews(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  return (
    <div className="sidebar-panel-content">
      {loading && <div className="sidebar-loading">Loading news...</div>}
      {!loading && news.length === 0 && <div className="sidebar-empty">No news available</div>}
      {news.map((item, i) => (
        <div
          key={i}
          className="news-item"
          onClick={() => item.url && setSelected(item)}
          style={{ cursor: item.url ? 'pointer' : 'default' }}
        >
          <div className="news-title">{item.title}</div>
          <div className="news-meta">
            <span className="news-publisher">{item.publisher}</span>
            {item.date && <span className="news-date">{item.date}</span>}
          </div>
          {item.summary && <div className="news-summary">{item.summary}</div>}
          {item.url && <div className="news-read-hint">Click to read →</div>}
        </div>
      ))}
      {selected && <NewsModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function FavoritesPanel({ onSearch, currentTicker }) {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('st_favorites') || '[]') } catch { return [] }
  })
  const [prices, setPrices] = useState({})

  const saveFavorites = (favs) => {
    setFavorites(favs)
    localStorage.setItem('st_favorites', JSON.stringify(favs))
  }

  const addCurrent = () => {
    if (currentTicker && !favorites.includes(currentTicker)) {
      saveFavorites([...favorites, currentTicker])
    }
  }

  const remove = (ticker) => {
    saveFavorites(favorites.filter(f => f !== ticker))
  }

  useEffect(() => {
    favorites.forEach(ticker => {
      if (!prices[ticker]) {
        fetch(`/api/stock/${ticker}`)
          .then(r => r.json())
          .then(d => {
            if (d.price) {
              setPrices(prev => ({ ...prev, [ticker]: d }))
            }
          })
          .catch(() => {})
      }
    })
  }, [favorites])

  return (
    <div className="sidebar-panel-content">
      {currentTicker && !favorites.includes(currentTicker) && (
        <button className="add-favorite-btn" onClick={addCurrent}>
          ★ Add {currentTicker} to Favorites
        </button>
      )}
      {favorites.length === 0 && (
        <div className="sidebar-empty">Search a stock and add it to favorites</div>
      )}
      {favorites.map(ticker => {
        const d = prices[ticker]
        const pos = d && d.change_percent >= 0
        return (
          <div key={ticker} className="favorite-item" onClick={() => onSearch(ticker)}>
            <div className="favorite-left">
              <span className="favorite-ticker">{ticker}</span>
              {d && <span className="favorite-name">{d.name?.split(' ').slice(0,2).join(' ')}</span>}
            </div>
            <div className="favorite-right">
              {d && <span className="favorite-price">${d.price?.toFixed(2)}</span>}
              {d && (
                <span className={`favorite-change ${pos ? 'positive' : 'negative'}`}>
                  {pos ? '+' : ''}{d.change_percent?.toFixed(2)}%
                </span>
              )}
            </div>
            <button className="remove-fav" onClick={e => { e.stopPropagation(); remove(ticker) }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

function ImportPreviewModal({ positions, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => new Set(positions.map((_, i) => i)))

  const toggle = (i) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const confirmed = positions.filter((_, i) => selected.has(i))

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-window import-preview-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '80vh' }}>
        <div className="modal-header">
          <div className="modal-meta"><span className="modal-publisher">IMPORT PREVIEW</span></div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: '10px 18px 6px', color: 'var(--muted)', fontSize: 12 }}>
          {positions.length} positions detected · {selected.size} selected
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
                <tr key={i}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected.has(i) ? 'var(--bg3)' : 'transparent' }}
                  onClick={() => toggle(i)}
                >
                  <td style={{ padding: '7px 4px' }}>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ padding: '7px 4px', color: 'var(--accent-soft)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{pos.ticker}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'right', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>{pos.shares}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'right', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>
                    {pos.avg_price ? `$${pos.avg_price.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <button className="add-favorite-btn" style={{ flex: 1 }} onClick={() => onConfirm(confirmed)}>
            Import {selected.size} Position{selected.size !== 1 ? 's' : ''}
          </button>
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function PortfolioPanel({ onOpenPortfolios }) {
  const [portfolios, setPortfolios] = useState(() => {
    try { return JSON.parse(localStorage.getItem('st_portfolios') || '[]') } catch { return [] }
  })
  const [prices, setPrices] = useState({})

  // Reload when localStorage changes (e.g. from PortfolioPage)
  useEffect(() => {
    const sync = () => {
      try { setPortfolios(JSON.parse(localStorage.getItem('st_portfolios') || '[]')) } catch {}
    }
    window.addEventListener('storage', sync)
    // Also poll every 3s to catch same-tab updates
    const id = setInterval(sync, 3000)
    return () => { window.removeEventListener('storage', sync); clearInterval(id) }
  }, [])

  // Collect all unique tickers across all portfolios and fetch prices
  useEffect(() => {
    const tickers = [...new Set(portfolios.flatMap(p => p.positions.map(pos => pos.ticker)))]
    tickers.forEach(ticker => {
      if (!prices[ticker]) {
        fetch(`/api/stock/${ticker}`)
          .then(r => r.json())
          .then(d => { if (d.price) setPrices(prev => ({ ...prev, [ticker]: d })) })
          .catch(() => {})
      }
    })
  }, [portfolios])

  // Compute day % change for a portfolio (dollar-weighted)
  const dayChange = (portfolio) => {
    let totalValue = 0, dayPnl = 0
    portfolio.positions.forEach(pos => {
      const d = prices[pos.ticker]
      if (!d?.price || !d?.change_percent) return
      const value = pos.shares * d.price
      const prevValue = value / (1 + d.change_percent / 100)
      totalValue += value
      dayPnl += value - prevValue
    })
    if (totalValue === 0) return null
    return (dayPnl / (totalValue - dayPnl)) * 100
  }

  // Compute total current value
  const totalValue = (portfolio) =>
    portfolio.positions.reduce((sum, pos) => sum + pos.shares * (prices[pos.ticker]?.price || 0), 0)

  if (portfolios.length === 0) {
    return (
      <div className="sidebar-panel-content">
        <div className="sidebar-empty">No portfolios yet.</div>
        <button className="add-favorite-btn" onClick={onOpenPortfolios}>Open Portfolio Manager →</button>
      </div>
    )
  }

  return (
    <div className="sidebar-panel-content">
      {portfolios.map(pf => {
        const val = totalValue(pf)
        const day = dayChange(pf)
        const dayPos = day == null ? null : day >= 0
        return (
          <div key={pf.id} className="portfolio-item" style={{ cursor: 'pointer' }} onClick={onOpenPortfolios}>
            <div className="port-header">
              <span style={{ color: 'var(--white2)', fontWeight: 600, fontSize: 13 }}>{pf.name}</span>
              {day != null && (
                <span className={`port-pnl ${dayPos ? 'positive' : 'negative'}`} style={{ fontSize: 12, marginLeft: 'auto' }}>
                  {dayPos ? '▲' : '▼'} {Math.abs(day).toFixed(2)}% today
                </span>
              )}
            </div>
            <div className="port-detail">
              <span className="port-shares">{pf.positions.length} positions</span>
              {val > 0 && (
                <span style={{ color: 'var(--white2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        )
      })}
      <button className="add-favorite-btn" style={{ marginTop: 6 }} onClick={onOpenPortfolios}>
        Manage Portfolios →
      </button>
    </div>
  )
}

export default function Sidebar({ onSearch, currentTicker, onOpenPortfolios }) {
  const [activeTab, setActiveTab] = useState('news')

  const TABS = [
    { key: 'favorites',  label: '★', title: 'Watch' },
    { key: 'portfolios', label: '◈', title: 'Ports' },
    { key: 'news',       label: '◎', title: 'News' },
    { key: 'calendar',   label: '◉', title: 'Macro' },
    { key: 'notes',      label: '✎', title: 'Notes' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`sidebar-tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            title={t.title}
          >
            <span className="sidebar-tab-icon">{t.label}</span>
            <span className="sidebar-tab-label">{t.title}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-body">
        <div className="sidebar-section-title">
          {activeTab === 'favorites'  && 'WATCHLIST'}
          {activeTab === 'portfolios' && 'MY PORTFOLIOS'}
          {activeTab === 'news'       && (currentTicker ? `${currentTicker} NEWS` : 'MARKET NEWS')}
          {activeTab === 'calendar'   && 'MACRO CALENDAR'}
          {activeTab === 'notes'      && (currentTicker ? `NOTES · ${currentTicker}` : 'NOTES')}
        </div>
        {activeTab === 'news'       && <NewsPanel ticker={currentTicker} />}
        {activeTab === 'favorites'  && <FavoritesPanel onSearch={onSearch} currentTicker={currentTicker} />}
        {activeTab === 'portfolios' && <PortfolioPanel onOpenPortfolios={onOpenPortfolios} />}
        {activeTab === 'calendar'   && <EconomicCalendar />}
        {activeTab === 'notes'      && <NotesPanel ticker={currentTicker} />}
      </div>
    </aside>
  )
}
