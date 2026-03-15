import { useState, useEffect } from 'react'

const PARTY_COLOR = { D: '#3b82f6', R: '#ef4444', I: '#a78bfa' }
const TYPE_COLOR  = { purchase: 'var(--green)', sale: 'var(--red)', sale_full: 'var(--red)', sale_partial: '#f97316' }

export default function CongressTrades({ ticker }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/congress/${ticker}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(`Failed to load: ${e}`); setLoading(false) })
  }, [ticker])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading congressional trades...</div>
  if (error)   return <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)', fontSize: 12 }}>{error}</div>

  const trades = (data?.trades || []).filter(t => filter === 'all' || t.chamber === filter)

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)', letterSpacing: 0.5 }}>
            CONGRESSIONAL TRADES · {ticker}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            {trades.length} transaction{trades.length !== 1 ? 's' : ''} on record
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all','house','senate'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              letterSpacing: 0.5, cursor: 'pointer', border: '1px solid var(--border)',
              background: filter === f ? 'var(--accent)' : 'var(--bg3)',
              color: filter === f ? '#000' : 'var(--muted)',
            }}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {trades.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
          No congressional trades found for {ticker}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trades.map((t, i) => {
            const txType  = (t.tx_type || '').toLowerCase()
            const tcolor  = TYPE_COLOR[txType] || 'var(--muted)'
            const pcolor  = PARTY_COLOR[t.party] || 'var(--muted)'
            const isBuy   = txType.includes('purchase')
            return (
              <div key={i} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${tcolor}`,
                borderRadius: 'var(--radius)', padding: '10px 14px',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      background: pcolor + '22', color: pcolor,
                      border: `1px solid ${pcolor}44`,
                      borderRadius: 20, padding: '1px 7px', fontSize: 9, fontWeight: 800,
                    }}>{t.party || '?'}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)' }}>
                      {(t.name || '').trim()}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{t.state}</span>
                    <span style={{
                      fontSize: 9, color: 'var(--muted)', background: 'var(--bg2)',
                      border: '1px solid var(--border)', borderRadius: 20, padding: '1px 7px',
                    }}>{t.chamber.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {t.asset !== ticker ? t.asset : ticker}
                    {t.comment && <span style={{ marginLeft: 8, color: 'var(--border)' }}>{t.comment}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: tcolor, letterSpacing: 0.5, marginBottom: 4,
                  }}>{isBuy ? '▲ BUY' : '▼ SELL'}</div>
                  <div style={{ fontSize: 11, color: 'var(--white2)', fontFamily: 'var(--font-mono)' }}>{t.amount}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{t.tx_date}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
