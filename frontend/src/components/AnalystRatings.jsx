import { useState, useEffect } from 'react'

const CONSENSUS_COLOR = {
  'STRONG BUY': '#10b981',
  'BUY': '#34d399',
  'HOLD': '#f59e0b',
  'SELL': '#f97316',
  'STRONG SELL': '#ef4444',
  'N/A': 'var(--muted)',
}

const ACTION_COLOR = {
  upgrade: '#10b981',
  downgrade: '#ef4444',
  init: '#3b82f6',
  reit: 'var(--muted)',
  main: 'var(--muted)',
}

export default function AnalystRatings({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/analyst/${ticker}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(`Failed: ${e}`); setLoading(false) })
  }, [ticker])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading analyst ratings...</div>
  if (error)   return <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)', fontSize: 12 }}>{error}</div>

  const cons = data?.consensus || 'N/A'
  const color = CONSENSUS_COLOR[cons] || 'var(--muted)'

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Consensus header */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--bg3)', border: `1px solid ${color}44`,
          borderLeft: `4px solid ${color}`,
          borderRadius: 'var(--radius)', padding: '14px 20px', minWidth: 160,
        }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>CONSENSUS</div>
          <div style={{ fontSize: 20, fontWeight: 800, color }}>{cons}</div>
          {data?.rec_mean && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Score: {data.rec_mean}/5</div>}
        </div>

        {[
          { label: 'MEAN TARGET',  value: data?.mean_target  ? `$${data.mean_target}`  : '—' },
          { label: 'HIGH TARGET',  value: data?.high_target  ? `$${data.high_target}`  : '—', color: 'var(--green)' },
          { label: 'LOW TARGET',   value: data?.low_target   ? `$${data.low_target}`   : '—', color: 'var(--red)'   },
          { label: 'ANALYSTS',     value: data?.buy_count    ? `${data.buy_count}`      : '—' },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 20px', minWidth: 100, flex: 1,
          }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: c || 'var(--white2)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Upgrades / Downgrades */}
      {data?.upgrades?.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 10 }}>RECENT ANALYST ACTIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {data.upgrades.map((u, i) => {
              const akey = (u.action || '').toLowerCase()
              const ac = ACTION_COLOR[akey] || ACTION_COLOR.main
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px 80px',
                  gap: 8, padding: '8px 12px', alignItems: 'center',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderLeft: `3px solid ${ac}`,
                  borderRadius: 'var(--radius)',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{u.date}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--white2)' }}>{u.firm}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{u.from || '—'}</span>
                  <span style={{ fontSize: 10, color: ac, fontWeight: 700 }}>→ {u.to || '—'}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                    color: ac, textAlign: 'right', textTransform: 'uppercase',
                  }}>{u.action}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
