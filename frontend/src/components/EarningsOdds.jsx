import { useState, useEffect } from 'react'

export default function EarningsOdds({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setData(null)
    setError(null)
    fetch(`/api/earnings-odds/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to fetch prediction markets'); setLoading(false) })
  }, [ticker])

  if (loading) return (
    <div className="panel-loading">
      <div className="loading-spinner-sm" />
      <span>Scanning Polymarket &amp; Kalshi...</span>
    </div>
  )

  if (error) return <div className="panel-error">{error}</div>

  const markets = data?.markets || []

  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="panel-title">EARNINGS PREDICTION MARKETS</div>
          <div className="panel-subtitle" style={{ marginTop: 3 }}>
            {data?.company} · Live odds from Polymarket &amp; Kalshi
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SourceBadge label="Polymarket" color="var(--accent)" />
          <SourceBadge label="Kalshi" color="var(--purple)" />
        </div>
      </div>

      {markets.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ color: 'var(--white)', fontWeight: 600, marginBottom: 6 }}>
            No active prediction markets found
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
            Earnings prediction markets on Polymarket and Kalshi typically open
            1–3 weeks before a company's earnings date. Check back closer to {data?.company}'s
            next earnings release.
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 20 }}>
            <a
              href={`https://polymarket.com/search?q=${ticker}+earnings`}
              target="_blank" rel="noopener noreferrer"
              className="modal-ext-link"
            >Search Polymarket →</a>
            <a
              href={`https://kalshi.com/markets/kxearnings`}
              target="_blank" rel="noopener noreferrer"
              className="modal-ext-link"
            >Browse Kalshi Earnings →</a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {markets.map((m, i) => (
            <MarketCard key={i} market={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function SourceBadge({ label, color }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      letterSpacing: 0.5, border: `1px solid ${color}`, color
    }}>{label}</span>
  )
}

function MarketCard({ market }) {
  const yp = market.yes_prob
  const np = market.no_prob
  const isPolymarket = market.source === 'Polymarket'
  const sourceColor = isPolymarket ? 'var(--accent)' : 'var(--purple)'
  const isClosed = market.closed || !market.active

  return (
    <a
      href={market.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '14px 16px',
        transition: 'border-color 0.15s',
        opacity: isClosed ? 0.6 : 1,
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = sourceColor}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              color: 'var(--white2)', fontSize: 13, fontWeight: 600, lineHeight: 1.4,
              marginBottom: 4
            }}>{market.question}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                color: sourceColor, border: `1px solid ${sourceColor}`,
                borderRadius: 10, padding: '1px 7px'
              }}>{market.source}</span>
              {isClosed && (
                <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg4)',
                  padding: '1px 7px', borderRadius: 10 }}>RESOLVED</span>
              )}
              {market.end_date && (
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {isClosed ? 'Closed' : 'Closes'} {market.end_date}
                </span>
              )}
              {market.volume > 0 && (
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                  Vol: ${Number(market.volume).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Probability bar */}
        {yp != null ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: yp >= 50 ? 'var(--green)' : 'var(--red)' }}>
                YES {yp}%
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: np >= 50 ? 'var(--red)' : 'var(--muted)' }}>
                NO {np}%
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg4)', overflow: 'hidden' }}>
              <div style={{
                width: `${yp}%`, height: '100%', borderRadius: 4,
                background: yp >= 50
                  ? `linear-gradient(90deg, var(--green), var(--green-soft))`
                  : `linear-gradient(90deg, var(--red), var(--red-soft))`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Market says{' '}
              <strong style={{ color: yp >= 50 ? 'var(--green)' : 'var(--red)' }}>
                {yp >= 60 ? 'likely' : yp >= 50 ? 'slightly likely' : yp >= 40 ? 'slightly unlikely' : 'unlikely'}
              </strong>
              {' '}to beat earnings
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '6px 0' }}>
            Price data unavailable
          </div>
        )}
      </div>
    </a>
  )
}
