import { useState, useEffect } from 'react'

function pctToColor(pct) {
  const clamped = Math.max(-3, Math.min(3, pct))
  if (clamped >= 0) {
    const intensity = clamped / 3
    const g = Math.round(100 + 85 * intensity)
    return `rgba(16, ${g}, 80, ${0.15 + 0.45 * intensity})`
  } else {
    const intensity = (-clamped) / 3
    const r = Math.round(180 + 75 * intensity)
    return `rgba(${r}, 30, 50, ${0.15 + 0.45 * intensity})`
  }
}

export default function SectorHeatmap() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market-pulse')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: '10px 20px', display: 'flex', gap: 6 }}>
      {Array(11).fill(0).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 54, background: 'var(--bg3)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )

  if (!data?.sectors?.length) return null

  return (
    <div style={{ padding: '10px 20px 6px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {data.sectors.map(s => {
          const pct = s.pct_change || 0
          const color = pct >= 0 ? '#10b981' : '#ef4444'
          return (
            <div key={s.symbol} style={{
              flex: '0 0 auto',
              background: pctToColor(pct),
              border: '1px solid ' + (pct >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'),
              borderRadius: 4, padding: '7px 10px', textAlign: 'center', minWidth: 74,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--white2)', letterSpacing: 0.5 }}>{s.symbol}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>{s.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </div>
            </div>
          )
        })}

        {/* VIX + Fear/Greed */}
        {data.vix != null && (
          <div style={{
            flex: '0 0 auto', minWidth: 80,
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '7px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', letterSpacing: 0.5 }}>VIX</div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: data.vix > 30 ? '#ef4444' : data.vix > 20 ? '#f97316' : '#10b981' }}>
              {data.vix}
            </div>
            {data.fear_greed_score != null && (
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
                F&G {data.fear_greed_score}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
