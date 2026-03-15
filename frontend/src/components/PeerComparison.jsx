import { useState, useEffect } from 'react'

function fmt(v, prefix = '', suffix = '', decimals = 1) {
  if (v == null) return '—'
  return `${prefix}${Number(v).toFixed(decimals)}${suffix}`
}

function fmtCap(n) {
  if (!n) return '—'
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T'
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B'
  return '$' + (n / 1e6).toFixed(0) + 'M'
}

export default function PeerComparison({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/peers/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading peer data...</div>

  const peers = data?.peers || []
  if (!peers.length) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No peer data available.</div>

  const cols = [
    { label: 'COMPANY',      render: p => (
      <span style={{ fontWeight: p.ticker === ticker ? 800 : 600, color: p.ticker === ticker ? 'var(--accent)' : 'var(--white2)' }}>
        {p.ticker === ticker ? '▶ ' : ''}{p.ticker}
      </span>
    )},
    { label: 'PRICE',        render: p => <span style={{ fontFamily: 'var(--font-mono)' }}>{p.price ? `$${p.price}` : '—'}</span> },
    { label: 'MKT CAP',      render: p => fmtCap(p.market_cap) },
    { label: 'P/E',          render: p => fmt(p.pe) },
    { label: 'FWD P/E',      render: p => fmt(p.fwd_pe) },
    { label: 'EV/EBITDA',    render: p => fmt(p.ev_ebitda) },
    { label: 'REV GROWTH',   render: p => p.rev_growth != null
      ? <span style={{ color: p.rev_growth >= 0 ? 'var(--green)' : 'var(--red)' }}>{p.rev_growth > 0 ? '+' : ''}{p.rev_growth}%</span>
      : '—' },
    { label: 'GROSS MARGIN', render: p => fmt(p.gross_margin, '', '%') },
    { label: 'NET MARGIN',   render: p => p.net_margin != null
      ? <span style={{ color: p.net_margin >= 0 ? 'var(--white2)' : 'var(--red)' }}>{p.net_margin}%</span>
      : '—' },
  ]

  const gridCols = `180px repeat(${cols.length - 1}, 1fr)`

  return (
    <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
      {data?.industry && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 14, letterSpacing: 0.5 }}>
          INDUSTRY: <span style={{ color: 'var(--white2)', fontWeight: 600 }}>{data.industry}</span>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: '6px 12px', fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.8, minWidth: 700 }}>
        {cols.map(c => <span key={c.label}>{c.label}</span>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {peers.map((p, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: gridCols,
            gap: 8, padding: '9px 12px', alignItems: 'center', minWidth: 700,
            background: p.ticker === ticker ? 'rgba(var(--accent-rgb, 251,191,36),0.06)' : 'var(--bg3)',
            border: p.ticker === ticker ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}>
            {cols.map((c, ci) => (
              <span key={ci} style={{ fontSize: 11, color: 'var(--white2)' }}>{c.render(p)}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
