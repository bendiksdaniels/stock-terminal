import React from 'react'
import ShortInterest from './ShortInterest'

function fmtCurrency(val) {
  if (val == null) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${n.toLocaleString()}`
}

function fmtPct(val) {
  if (val == null) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

function fmtNum(val, decimals = 2) {
  if (val == null) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return n.toFixed(decimals)
}

export default function Financials({ data }) {
  if (!data) return null

  const sections = [
    {
      title: 'INCOME',
      items: [
        { label: 'Revenue',         value: fmtCurrency(data.revenue) },
        { label: 'Gross Profit',    value: fmtCurrency(data.gross_profit) },
        { label: 'Net Income',      value: fmtCurrency(data.net_income), color: data.net_income != null && data.net_income >= 0 ? 'positive' : 'negative' },
        { label: 'EPS (TTM)',       value: data.eps != null ? `$${fmtNum(data.eps)}` : '—', color: data.eps != null && data.eps >= 0 ? 'positive' : 'negative' },
        { label: 'EPS (Fwd)',       value: data.forward_eps != null ? `$${fmtNum(data.forward_eps)}` : '—' },
      ],
    },
    {
      title: 'MARGINS',
      items: [
        { label: 'Gross Margin',    value: fmtPct(data.gross_margin) },
        { label: 'Profit Margin',   value: fmtPct(data.profit_margin) },
        { label: 'Operating Margin',value: fmtPct(data.operating_margin) },
        { label: 'ROE',             value: fmtPct(data.roe) },
        { label: 'ROA',             value: fmtPct(data.roa) },
      ],
    },
    {
      title: 'VALUATION',
      items: [
        { label: 'P/E (TTM)',       value: fmtNum(data.pe_ratio) },
        { label: 'P/E (Fwd)',       value: fmtNum(data.forward_pe) },
        { label: 'Price/Book',      value: fmtNum(data.price_to_book) },
        { label: 'Beta',            value: fmtNum(data.beta) },
        { label: 'Short Ratio',     value: fmtNum(data.short_ratio) },
      ],
    },
    {
      title: 'CASH & DEBT',
      items: [
        { label: 'Free Cash Flow',  value: fmtCurrency(data.free_cash_flow) },
        { label: 'Operating CF',    value: fmtCurrency(data.operating_cash) },
        { label: 'Debt/Equity',     value: fmtNum(data.debt_to_equity) },
        { label: 'Dividend Yield',  value: fmtPct(data.dividend_yield) },
        { label: 'Shares Out',      value: fmtCurrency(data.shares_outstanding)?.replace('$','') },
      ],
    },
  ]

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">KEY FINANCIALS</span>
      </div>
      <ShortInterest ticker={data?.ticker} />
      <div className="kf-body">
        {sections.map(section => (
          <div key={section.title} className="kf-section">
            <div className="kf-section-title">{section.title}</div>
            {section.items.map(item => (
              <div key={item.label} className="kf-row">
                <span className="kf-label">{item.label}</span>
                <span className={`kf-value ${item.color || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
