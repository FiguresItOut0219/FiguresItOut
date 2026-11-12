/**
 * 股票分析规则引擎。
 *
 * ⚠️ 这不是 LLM。它是一个完全确定性的技术指标评分模型：
 * 所有输入都来自真实 K 线（见 marketApi.ts），每一项结论都能指回具体指标数值。
 * 页面会如实标注「技术指标规则引擎」，不会伪装成 AI 生成的分析。
 *
 * 设计原则：先算指标 → 逐条给出信号（含方向与权重）→ 汇总为评分 → 再由评分映射评级。
 * 每条风险/催化都必须绑定一个真实数值，不允许出现无依据的定性描述。
 */

import { computeIndicators, type Candle, type IndicatorSnapshot } from './indicators'
import type { StockQuote } from './marketApi'

export type Rating = '买入' | '增持' | '观望' | '减持' | '卖出'
export type Trend = '多头' | '震荡偏强' | '震荡' | '震荡偏弱' | '空头'

export interface Signal {
  label: string
  detail: string
  kind: 'bullish' | 'bearish' | 'neutral'
  /** 对基础分（50）的加减量 */
  weight: number
}

export interface ReferenceLevels {
  /** 参考支撑 */
  support: number | null
  /** 参考压力 */
  resistance: number | null
  /** 建议止损位（价格 - 1.5 × ATR） */
  stopLoss: number | null
  /** 参考目标位（价格 + 2 × ATR） */
  target: number | null
}

export interface StockAnalysis {
  code: string
  name: string
  market: string
  price: number
  changePct: number
  score: number
  rating: Rating
  trend: Trend
  signals: Signal[]
  risks: string[]
  catalysts: string[]
  checklist: string[]
  reference: ReferenceLevels
  indicators: IndicatorSnapshot
  /** K 线数据截止日 */
  asOf: string
  /** 指标数据是否足以支撑结论（不足 60 根 K 线时为 false） */
  sufficient: boolean
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits

function ratingFromScore(score: number): Rating {
  if (score >= 78) return '买入'
  if (score >= 62) return '增持'
  if (score >= 45) return '观望'
  if (score >= 30) return '减持'
  return '卖出'
}

function trendFrom(indicators: IndicatorSnapshot, price: number): Trend {
  const { ma20, ma60, bullishAlignment, bearishAlignment } = indicators
  const above20 = ma20 === null ? null : price > ma20
  const above60 = ma60 === null ? null : price > ma60
  if (bullishAlignment && above20) return '多头'
  if (bearishAlignment && above20 === false) return '空头'
  if (above20 && above60) return '震荡偏强'
  if (above20 === false && above60 === false) return '震荡偏弱'
  return '震荡'
}

function collectSignals(quote: StockQuote, indicators: IndicatorSnapshot): Signal[] {
  const signals: Signal[] = []
  const { price, changePct } = quote

  /* ---- 趋势结构 ---- */
  if (indicators.bullishAlignment) {
    signals.push({ label: '均线多头排列', detail: 'MA5 > MA10 > MA20 > MA60，短中期趋势向上', kind: 'bullish', weight: 14 })
  } else if (indicators.bearishAlignment) {
    signals.push({ label: '均线空头排列', detail: 'MA5 < MA10 < MA20 < MA60，短中期趋势向下', kind: 'bearish', weight: -14 })
  }

  if (indicators.ma20 !== null) {
    if (price > indicators.ma20) {
      signals.push({ label: '站上 20 日线', detail: `现价 ${price} 高于 MA20 ${indicators.ma20}`, kind: 'bullish', weight: 8 })
    } else {
      signals.push({ label: '跌破 20 日线', detail: `现价 ${price} 低于 MA20 ${indicators.ma20}`, kind: 'bearish', weight: -8 })
    }
  }

  if (indicators.ma60 !== null) {
    if (price > indicators.ma60) {
      signals.push({ label: '位于 60 日线上方', detail: `MA60 ${indicators.ma60}，中期成本线形成支撑`, kind: 'bullish', weight: 6 })
    } else {
      signals.push({ label: '位于 60 日线下方', detail: `MA60 ${indicators.ma60}，中期成本线构成压力`, kind: 'bearish', weight: -6 })
    }
  }

  if (indicators.ma5 !== null && indicators.ma10 !== null) {
    if (indicators.ma5 > indicators.ma10) {
      signals.push({ label: '短期均线金叉', detail: `MA5 ${indicators.ma5} 上穿 MA10 ${indicators.ma10}`, kind: 'bullish', weight: 6 })
    } else {
      signals.push({ label: '短期均线死叉', detail: `MA5 ${indicators.ma5} 下穿 MA10 ${indicators.ma10}`, kind: 'bearish', weight: -6 })
    }
  }

  /* ---- 动量 ---- */
  const { macd } = indicators
  if (macd) {
    if (macd.hist > 0 && macd.prevHist <= 0) {
      signals.push({ label: 'MACD 金叉', detail: `DIF ${macd.dif} 上穿 DEA ${macd.dea}，柱状图转正`, kind: 'bullish', weight: 8 })
    } else if (macd.hist < 0 && macd.prevHist >= 0) {
      signals.push({ label: 'MACD 死叉', detail: `DIF ${macd.dif} 下穿 DEA ${macd.dea}，柱状图转负`, kind: 'bearish', weight: -8 })
    } else if (macd.hist > 0) {
      signals.push({ label: 'MACD 多头延续', detail: `柱状图 ${macd.hist} 维持正值`, kind: 'bullish', weight: 4 })
    } else {
      signals.push({ label: 'MACD 空头延续', detail: `柱状图 ${macd.hist} 维持负值`, kind: 'bearish', weight: -4 })
    }
  }

  const { rsi14 } = indicators
  if (rsi14 !== null) {
    if (rsi14 >= 70) {
      signals.push({ label: 'RSI 超买', detail: `RSI14 = ${rsi14}，处于 70 以上的超买区`, kind: 'bearish', weight: -8 })
    } else if (rsi14 >= 60) {
      signals.push({ label: 'RSI 强势', detail: `RSI14 = ${rsi14}，多方占优但未极端`, kind: 'bullish', weight: 5 })
    } else if (rsi14 > 45) {
      signals.push({ label: 'RSI 中性', detail: `RSI14 = ${rsi14}，多空力量均衡`, kind: 'neutral', weight: 0 })
    } else if (rsi14 > 30) {
      signals.push({ label: 'RSI 偏弱', detail: `RSI14 = ${rsi14}，空方占优`, kind: 'bearish', weight: -4 })
    } else {
      signals.push({ label: 'RSI 超卖', detail: `RSI14 = ${rsi14}，处于 30 以下的超卖区`, kind: 'bearish', weight: -6 })
    }
  }

  const { kdj } = indicators
  if (kdj) {
    if (kdj.j >= 100) {
      signals.push({ label: 'KDJ 高位', detail: `J 值 ${kdj.j} 超过 100，短线过热`, kind: 'bearish', weight: -4 })
    } else if (kdj.j <= 0) {
      signals.push({ label: 'KDJ 低位', detail: `J 值 ${kdj.j} 低于 0，短线超卖`, kind: 'bullish', weight: 3 })
    } else if (kdj.k > kdj.d) {
      signals.push({ label: 'KDJ 金叉状态', detail: `K ${kdj.k} 在 D ${kdj.d} 之上`, kind: 'bullish', weight: 3 })
    } else {
      signals.push({ label: 'KDJ 死叉状态', detail: `K ${kdj.k} 在 D ${kdj.d} 之下`, kind: 'bearish', weight: -3 })
    }
  }

  /* ---- 量能 ---- */
  const { volumeRatio5 } = indicators
  if (volumeRatio5 !== null) {
    const expanding = volumeRatio5 >= 1.2
    if (volumeRatio5 > 3) {
      signals.push({
        label: '异常放量',
        detail: `量比 ${volumeRatio5}，成交较 5 日均量放大 ${round(volumeRatio5, 2)} 倍，需警惕分歧`,
        kind: 'neutral',
        weight: -2,
      })
    } else if (expanding && changePct > 0) {
      signals.push({ label: '放量上涨', detail: `量比 ${volumeRatio5} 且当日上涨 ${changePct}%，量价配合良好`, kind: 'bullish', weight: 8 })
    } else if (expanding && changePct < 0) {
      signals.push({ label: '放量下跌', detail: `量比 ${volumeRatio5} 且当日下跌 ${changePct}%，抛压较重`, kind: 'bearish', weight: -8 })
    } else if (volumeRatio5 < 0.6) {
      signals.push({ label: '明显缩量', detail: `量比 ${volumeRatio5}，市场关注度下降`, kind: 'bearish', weight: -5 })
    } else {
      signals.push({ label: '量能平稳', detail: `量比 ${volumeRatio5}，成交处于近期正常水平`, kind: 'neutral', weight: 0 })
    }
  }

  /* ---- 位置与波动 ---- */
  const { rangePosition60, drawdownFromHigh60, boll: bollResult, volatility60d, change20d } = indicators
  if (rangePosition60 !== null) {
    if (rangePosition60 > 0.85) {
      signals.push({ label: '处于阶段高位', detail: `现价位于近 60 日区间的 ${round(rangePosition60 * 100, 1)}% 分位`, kind: 'bearish', weight: -8 })
    } else if (rangePosition60 < 0.25) {
      signals.push({ label: '处于阶段低位', detail: `现价位于近 60 日区间的 ${round(rangePosition60 * 100, 1)}% 分位`, kind: 'bullish', weight: 5 })
    }
  }

  if (drawdownFromHigh60 !== null && drawdownFromHigh60 > 20) {
    signals.push({ label: '深度回撤', detail: `较 60 日高点回撤 ${drawdownFromHigh60}%，趋势尚未修复`, kind: 'bearish', weight: -5 })
  }

  if (bollResult) {
    if (bollResult.position > 0.95) {
      signals.push({ label: '触及布林上轨', detail: `价格冲出上轨 ${bollResult.upper}，短线偏离加大`, kind: 'bearish', weight: -4 })
    } else if (bollResult.position < 0.1) {
      signals.push({ label: '回落至布林下轨', detail: `价格接近下轨 ${bollResult.lower}，存在均值回归可能`, kind: 'bullish', weight: 3 })
    }
  }

  if (volatility60d !== null && volatility60d > 55) {
    signals.push({ label: '高波动', detail: `60 日年化波动率 ${volatility60d}%，仓位需相应控制`, kind: 'neutral', weight: -3 })
  }

  if (change20d !== null && change20d < -15) {
    signals.push({ label: '20 日跌幅较大', detail: `近 20 个交易日下跌 ${Math.abs(change20d)}%`, kind: 'bearish', weight: -4 })
  } else if (change20d !== null && change20d > 15) {
    signals.push({ label: '20 日涨幅较大', detail: `近 20 个交易日上涨 ${change20d}%，注意获利盘`, kind: 'neutral', weight: -2 })
  }

  return signals
}

function buildReferenceLevels(price: number, indicators: IndicatorSnapshot): ReferenceLevels {
  const atr = indicators.atr14
  const supportCandidates = [indicators.ma20, indicators.boll?.lower, indicators.ma60].filter(
    (value): value is number => typeof value === 'number' && value > 0 && value < price,
  )
  const resistanceCandidates = [indicators.boll?.upper, indicators.ma60].filter(
    (value): value is number => typeof value === 'number' && value > price,
  )
  return {
    support: supportCandidates.length ? round(Math.max(...supportCandidates), 2) : null,
    resistance: resistanceCandidates.length ? round(Math.min(...resistanceCandidates), 2) : null,
    stopLoss: atr ? round(price - 1.5 * atr, 2) : null,
    target: atr ? round(price + 2 * atr, 2) : null,
  }
}

function buildChecklist(trend: Trend, reference: ReferenceLevels, indicators: IndicatorSnapshot, price: number): string[] {
  const items: string[] = []
  if (reference.stopLoss !== null) items.push(`把 ${reference.stopLoss} 作为止损参考位，跌破且无法快速收回时执行减仓`)
  if (reference.resistance !== null) items.push(`上方压力关注 ${reference.resistance}，冲高不放量时谨慎追入`)
  if (reference.support !== null) items.push(`回踩 ${reference.support} 附近缩量止跌，才是相对合理的分批位置`)
  if (indicators.rsi14 !== null && indicators.rsi14 > 70) items.push('RSI 已在超买区，避免在情绪高点一次性建仓')
  if (indicators.volumeRatio5 !== null && indicators.volumeRatio5 < 0.8) items.push('当前缩量，等待量能重新放大再确认方向')
  if (trend === '空头' || trend === '震荡偏弱') items.push('中期趋势尚未走强，仓位控制在轻仓，以观察为主')
  if (trend === '多头') items.push('趋势向上可持有为主，但移动止损位跟随上移')
  if (indicators.atr14 !== null) items.push(`日均波幅约 ${round((indicators.atr14 / price) * 100, 2)}%，据此估算单笔仓位敞口`)
  return items
}

export function analyseStock(quote: StockQuote, candles: Candle[]): StockAnalysis {
  const indicators = computeIndicators(candles)
  const signals = collectSignals(quote, indicators)
  const rawScore = signals.reduce((sum, signal) => sum + signal.weight, 50)
  const score = Math.round(clamp(rawScore))
  const rating = ratingFromScore(score)
  const trend = trendFrom(indicators, quote.price)
  const reference = buildReferenceLevels(quote.price, indicators)

  const risks = signals.filter((signal) => signal.kind === 'bearish').map((signal) => `${signal.label}：${signal.detail}`)
  const catalysts = signals.filter((signal) => signal.kind === 'bullish').map((signal) => `${signal.label}：${signal.detail}`)

  return {
    code: quote.code,
    name: quote.name,
    market: quote.market,
    price: quote.price,
    changePct: quote.changePct,
    score,
    rating,
    trend,
    signals,
    risks: risks.length ? risks : ['当前未触发明显风险信号，但指标平静不代表没有风险，仍需结合基本面与大盘环境判断'],
    catalysts: catalysts.length ? catalysts : ['当前未触发明显向好信号，等待趋势或量能出现确认'],
    checklist: buildChecklist(trend, reference, indicators, quote.price),
    reference,
    indicators,
    asOf: candles.length ? candles[candles.length - 1].date : '',
    sufficient: candles.length >= 60,
  }
}

/** 一段人类可读的摘要，对应原项目的「重要信息速览」 */
export function summarise(analysis: StockAnalysis): string {
  const { name, price, changePct, rating, score, trend } = analysis
  const direction = changePct >= 0 ? '上涨' : '下跌'
  const top = analysis.signals.slice().sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 2)
  const lead = top.map((signal) => signal.label).join('、') || '指标信号不足'
  return `${name}现价 ${price}，当日${direction} ${Math.abs(changePct)}%。技术面综合评分 ${score}/100，评级「${rating}」，趋势判定「${trend}」。主要依据：${lead}。以上为技术指标规则引擎基于 ${analysis.asOf || '最新'} 收盘数据的计算结果，不构成投资建议。`
}

export const RATING_ORDER: Rating[] = ['买入', '增持', '观望', '减持', '卖出']
