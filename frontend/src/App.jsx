import React, { useState, useEffect } from 'react'
import SearchBar from './components/SearchBar'
import StockOverview from './components/StockOverview'
import PriceChart from './components/PriceChart'
import Sidebar from './components/Sidebar'
import DashboardTabs from './components/DashboardTabs'
import { cachedFetch } from './utils/cache'
import EarningsDateCard from './components/EarningsDateCard'
import EarningsCalendarPage from './components/EarningsCalendarPage'
import TickerTape from './components/TickerTape'
import PortfolioPage from './components/PortfolioPage'
import AlertsModal from './components/AlertsModal'
import SectorHeatmap from './components/SectorHeatmap'
import { useAlertPoller } from './hooks/useAlertPoller'

function formatLargeNumber(n) {
  if (n == null) return 'N/A'
  if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (Math.abs(n) >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toLocaleString()
}

function isMarketOpen() {
  const now = new Date()
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960
}

function StatCard({ label, value, subvalue, valueClass }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${valueClass || ''}`}>{value}</div>
      {subvalue && <div className="stat-subvalue">{subvalue}</div>}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="stat-card">
      <div className="skeleton skeleton-text" style={{ width: '55%', marginBottom: 10 }} />
      <div className="skeleton skeleton-text large" />
    </div>
  )
}

export default function App() {
  const [clock, setClock] = useState(new Date())
  const [stockData, setStockData] = useState(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [currentTicker, setCurrentTicker] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('st_theme') || 'dark')
  const [screen, setScreen] = useState('terminal')
  const [showAlerts, setShowAlerts] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  useAlertPoller(currentTicker, stockData?.price)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('st_theme', theme)
  }, [theme])

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSearch = (ticker) => {
    const t = ticker.trim().toUpperCase()
    setError(null)
    setCurrentTicker(t)
    setStockData(null)
    setSearched(true)
    setLoadingStock(true)
    cachedFetch(`/api/stock/${t}`, `stock:${t}`)
      .then(data => {
        if (data.detail) throw new Error(data.detail)
        setStockData(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingStock(false))
  }

  const marketOpen = isMarketOpen()
  const changePos = stockData && stockData.change_percent >= 0

  return (
    <div className="app">
      {/* TOP HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">STOCK<span>TERMINAL</span></div>
          <div className="header-divider" />
          <div className="header-meta">
            <span className="clock">
              {clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              &ensp;{clock.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button type="button" className={'nav-btn ' + (screen === 'earnings' ? 'active' : '')} onClick={() => setScreen(s => s === 'earnings' ? 'terminal' : 'earnings')}>
            &#9670; EARNINGS CALENDAR
          </button>
          <button type="button" className={'nav-btn ' + (screen === 'portfolios' ? 'active' : '')} onClick={() => setScreen(s => s === 'portfolios' ? 'terminal' : 'portfolios')}>
            &#9672; PORTFOLIOS
          </button>
          <button
            onClick={() => setShowAlerts(true)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--muted)', padding: '5px 12px',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12,
              position: 'relative',
            }}
          >
            ALERTS
            {alertCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--red)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{alertCount}</span>
            )}
          </button>
          <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle light/dark mode">
            {theme === 'dark' ? '☀ LIGHT' : '☾ DARK'}
          </button>
          <div className={`market-badge ${marketOpen ? 'open' : 'closed'}`}>
            <span className="market-dot" />
            {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </div>
          {stockData && (
            <div className="header-ticker-info">
              <span className="header-ticker-name">{stockData.name}</span>
              <span className="header-ticker-sym">{currentTicker}</span>
              <span className={`header-ticker-price ${changePos ? 'positive' : 'negative'}`}>
                ${stockData.price?.toFixed(2)}
                &ensp;{changePos ? '▲' : '▼'} {Math.abs(stockData.change_percent)?.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </header>

      <TickerTape />
      <SectorHeatmap />

      {screen === 'earnings' ? (
        <EarningsCalendarPage onSearchStock={(t) => { setScreen('terminal'); handleSearch(t) }} />
      ) : screen === 'portfolios' ? (
        <PortfolioPage onSearchStock={(t) => { setScreen('terminal'); handleSearch(t) }} />
      ) : (
        /* BODY */
        <div className="body-layout">
          {/* LEFT SIDEBAR */}
          <Sidebar onSearch={handleSearch} currentTicker={currentTicker} onOpenPortfolios={() => setScreen('portfolios')} />

          {/* MAIN CONTENT */}
          <main className="main-content">
            <SearchBar onSearch={handleSearch} loading={loadingStock} />

            {error && <div className="error-banner">⚠ {error}</div>}

            {searched && (
              <div className="dashboard">
                {/* STAT CARDS */}
                <div className="stat-cards">
                  {loadingStock ? (
                    [1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)
                  ) : stockData ? (
                    <>
                      <StatCard
                        label="PRICE"
                        value={stockData.price != null ? `$${stockData.price.toFixed(2)}` : 'N/A'}
                        subvalue={stockData.change != null ? `${changePos?'+':''}${stockData.change.toFixed(2)} (${changePos?'+':''}${stockData.change_percent?.toFixed(2)}%)` : null}
                        valueClass={changePos ? 'positive' : 'negative'}
                      />
                      <StatCard label="MARKET CAP" value={formatLargeNumber(stockData.market_cap)} />
                      <StatCard
                        label="VOLUME"
                        value={stockData.volume != null ? Number(stockData.volume).toLocaleString() : 'N/A'}
                        subvalue={stockData.avg_volume ? `Avg: ${Number(stockData.avg_volume).toLocaleString()}` : null}
                      />
                      <StatCard
                        label="P/E RATIO"
                        value={stockData.pe_ratio != null ? Number(stockData.pe_ratio).toFixed(2) : 'N/A'}
                        subvalue={stockData.forward_pe ? `Fwd: ${Number(stockData.forward_pe).toFixed(2)}` : null}
                      />
                      <StatCard label="52W HIGH" value={stockData.week52_high != null ? `$${stockData.week52_high.toFixed(2)}` : 'N/A'} valueClass="positive" />
                      <StatCard label="52W LOW" value={stockData.week52_low != null ? `$${stockData.week52_low.toFixed(2)}` : 'N/A'} valueClass="negative" />
                      <EarningsDateCard ticker={currentTicker} />
                    </>
                  ) : null}
                </div>

                {!loadingStock && stockData && <StockOverview data={stockData} />}
                {currentTicker && <PriceChart ticker={currentTicker} currentPrice={stockData?.price} />}
                {currentTicker && <DashboardTabs ticker={currentTicker} stockData={stockData} />}
              </div>
            )}

            {!searched && (
              <div className="landing">
                <div className="landing-title">PROFESSIONAL MARKET INTELLIGENCE</div>
                <div className="landing-sub">Search any stock to view price history, SEC filings, insider activity, financials &amp; more</div>
                <div className="landing-hints">
                  {['AAPL','NVDA','TSLA','MSFT','AMZN'].map(t => (
                    <span key={t} onClick={() => handleSearch(t)} style={{ cursor: 'pointer' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      )}
      {showAlerts && (
        <AlertsModal
          onClose={() => setShowAlerts(false)}
          currentTicker={currentTicker}
          currentPrice={stockData?.price}
        />
      )}
    </div>
  )
}
