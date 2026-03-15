import { useState, useEffect } from 'react'

function fmt(n) {
  if (!n && n !== 0) return 'N/A'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  return n.toLocaleString()
}

export default function ShortInterest({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/short-interest/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading) return null
  if (!data || data.error) return null

  const changePct = data.short_change_pct
  const changeColor = changePct == null ? 'var(--muted)' : changePct > 0 ? 'var(--red)' : 'var(--green)'

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>
        SHORT INTEREST
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: 'SHORT SHARES',    value: fmt(data.shares_short) },
          { label: 'SHORT % FLOAT',   value: data.short_pct_float != null ? data.short_pct_float + '%' : 'N/A',
            color: data.short_pct_float > 20 ? 'var(--red)' : data.short_pct_float > 10 ? '#f97316' : 'var(--white2)' },
          { label: 'DAYS TO COVER',   value: data.short_ratio != null ? data.short_ratio + 'd' : 'N/A',
            color: data.short_ratio > 5 ? 'var(--red)' : 'var(--white2)' },
          { label: 'PRIOR MONTH',     value: fmt(data.shares_short_prior) },
          { label: 'CHANGE (MoM)',    value: changePct != null ? (changePct > 0 ? '+' : '') + changePct + '%' : 'N/A', color: changeColor },
          { label: 'FLOAT SHARES',    value: fmt(data.float_shares) },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--white2)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
