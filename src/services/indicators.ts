/**
 * 技术指标计算 —— 纯函数，无副作用。
 * 浏览器（行情页面）与 Cloudflare Worker（定时分析）共用同一份实现，
 * 保证「页面上看到的指标」和「定时任务算出来的指标」完全一致。
 */

export interface Candle {
  /** YYYY-MM-DD */
  date: string
  open: number
  close: number
  high: number
  low: number
  /** 成交量（手） */
  volume: number
  /** 成交额（元） */
  amount: number
  /** 当日振幅 % */
  amplitude: number
}

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits

/** 简单移动平均 */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i += 1) sum += values[i]
  return round(sum / period, 4)
}

/** EMA 序列（下标 0 处用首个值播种） */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i += 1) out.push(values[i] * k + out[i - 1] * (1 - k))
  return out
}

/** 单点 EMA */
export function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period)
  return series.length ? round(series[series.length - 1], 4) : null
}

/** RSI（Wilder 平滑） */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1]
    if (delta >= 0) gain += delta
    else loss -= delta
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period
  }
  if (avgLoss === 0) return 100
  return round(100 - 100 / (1 + avgGain / avgLoss), 2)
}

export interface MacdResult {
  dif: number
  dea: number
  hist: number
  /** 上一根 K 线的 hist，用于判断金叉 / 死叉 */
  prevHist: number
}

/** MACD(12, 26, 9) */
export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult | null {
  if (closes.length < slow + signal) return null
  const emaFast = emaSeries(closes, fast)
  const emaSlow = emaSeries(closes, slow)
  const dif = closes.map((_, i) => emaFast[i] - emaSlow[i])
  const dea = emaSeries(dif, signal)
  const last = dif.length - 1
  const prev = last - 1
  if (prev < 0) return null
  return {
    dif: round(dif[last], 4),
    dea: round(dea[last], 4),
    hist: round((dif[last] - dea[last]) * 2, 4),
    prevHist: round((dif[prev] - dea[prev]) * 2, 4),
  }
}

export interface KdjResult {
  k: number
  d: number
  j: number
}

/** KDJ(9, 3, 3) */
export function kdj(candles: Candle[], period = 9): KdjResult | null {
  if (candles.length < period) return null
  let k = 50
  let d = 50
  for (let i = period - 1; i < candles.length; i += 1) {
    const window = candles.slice(i - period + 1, i + 1)
    const highest = Math.max(...window.map((c) => c.high))
    const lowest = Math.min(...window.map((c) => c.low))
    const rsv = highest === lowest ? 50 : ((candles[i].close - lowest) / (highest - lowest)) * 100
    k = (2 * k + rsv) / 3
    d = (2 * d + k) / 3
  }
  return { k: round(k, 2), d: round(d, 2), j: round(3 * k - 2 * d, 2) }
}

export interface BollResult {
  mid: number
  upper: number
  lower: number
  /** 当前价在通道中的位置 0~1，>1 表示冲出上轨 */
  position: number
}

/** 布林带(20, 2) */
export function boll(closes: number[], period = 20, multiplier = 2): BollResult | null {
  const mid = sma(closes, period)
  if (mid === null) return null
  const slice = closes.slice(-period)
  const variance = slice.reduce((sum, v) => sum + (v - mid) ** 2, 0) / period
  const sd = Math.sqrt(variance)
  const upper = mid + multiplier * sd
  const lower = mid - multiplier * sd
  const price = closes[closes.length - 1]
  return {
    mid: round(mid, 2),
    upper: round(upper, 2),
    lower: round(lower, 2),
    position: round((price - lower) / (upper - lower || 1), 4),
  }
}

/** ATR(14)，衡量平均真实波幅 */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trueRanges: number[] = []
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i]
    const previous = candles[i - 1]
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    )
  }
  let value = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trueRanges.length; i += 1) value = (value * (period - 1) + trueRanges[i]) / period
  return round(value, 3)
}

/** 价格在最近 N 日区间中的位置：0 = 区间最低，1 = 区间最高 */
export function rangePosition(closes: number[], period = 60): number | null {
  if (closes.length < 2) return null
  const slice = closes.slice(-period)
  const highest = Math.max(...slice)
  const lowest = Math.min(...slice)
  if (highest === lowest) return 0.5
  return round((slice[slice.length - 1] - lowest) / (highest - lowest), 4)
}

/** 距最近 N 日最高价的回撤幅度（正数表示低于高点多少 %） */
export function drawdownFromHigh(closes: number[], period = 60): number | null {
  if (!closes.length) return null
  const highest = Math.max(...closes.slice(-period))
  if (highest <= 0) return null
  return round(((highest - closes[closes.length - 1]) / highest) * 100, 2)
}

/** 量比：当日成交量 / 过去 N 日平均成交量 */
export function volumeRatio(candles: Candle[], period = 5): number | null {
  if (candles.length < period + 1) return null
  const current = candles[candles.length - 1].volume
  const baseline = candles.slice(-period - 1, -1).reduce((sum, c) => sum + c.volume, 0) / period
  if (baseline <= 0) return null
  return round(current / baseline, 2)
}

/** N 日涨跌幅 % */
export function changeOver(closes: number[], days: number): number | null {
  if (closes.length <= days) return null
  const base = closes[closes.length - 1 - days]
  if (base <= 0) return null
  return round(((closes[closes.length - 1] - base) / base) * 100, 2)
}

/** 年化波动率 %（按日收益率标准差 × √252） */
export function annualisedVolatility(closes: number[], period = 60): number | null {
  if (closes.length < period + 1) return null
  const returns: number[] = []
  for (let i = closes.length - period; i < closes.length; i += 1) {
    if (closes[i - 1] > 0) returns.push(Math.log(closes[i] / closes[i - 1]))
  }
  if (returns.length < 2) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100, 2)
}

/** 均线多头排列：短周期均线依次在长周期均线之上 */
export function isBullishAlignment(closes: number[], periods = [5, 10, 20, 60]): boolean {
  const mas = periods.map((p) => sma(closes, p))
  if (mas.some((m) => m === null)) return false
  for (let i = 1; i < mas.length; i += 1) {
    if ((mas[i] as number) >= (mas[i - 1] as number)) return false
  }
  return true
}

/** 均线空头排列 */
export function isBearishAlignment(closes: number[], periods = [5, 10, 20, 60]): boolean {
  const mas = periods.map((p) => sma(closes, p))
  if (mas.some((m) => m === null)) return false
  for (let i = 1; i < mas.length; i += 1) {
    if ((mas[i] as number) <= (mas[i - 1] as number)) return false
  }
  return true
}

export interface IndicatorSnapshot {
  ma5: number | null
  ma10: number | null
  ma20: number | null
  ma60: number | null
  rsi14: number | null
  macd: MacdResult | null
  kdj: KdjResult | null
  boll: BollResult | null
  atr14: number | null
  volumeRatio5: number | null
  rangePosition60: number | null
  drawdownFromHigh60: number | null
  change5d: number | null
  change20d: number | null
  volatility60d: number | null
  bullishAlignment: boolean
  bearishAlignment: boolean
}

/** 一次算出全部指标；数据不足时对应字段为 null，由调用方决定是否降级 */
export function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close)
  return {
    ma5: sma(closes, 5),
    ma10: sma(closes, 10),
    ma20: sma(closes, 20),
    ma60: sma(closes, 60),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    kdj: kdj(candles),
    boll: boll(closes),
    atr14: atr(candles),
    volumeRatio5: volumeRatio(candles),
    rangePosition60: rangePosition(closes, 60),
    drawdownFromHigh60: drawdownFromHigh(closes, 60),
    change5d: changeOver(closes, 5),
    change20d: changeOver(closes, 20),
    volatility60d: annualisedVolatility(closes, 60),
    bullishAlignment: isBullishAlignment(closes),
    bearishAlignment: isBearishAlignment(closes),
  }
}
