// Technical indicator calculations (all operate on arrays of close prices)

export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return []
  const result = new Array(closes.length).fill(null)
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff; else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  const rsi = (ag, al) => al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  result[period] = rsi(avgGain, avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
    result[i] = rsi(avgGain, avgLoss)
  }
  return result
}

export function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  const result = new Array(closes.length).fill(null)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = ema
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
    result[i] = ema
  }
  return result
}

export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  const macdLine = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  )
  // Signal line = EMA of macdLine (skip nulls)
  const validMacd = macdLine.filter(v => v != null)
  const signalEma = calcEMA(validMacd, signal)
  let sigIdx = 0
  const signalLine = macdLine.map(v => v != null ? (signalEma[sigIdx++] ?? null) : null)
  const histogram = macdLine.map((v, i) =>
    v != null && signalLine[i] != null ? v - signalLine[i] : null
  )
  return { macdLine, signalLine, histogram }
}

export function calcBollingerBands(closes, period = 20, stdDev = 2) {
  const upper = new Array(closes.length).fill(null)
  const middle = new Array(closes.length).fill(null)
  const lower = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    middle[i] = mean
    upper[i] = mean + stdDev * sd
    lower[i] = mean - stdDev * sd
  }
  return { upper, middle, lower }
}
