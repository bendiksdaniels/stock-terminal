import { useState, useEffect } from 'react'

export default function TickerTape() {
  const [indexes, setIndexes] = useState([])

  useEffect(() => {
    const load = () => {
      fetch('/api/market-indexes')
        .then(r => r.json())
        .then(d => { if (Array.isArray(d) && d.length) setIndexes(d) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  if (!indexes.length) return null

  // Duplicate items so the scroll loops seamlessly
  const items = [...indexes, ...indexes]

  return (
    <div className="ticker-tape">
      <div className="ticker-track">
        {items.map((idx, i) => {
          const pos = idx.change_pct >= 0
          return (
            <span key={i} className="ticker-item">
              <span className="ticker-label">{idx.label}</span>
              <span className="ticker-price">
                {idx.price != null ? idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </span>
              <span className={`ticker-change ${pos ? 'up' : 'down'}`}>
                {pos ? '▲' : '▼'} {Math.abs(idx.change_pct).toFixed(2)}%
              </span>
              <span className="ticker-sep">|</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
