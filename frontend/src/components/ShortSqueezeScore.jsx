import { useState, useEffect } from 'react'

function scoreColor(score) {
  if (score >= 70) return 'var(--red)'
  if (score >= 40) return '#f97316'
  return 'var(--green)'
}

function scoreLabel(score) {
  if (score >= 70) return 'HIGH RISK'
  if (score >= 40) return 'MODERATE'
  return 'LOW RISK'
}

export default function ShortSqueezeScore({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch(`/api/squeeze/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading || !data) return null

  const score = data.score || 0
  const color = scoreColor(score)

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 14 }}>SHORT SQUEEZE POTENTIAL</div>

      {/* Score gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          border: `6px solid ${color}22`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
        }}>
          <svg style={{ position: 'absolute', inset: 0 }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${score * 2.76} 276`} strokeLinecap="round"
              transform="rotate(-90 50 50)" />
          </svg>
          <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{score}</div>
          <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: 0.5 }}>/100</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color, marginBottom: 4 }}>{scoreLabel(score)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
            {score >= 70 ? 'High short interest with low float creates squeeze conditions.' :
             score >= 40 ? 'Moderate squeeze potential. Watch for catalyst.' :
             'Low short interest. Unlikely squeeze candidate.'}
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'SHORT % FLOAT', value: data.short_pct_float != null ? data.short_pct_float + '%' : '—', score: data.components?.short_pct_score },
          { label: 'DAYS TO COVER', value: data.days_to_cover != null ? data.days_to_cover + 'd' : '—', score: data.components?.days_cover_score },
          { label: 'FLOAT SIZE',    value: data.float_shares ? ((data.float_shares / 1e6).toFixed(0) + 'M') : '—', score: data.components?.float_score },
        ].map(({ label, value, score: cs }) => (
          <div key={label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--white2)', marginBottom: 6 }}>{value}</div>
            <div style={{ height: 3, background: 'var(--bg2)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${cs || 0}%`, background: scoreColor(cs || 0), borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
