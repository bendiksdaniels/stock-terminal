import { useState, useEffect } from 'react'

function fmtShares(n) {
  if (!n) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  return n.toLocaleString()
}

export default function InstitutionalHoldings({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('institutional')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/institutions/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading holdings data...</div>

  const rows = tab === 'institutional' ? (data?.institutional || []) : (data?.mutual_funds || [])

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)', letterSpacing: 0.5 }}>INSTITUTIONAL HOLDINGS</div>
          {data?.total_inst_pct != null && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {data.total_inst_pct}% institutionally owned
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['institutional','INSTITUTIONS'],['mutual_funds','MUTUAL FUNDS']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              letterSpacing: 0.5, cursor: 'pointer', border: '1px solid var(--border)',
              background: tab === key ? 'var(--accent)' : 'var(--bg3)',
              color: tab === key ? '#000' : 'var(--muted)',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No data available</div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 80px 100px',
            gap: 8, padding: '5px 12px',
            fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.8,
          }}>
            <span>HOLDER</span><span style={{ textAlign: 'right' }}>SHARES</span>
            <span style={{ textAlign: 'right' }}>% OUT</span><span style={{ textAlign: 'right' }}>DATE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map((r, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 80px 100px',
                gap: 8, padding: '9px 12px', alignItems: 'center',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--white2)', fontWeight: 600 }}>{r.holder}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textAlign: 'right' }}>{fmtShares(r.shares)}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, textAlign: 'right' }}>
                  {r.pct_out != null ? r.pct_out + '%' : '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--border)', textAlign: 'right' }}>{r.date}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
