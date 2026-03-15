import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, ReferenceLine } from 'recharts'
import { calcRSI, calcMACD, calcBollingerBands } from '../utils/indicators'

const PERIODS = [
  { label: '1W', value: '1wk' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
]

export default function PriceChart({ ticker, currentPrice }) {
  const [data, setData]       = useState([])
  const [period, setPeriod]   = useState('1mo')
  const [loading, setLoading] = useState(false)
  const [indicators, setIndicators] = useState(new Set())

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch('/api/history/' + ticker + '?period=' + period)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker, period])

  const toggleIndicator = (key) => {
    setIndicators(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const isPositive = data.length > 1 && data[data.length - 1].close >= data[0].close
  const color = isPositive ? '#00d084' : '#ff3b3b'

  // Compute indicators
  const closes = data.map(d => d.close)
  const rsiValues   = indicators.has('RSI')  ? calcRSI(closes) : []
  const macdResult  = indicators.has('MACD') ? calcMACD(closes) : null
  const bbResult    = indicators.has('BB')   ? calcBollingerBands(closes) : null

  // Merge indicator values into chart data
  const chartData = data.map((d, i) => ({
    ...d,
    rsi:        rsiValues[i]                ?? null,
    macd:       macdResult?.macdLine[i]     ?? null,
    macdSignal: macdResult?.signalLine[i]   ?? null,
    macdHist:   macdResult?.histogram[i]    ?? null,
    bbUpper:    bbResult?.upper[i]          ?? null,
    bbMiddle:   bbResult?.middle[i]         ?? null,
    bbLower:    bbResult?.lower[i]          ?? null,
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <div className="chart-tooltip-date">{label}</div>
          <div className="chart-tooltip-price" style={{ color }}>
            ${payload[0].value?.toFixed(2)}
          </div>
        </div>
      )
    }
    return null
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    if (period === '1wk') return d.toLocaleDateString('en-US', { weekday: 'short' })
    if (period === '1y' || period === '5y') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const tickData = data.filter((_, i) => {
    const step = Math.max(1, Math.floor(data.length / 6))
    return i % step === 0 || i === data.length - 1
  })

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">PRICE HISTORY</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Indicator toggles */}
          <div className="indicator-toggles">
            {['RSI', 'MACD', 'BB'].map(ind => (
              <button
                key={ind}
                type="button"
                className={`indicator-btn ${indicators.has(ind) ? 'active' : ''}`}
                onClick={() => toggleIndicator(ind)}
              >
                {ind}
              </button>
            ))}
          </div>
          <div className="period-selector">
            {PERIODS.map(p => (
              <button
                key={p.value}
                className={'period-btn ' + (period === p.value ? 'active' : '')}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.length > 1 && (
        <div className="chart-stats">
          <span className="chart-stat-label">PERIOD RETURN</span>
          <span className={`chart-stat-value ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : ''}{(((data[data.length-1].close - data[0].close) / data[0].close) * 100).toFixed(2)}%
          </span>
          <span className="chart-stat-sep">|</span>
          <span className="chart-stat-label">OPEN</span>
          <span className="chart-stat-value">${data[0].close.toFixed(2)}</span>
          <span className="chart-stat-sep">|</span>
          <span className="chart-stat-label">HIGH</span>
          <span className="chart-stat-value positive">${Math.max(...data.map(d => d.high)).toFixed(2)}</span>
          <span className="chart-stat-sep">|</span>
          <span className="chart-stat-label">LOW</span>
          <span className="chart-stat-value negative">${Math.min(...data.map(d => d.low)).toFixed(2)}</span>
        </div>
      )}

      {loading ? (
        <div className="chart-loading">Loading chart...</div>
      ) : data.length === 0 ? (
        <div className="chart-loading">No chart data available</div>
      ) : (
        <>
          {/* Main price chart */}
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                ticks={tickData.map(d => d.date)}
                tick={{ fill: '#666', fontSize: 11, fontFamily: 'Courier New' }}
                axisLine={{ stroke: '#2a2a2a' }}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#666', fontSize: 11, fontFamily: 'Courier New' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => '$' + v}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={color}
                strokeWidth={2}
                fill="url(#colorPrice)"
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: '#0a0a0a', strokeWidth: 2 }}
              />
              {/* Bollinger Bands overlay */}
              {indicators.has('BB') && <>
                <Area type="monotone" dataKey="bbUpper"  stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
                <Area type="monotone" dataKey="bbMiddle" stroke="#3b82f688" strokeWidth={1} fill="none" dot={false} />
                <Area type="monotone" dataKey="bbLower"  stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
              </>}
            </AreaChart>
          </ResponsiveContainer>

          {/* Volume */}
          <div className="volume-label">VOLUME</div>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Bar dataKey="volume" maxBarSize={8}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={i > 0 && entry.close >= chartData[i-1].close ? '#00d08444' : '#ff3b3b44'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* RSI sub-chart */}
          {indicators.has('RSI') && (
            <>
              <div className="volume-label" style={{ color: '#a78bfa' }}>RSI (14)</div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: '#666', fontSize: 9 }} width={28} ticks={[30, 50, 70]} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <ReferenceLine y={70} stroke="#ef444466" strokeDasharray="3 3" />
                  <ReferenceLine y={30} stroke="#10b98166" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10 }}
                    formatter={(v) => [v?.toFixed(1), 'RSI']}
                    labelFormatter={() => ''}
                  />
                  <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {/* MACD sub-chart */}
          {indicators.has('MACD') && (
            <>
              <div className="volume-label" style={{ color: '#f59e0b' }}>MACD (12/26/9)</div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis tick={{ fill: '#666', fontSize: 9 }} width={40} tickFormatter={v => v.toFixed(1)} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <ReferenceLine y={0} stroke="#ffffff22" />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10 }}
                    formatter={(v, name) => [v?.toFixed(3), name]}
                    labelFormatter={() => ''}
                  />
                  <Line type="monotone" dataKey="macd"       stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MACD"   connectNulls />
                  <Line type="monotone" dataKey="macdSignal" stroke="#ef4444" strokeWidth={1}   dot={false} name="Signal" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </>
      )}
    </div>
  )
}
