import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList
} from 'recharts'

function formatRevenue(val) {
  if (val == null) return '—'
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}T`
  return `$${val.toFixed(1)}B`
}

function formatEPS(val) {
  if (val == null) return '—'
  return val >= 0 ? `$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`
}

const RevenueTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-date">{label}</div>
        <div className="chart-tooltip-price" style={{ color: '#4fa3e0' }}>
          {formatRevenue(payload[0].value)}
        </div>
      </div>
    )
  }
  return null
}

const EPSTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const val = payload[0].value
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-date">{label}</div>
        <div className="chart-tooltip-price" style={{ color: val >= 0 ? '#00d084' : '#ff3b3b' }}>
          {formatEPS(val)}
        </div>
      </div>
    )
  }
  return null
}

export default function FundamentalsChart({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch(`/api/fundamentals/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (!ticker) return null

  const annual = data?.annual || []
  const revenueData = annual.filter(d => d.revenue != null)
  const epsData = annual.filter(d => d.eps != null)

  return (
    <div className="fundamentals-section">
      <div className="fundamentals-header">
        <span className="section-label">ANNUAL FINANCIALS</span>
        {data && <span className="panel-subtitle">Last {annual.length} fiscal years</span>}
      </div>

      <div className="fundamentals-charts">
        <div className="chart-container fundamentals-chart">
          <div className="chart-header">
            <span className="chart-title">ANNUAL REVENUE</span>
            <span className="chart-unit" style={{ color: '#4fa3e0' }}>USD Billions</span>
          </div>
          {loading ? (
            <div className="chart-loading">Loading...</div>
          ) : revenueData.length === 0 ? (
            <div className="chart-loading">No revenue data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#666', fontSize: 11, fontFamily: 'Courier New' }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#666', fontSize: 11, fontFamily: 'Courier New' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}B`}
                  width={55}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={60}>
                  <LabelList
                    dataKey="revenue"
                    position="top"
                    content={(props) => {
                      const { x, y, width, value, index } = props
                      if (index === 0) return null
                      const prev = revenueData[index - 1]?.revenue
                      if (!prev) return null
                      const growth = ((value - prev) / Math.abs(prev) * 100).toFixed(1)
                      const isPos = parseFloat(growth) >= 0
                      return (
                        <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={isPos ? '#00d084' : '#ff3b3b'} fontSize={10} fontFamily="Courier New">
                          {isPos ? '+' : ''}{growth}%
                        </text>
                      )
                    }}
                  />
                  {revenueData.map((entry, i) => {
                    const isLatest = i === revenueData.length - 1
                    return <Cell key={i} fill={isLatest ? '#4fa3e0' : '#4fa3e055'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-container fundamentals-chart">
          <div className="chart-header">
            <span className="chart-title">EARNINGS PER SHARE (EPS)</span>
            <span className="chart-unit" style={{ color: '#00d084' }}>USD per share</span>
          </div>
          {loading ? (
            <div className="chart-loading">Loading...</div>
          ) : epsData.length === 0 ? (
            <div className="chart-loading">No EPS data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={epsData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#666', fontSize: 11, fontFamily: 'Courier New' }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#666', fontSize: 11, fontFamily: 'Courier New' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  width={50}
                />
                <ReferenceLine y={0} stroke="#2a2a2a" strokeWidth={1} />
                <Tooltip content={<EPSTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="eps" radius={[3, 3, 0, 0]} maxBarSize={60}>
                  <LabelList
                    dataKey="eps"
                    position="top"
                    content={(props) => {
                      const { x, y, width, value, index } = props
                      if (index === 0) return null
                      const prev = epsData[index - 1]?.eps
                      if (!prev) return null
                      const growth = ((value - prev) / Math.abs(prev) * 100).toFixed(1)
                      const isPos = parseFloat(growth) >= 0
                      return (
                        <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={isPos ? '#00d084' : '#ff3b3b'} fontSize={10} fontFamily="Courier New">
                          {isPos ? '+' : ''}{growth}%
                        </text>
                      )
                    }}
                  />
                  {epsData.map((entry, i) => {
                    const isLatest = i === epsData.length - 1
                    const positive = entry.eps >= 0
                    if (isLatest) return <Cell key={i} fill={positive ? '#00d084' : '#ff3b3b'} />
                    return <Cell key={i} fill={positive ? '#00d08455' : '#ff3b3b55'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
