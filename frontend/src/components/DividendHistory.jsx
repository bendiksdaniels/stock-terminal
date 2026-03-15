import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DividendHistory({ ticker }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dividends/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading dividend data...</div>

  if (!data?.history?.length && !data?.annual_div) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No dividend history — this stock may not pay dividends.</div>
  }

  const history = data.history || []

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'ANNUAL DIV', value: data.annual_div ? `$${data.annual_div}` : '—' },
          { label: 'YIELD', value: data.yield ? `${data.yield}%` : '—', color: 'var(--green)' },
          { label: 'PAYOUT RATIO', value: data.payout_ratio ? `${data.payout_ratio}%` : '—',
            color: data.payout_ratio > 80 ? 'var(--red)' : data.payout_ratio > 60 ? '#f97316' : 'var(--white2)' },
          { label: 'EX-DIV DATE', value: data.ex_div_date || '—' },
          { label: 'GROWTH (APPROX)', value: data.growth_approx != null ? (data.growth_approx > 0 ? '+' : '') + data.growth_approx + '%' : '—',
            color: data.growth_approx > 0 ? 'var(--green)' : data.growth_approx < 0 ? 'var(--red)' : 'var(--muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--white2)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {history.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 10 }}>DIVIDEND PAYMENT HISTORY</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[...history].reverse().slice(-32)} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted)' }} tickFormatter={d => d.slice(0, 7)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} tickFormatter={v => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4 }}
                labelStyle={{ color: 'var(--muted)', fontSize: 10 }}
                formatter={(v) => [`$${v.toFixed(4)}`, 'Dividend']}
              />
              <Bar dataKey="amount" fill="var(--green)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
