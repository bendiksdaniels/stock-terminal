import { useState, useEffect, useRef } from 'react'

const STANCE_STYLE = {
  bullish: { color: 'var(--green)', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)' },
  bearish: { color: 'var(--red)',   bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.30)'  },
  neutral: { color: 'var(--muted)', bg: 'var(--bg3)',            border: 'var(--border)'          },
}

const ROUND_LABELS = {
  1: 'INITIAL REACTIONS',
  2: 'CROSS-EXAMINATION',
  3: 'FINAL VERDICTS',
}

export default function MarketSimulation({ ticker, stockData }) {
  const [phase, setPhase]           = useState('idle')   // idle | running | done | error
  const [agents, setAgents]         = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [synthesis, setSynthesis]   = useState(null)
  const [statusMsg, setStatusMsg]   = useState('')
  const [error, setError]           = useState(null)
  const bottomRef = useRef(null)

  // Auto-scroll as agents arrive
  useEffect(() => {
    if (agents.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [agents.length])

  async function runSimulation() {
    setPhase('running')
    setAgents([])
    setSynthesis(null)
    setCurrentRound(1)
    setError(null)
    setStatusMsg('Connecting to Ollama...')

    try {
      const res = await fetch(`/api/simulate/${ticker}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { setPhase('done'); return }
          try {
            const event = JSON.parse(payload)
            if (event.type === 'status') {
              setStatusMsg(event.message)
            } else if (event.type === 'round_start') {
              setCurrentRound(event.round)
              setStatusMsg(`Round ${event.round}: ${event.label}`)
            } else if (event.type === 'agent') {
              setAgents(prev => [...prev, event])
            } else if (event.type === 'synthesis') {
              setSynthesis(event.report)
            } else if (event.type === 'error') {
              setError(event.message)
              setPhase('error')
              return
            }
          } catch { /* skip malformed */ }
        }
      }
      setPhase('done')
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }

  const agentsByRound = {
    1: agents.filter(a => a.round === 1),
    2: agents.filter(a => a.round === 2),
    3: agents.filter(a => a.round === 3),
  }

  // ── Idle ────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div style={{ padding: '50px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>
          AI Market Simulation
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.7 }}>
          15 AI investor personas react to <strong style={{ color: 'var(--accent)' }}>{ticker}</strong> over 3 rounds of debate.
        </div>
        <div style={{ fontSize: 11, color: 'var(--border)', marginBottom: 28 }}>
          Powered by Ollama · llama3.2:3b · ~2 min runtime
        </div>
        <button
          onClick={runSimulation}
          style={{
            background: 'var(--accent)', border: 'none', color: '#000',
            padding: '12px 36px', borderRadius: 'var(--radius)',
            fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: 'pointer',
          }}
        >
          ▶ RUN SIMULATION
        </button>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>Simulation failed</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 20 }}>{error}</div>
        <button onClick={() => setPhase('idle')} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white2)',
          padding: '8px 20px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12,
        }}>Try Again</button>
      </div>
    )
  }

  // ── Running / Done ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0' }}>

      {/* Header bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)' }}>
            AI MARKET SIMULATION · {ticker}
          </span>
          {phase === 'running' && (
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--accent)' }}>●</span> {statusMsg}
            </span>
          )}
          {phase === 'done' && (
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Complete</span>
          )}
        </div>

        {/* Round indicators */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map(r => {
            const done = r < currentRound || phase === 'done'
            const active = r === currentRound && phase === 'running'
            return (
              <div key={r} style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                background: done || active ? 'var(--accent)' : 'var(--bg3)',
                color: done || active ? '#000' : 'var(--muted)',
                border: `1px solid ${done || active ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                {active ? '● ' : done ? '✓ ' : ''}R{r}: {ROUND_LABELS[r]}
              </div>
            )
          })}
        </div>

        {phase === 'done' && (
          <button onClick={() => setPhase('idle')} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)',
            padding: '4px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 11,
          }}>↺ Reset</button>
        )}
      </div>

      {/* Feeds + Synthesis */}
      <div style={{ padding: '16px 20px' }}>

        {/* Round sections */}
        {[1, 2, 3].map(r => {
          const items = agentsByRound[r]
          if (items.length === 0) return null
          return (
            <div key={r} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)',
                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  background: 'var(--accent)', color: '#000',
                  borderRadius: 20, padding: '2px 10px', fontSize: 9,
                }}>ROUND {r}</span>
                {ROUND_LABELS[r]}
                <span style={{ color: 'var(--border)', fontWeight: 400 }}>
                  {items.length}/15 {r === currentRound && phase === 'running' ? '...' : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                {items.map((entry, i) => (
                  <AgentCard key={`${r}-${i}`} entry={entry} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Synthesis */}
        {synthesis && <SynthesisReport report={synthesis} />}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function AgentCard({ entry }) {
  const { agent, response } = entry
  const s = STANCE_STYLE[response.stance] || STANCE_STYLE.neutral
  return (
    <div style={{
      background: 'var(--bg3)', border: `1px solid var(--border)`,
      borderLeft: `3px solid ${s.color}`,
      borderRadius: 'var(--radius)', padding: '11px 13px',
      animation: 'simFadeIn 0.3s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{agent.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--white2)' }}>{agent.name}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>{agent.role.toUpperCase()}</div>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
          background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: 'nowrap',
        }}>{response.stance.toUpperCase()}</span>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>CONVICTION</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--white2)', fontWeight: 700 }}>
            {response.confidence}/10
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg2)', overflow: 'hidden' }}>
          <div style={{
            width: `${response.confidence * 10}%`, height: '100%',
            background: s.color, borderRadius: 2, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Reason */}
      <div style={{ fontSize: 11, color: 'var(--white2)', lineHeight: 1.6 }}>
        {response.reason || <span style={{ color: 'var(--border)' }}>No response</span>}
      </div>
    </div>
  )
}

function TallyChip({ label, count, total, color, bg }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '10px 8px',
      background: bg, border: `1px solid ${color}33`,
      borderRadius: 'var(--radius)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{count}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{pct}%</div>
    </div>
  )
}

function SynthesisReport({ report }) {
  const s = STANCE_STYLE[report.dominant_stance] || STANCE_STYLE.neutral
  const total = report.bull_count + report.bear_count + report.neutral_count
  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${s.border}`,
      borderRadius: 'var(--radius)', padding: '18px 20px', marginTop: 8,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--muted)',
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          background: s.color, color: '#000', borderRadius: 20,
          padding: '2px 10px', fontSize: 9, fontWeight: 800,
        }}>SYNTHESIS</span>
        SIMULATION COMPLETE
      </div>

      {/* Vote tally */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TallyChip label="BULLISH" count={report.bull_count} total={total} color="var(--green)" bg="rgba(16,185,129,0.08)" />
        <TallyChip label="BEARISH" count={report.bear_count} total={total} color="var(--red)"   bg="rgba(244,63,94,0.08)"  />
        <TallyChip label="NEUTRAL" count={report.neutral_count} total={total} color="var(--muted)" bg="var(--bg3)" />
      </div>

      {/* Avg confidence */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>AVG CONVICTION</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--white2)' }}>
          {report.avg_confidence}/10
        </span>
        <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${report.avg_confidence * 10}%`, height: '100%',
            background: s.color, borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Narrative */}
      <div style={{
        padding: '10px 14px', background: 'var(--bg3)',
        borderLeft: `3px solid ${s.color}`, borderRadius: 4, marginBottom: 14,
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5, marginBottom: 4, fontWeight: 700 }}>
          DOMINANT NARRATIVE
        </div>
        <div style={{ fontSize: 12, color: 'var(--white2)', lineHeight: 1.7 }}>{report.narrative}</div>
      </div>

      {/* Catalysts + Risks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--green)', letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>
            ▲ KEY CATALYSTS
          </div>
          {report.key_catalysts.length === 0
            ? <div style={{ fontSize: 11, color: 'var(--border)' }}>No bullish thesis</div>
            : report.key_catalysts.map((c, i) => (
              <div key={i} style={{
                fontSize: 11, color: 'var(--white2)', lineHeight: 1.6, marginBottom: 6,
                paddingLeft: 10, borderLeft: '2px solid var(--green)',
              }}>{c}</div>
            ))}
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>
            ▼ KEY RISKS
          </div>
          {report.key_risks.length === 0
            ? <div style={{ fontSize: 11, color: 'var(--border)' }}>No bearish thesis</div>
            : report.key_risks.map((r, i) => (
              <div key={i} style={{
                fontSize: 11, color: 'var(--white2)', lineHeight: 1.6, marginBottom: 6,
                paddingLeft: 10, borderLeft: '2px solid var(--red)',
              }}>{r}</div>
            ))}
        </div>
      </div>
    </div>
  )
}
