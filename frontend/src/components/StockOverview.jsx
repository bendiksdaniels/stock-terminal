import React from 'react'

export default function StockOverview({ data }) {
  if (!data) return null

  const {
    name, price, change, change_percent,
    sector, industry, week52_low, week52_high, description,
    country, exchange, employees, website,
  } = data

  const isPositive = (change_percent ?? 0) >= 0

  const rangePercent =
    week52_low != null && week52_high != null && week52_high > week52_low
      ? ((price - week52_low) / (week52_high - week52_low)) * 100
      : null

  const clamped = rangePercent != null ? Math.min(100, Math.max(0, rangePercent)) : null

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">OVERVIEW</span>
        {exchange && <span className="panel-subtitle">{exchange}</span>}
      </div>

      <div className="overview-body">
        {/* Company name + price */}
        <div className="ov-name">{name}</div>
        <div className="ov-price-row">
          <span className="ov-price">{price != null ? `$${price.toFixed(2)}` : '—'}</span>
          <span className={`ov-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '▲' : '▼'}&nbsp;
            {change != null ? `${isPositive ? '+' : ''}${change.toFixed(2)}` : '—'}
            &nbsp;({change_percent != null ? `${isPositive ? '+' : ''}${change_percent.toFixed(2)}%` : '—'})
          </span>
        </div>

        {/* Tags */}
        <div className="ov-tags">
          {sector    && <span className="ov-tag">{sector}</span>}
          {industry  && <span className="ov-tag ov-tag-dim">{industry}</span>}
          {country   && <span className="ov-tag ov-tag-dim">{country}</span>}
        </div>

        {/* 52-week range bar */}
        {clamped != null && (
          <div className="ov-range">
            <div className="ov-range-labels">
              <span>52W LOW&ensp;${week52_low.toFixed(2)}</span>
              <span>52W HIGH&ensp;${week52_high.toFixed(2)}</span>
            </div>
            <div className="ov-range-track">
              <div className="ov-range-fill" style={{ width: `${clamped}%` }} />
              <div className="ov-range-dot"  style={{ left: `${clamped}%` }} />
            </div>
          </div>
        )}

        {/* Key stats row */}
        <div className="ov-stats">
          {employees != null && (
            <div className="ov-stat">
              <span className="ov-stat-label">EMPLOYEES</span>
              <span className="ov-stat-val">{Number(employees).toLocaleString()}</span>
            </div>
          )}
          {website && (
            <div className="ov-stat">
              <span className="ov-stat-label">WEBSITE</span>
              <a className="ov-stat-val ov-link" href={website} target="_blank" rel="noopener noreferrer">
                {website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {/* Description */}
        {description && <p className="ov-desc">{description}</p>}
      </div>
    </div>
  )
}
