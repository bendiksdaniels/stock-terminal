import { useState, useEffect } from 'react'
import { cachedFetch } from '../utils/cache'

const SEVERITY_STYLE = {
  HIGH:   { color: 'var(--red)',    bg: 'rgba(255,59,59,0.10)',  border: 'rgba(255,59,59,0.30)'  },
  MEDIUM: { color: '#f59e0b',       bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
  LOW:    { color: 'var(--muted)',  bg: 'var(--bg3)',            border: 'var(--border)'          },
}

const CATEGORY_LABELS = {
  useful_life:    'DEPRECIATION',
  lease:          'LEASE ACCOUNTING',
  revenue:        'REVENUE RECOGNITION',
  off_balance:    'OFF-BALANCE SHEET',
  goodwill:       'GOODWILL',
  capitalization: 'CAPITALIZATION',
  related_party:  'RELATED PARTIES',
  auditor:        'AUDITOR FLAGS',
  pension:        'PENSION',
  inventory:      'INVENTORY / COGS',
}

const LOADING_MSGS = [
  'Fetching 10-K filing from SEC EDGAR...',
  'Scanning for accounting discrepancies...',
  'Analyzing lease & depreciation policies...',
  'Checking revenue recognition changes...',
  'Reviewing off-balance sheet exposures...',
  'Almost done...',
]

export default function AccountingFlags({ ticker }) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [msgIdx, setMsgIdx]       = useState(0)
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setData(null)
    setError(null)
    setMsgIdx(0)

    const id = setInterval(() => setMsgIdx(i => Math.min(i + 1, LOADING_MSGS.length - 1)), 4000)

    cachedFetch(`/api/accounting-flags/${ticker}`, `acct-flags:${ticker}`)
      .then(d => { setData(d); setLoading(false); clearInterval(id) })
      .catch(() => { setError('Failed to scan 10-K filing'); setLoading(false); clearInterval(id) })

    return () => clearInterval(id)
  }, [ticker])

  if (loading) return (
    <div className="panel-loading" style={{ padding: '60px 20px', flexDirection: 'column', gap: 16 }}>
      <div className="loading-spinner-sm" />
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{LOADING_MSGS[msgIdx]}</div>
      <div style={{ color: 'var(--border)', fontSize: 11 }}>
        10-K filings can take 20–40 seconds to fetch and scan
      </div>
    </div>
  )

  if (error) return <div className="panel-error">{error}</div>
  if (!data) return null

  const { findings, summary, filing_length } = data

  // Categories that actually have findings
  const activeCats = [...new Set(findings.map(f => f.category))]

  const visible = activeCategory === 'all'
    ? findings
    : findings.filter(f => f.category === activeCategory)

  return (
    <div style={{ padding: '18px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="panel-title">10-K ACCOUNTING FLAGS</div>
          <div className="panel-subtitle" style={{ marginTop: 3 }}>
            Automated scan of SEC 10-K filing · {filing_length ? `${(filing_length / 1000).toFixed(0)}k chars scanned` : ''}
          </div>
        </div>
        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {summary.HIGH > 0 && (
            <span style={{
              background: SEVERITY_STYLE.HIGH.bg, border: `1px solid ${SEVERITY_STYLE.HIGH.border}`,
              color: SEVERITY_STYLE.HIGH.color, borderRadius: 20, padding: '4px 12px',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            }}>▲ {summary.HIGH} HIGH</span>
          )}
          {summary.MEDIUM > 0 && (
            <span style={{
              background: SEVERITY_STYLE.MEDIUM.bg, border: `1px solid ${SEVERITY_STYLE.MEDIUM.border}`,
              color: SEVERITY_STYLE.MEDIUM.color, borderRadius: 20, padding: '4px 12px',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            }}>■ {summary.MEDIUM} MEDIUM</span>
          )}
          {summary.LOW > 0 && (
            <span style={{
              background: SEVERITY_STYLE.LOW.bg, border: `1px solid ${SEVERITY_STYLE.LOW.border}`,
              color: SEVERITY_STYLE.LOW.color, borderRadius: 20, padding: '4px 12px',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            }}>● {summary.LOW} LOW</span>
          )}
        </div>
      </div>

      {findings.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
          <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>No flags detected</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            No accounting discrepancies matched in the most recent 10-K filing.
          </div>
        </div>
      ) : (
        <>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <FilterChip label="ALL" count={findings.length} active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
            {activeCats.map(cat => (
              <FilterChip
                key={cat}
                label={CATEGORY_LABELS[cat] || cat.toUpperCase()}
                count={findings.filter(f => f.category === cat).length}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>

          {/* Findings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map((finding, i) => (
              <FindingCard key={i} finding={finding} />
            ))}
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
            Automated regex scan — always verify findings against the original 10-K filing.
            Not investment advice.
          </div>
        </>
      )}
    </div>
  )
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--bg3)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? '#000' : 'var(--muted)',
        borderRadius: 20, padding: '4px 12px',
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label} {count}
    </button>
  )
}

function FindingCard({ finding }) {
  const sev = SEVERITY_STYLE[finding.severity] || SEVERITY_STYLE.LOW
  const catLabel = CATEGORY_LABELS[finding.category] || finding.category.toUpperCase()
  const [expanded, setExpanded] = useState(finding.severity === 'HIGH')

  return (
    <div style={{
      background: 'var(--bg3)',
      border: `1px solid ${sev.border}`,
      borderLeft: `3px solid ${sev.color}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {/* Card header — always visible */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Severity badge */}
        <span style={{
          background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color,
          borderRadius: 10, padding: '2px 8px', fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{finding.severity}</span>

        {/* Category tag */}
        <span style={{
          fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.5,
          border: '1px solid var(--border)', borderRadius: 10, padding: '2px 7px',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{catLabel}</span>

        {/* Title */}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--white2)', flex: 1 }}>
          {finding.title}
        </span>

        {/* Page hint */}
        {finding.page_hint && (
          <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', flexShrink: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {finding.page_hint}
          </span>
        )}

        <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {/* Excerpt from 10-K */}
          <div style={{
            background: 'var(--bg2)',
            borderLeft: `3px solid ${sev.color}`,
            borderRadius: 4,
            padding: '10px 14px',
            marginBottom: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--white2)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {finding.excerpt}
          </div>

          {/* Plain-English explanation */}
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            {finding.explanation}
          </div>
        </div>
      )}
    </div>
  )
}
