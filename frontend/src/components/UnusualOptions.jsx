import { useState, useEffect } from 'react'

export default function UnusualOptions({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/unusual-options/${ticker}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(`Failed: ${e}`); setLoading(false) })
  }, [ticker])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Scanning options chains...</div>
  if (error)   return <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)', fontSize: 12 }}>{error}</div>

  const unusual = (data?.unusual || []).filter(u => filter === 'all' || u.type === filter)

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)', letterSpacing: 0.5 }}>
            UNUSUAL OPTIONS ACTIVITY · {ticker}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            Volume &gt;3× open interest or vol/OI &gt;1.5 with vol&gt;500
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all','call','put'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              letterSpacing: 0.5, cursor: 'pointer', border: '1px solid var(--border)',
              background: filter === f ? (f === 'put' ? 'var(--red)' : f === 'call' ? 'var(--green)' : 'var(--accent)') : 'var(--bg3)',
              color: filter === f ? (f === 'put' || f === 'call' ? '#fff' : '#000') : 'var(--muted)',
            }}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {unusual.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
          No unusual options activity detected for {ticker}
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 70px 70px 80px 80px 80px 70px 60px',
            gap: 8, padding: '6px 12px',
            fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.8,
          }}>
            <span>TYPE</span><span>EXPIRY</span><span>STRIKE</span>
            <span style={{ textAlign: 'right' }}>LAST</span>
            <span style={{ textAlign: 'right' }}>VOLUME</span>
            <span style={{ textAlign: 'right' }}>OI</span>
            <span style={{ textAlign: 'right' }}>VOL/OI</span>
            <span style={{ textAlign: 'right' }}>IV</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {unusual.map((u, i) => {
              const isCall = u.type === 'call'
              const color  = isCall ? 'var(--green)' : 'var(--red)'
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '60px 70px 70px 80px 80px 80px 70px 60px',
                  gap: 8, padding: '8px 12px', alignItems: 'center',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderLeft: `3px solid ${color}`, borderRadius: 'var(--radius)',
                }}>
                  <span style={{
                    background: isCall ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                    color, border: `1px solid ${color}44`,
                    borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 800,
                    textAlign: 'center',
                  }}>{u.type.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{u.expiry}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--white2)' }}>
                    ${u.strike.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--white2)', textAlign: 'right' }}>
                    ${u.last_price.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color, textAlign: 'right' }}>
                    {u.volume.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textAlign: 'right' }}>
                    {u.open_interest.toLocaleString()}
                  </span>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right',
                    color: u.vol_oi_ratio > 5 ? 'var(--red)' : u.vol_oi_ratio > 3 ? '#f97316' : 'var(--white2)',
                    fontWeight: u.vol_oi_ratio > 3 ? 700 : 400,
                  }}>
                    {u.vol_oi_ratio != null ? u.vol_oi_ratio + 'x' : '—'}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textAlign: 'right' }}>
                    {u.implied_vol}%
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
