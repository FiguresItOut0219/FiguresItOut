/**
 * 策略问股 —— 本地规则引擎，不调用任何大模型。
 *
 * 与 daily_stock_analysis 的「Agent 策略问股」对应，但那个项目靠 LLM 理解自然语言；
 * 这里是关键词路由 + 确定性策略筛选，每条回答都能指回真实指标。
 * 页面上会明确标注这一点，不伪装成 AI 生成。
 */

import type { MarketSnapshot, StockQuote } from './marketApi'
import type { StockAnalysis } from './stockAnalysis'

export interface Strategy {
  id: string
  name: string
  description: string
}

export const STRATEGIES: Strategy[] = [
  { id: 'ma_golden', name: '均线金叉', description: 'MA5 上穿 MA10 且 MACD 柱状图为正，短线转强' },
  { id: 'bull_trend', name: '多头趋势', description: 'MA5/10/20/60 多头排列，顺势跟随' },
  { id: 'volume_price', name: '量价齐升', description: '当日上涨且量比大于 1.2，资金进场明确' },
  { id: 'oversold', name: '超跌反弹', description: 'RSI14 低于 35 且较高点回撤超过 15%，博反转' },
  { id: 'low_position', name: '低位布局', description: '位于 60 日区间 30% 分位以下，风险收益比相对占优' },
  { id: 'breakout', name: '突破压力', description: '价格处于 60 日区间 90% 分位以上或触及布林上轨' },
  { id: 'macd_momentum', name: 'MACD 动量', description: 'MACD 柱状图最强，短期动能领先' },
  { id: 'steady', name: '稳健低波', description: '60 日年化波动率最低，适合作为底仓' },
  { id: 'risk_control', name: '风险规避', description: '剔除空头排列、超买或深度回撤的标的' },
  { id: 'overall', name: '综合评分', description: '按技术面综合评分从高到低排列' },
]

export interface AgentContext {
  quotes: StockQuote[]
  analyses: StockAnalysis[]
  snapshot: MarketSnapshot | null
}

export interface StrategyResult {
  strategy: Strategy
  picks: StockAnalysis[]
  note: string
}

const byScore = (a: StockAnalysis, b: StockAnalysis) => b.score - a.score

function applyOne(strategyId: string, analyses: StockAnalysis[]): StrategyResult {
  const strategy = STRATEGIES.find((item) => item.id === strategyId) ?? STRATEGIES[STRATEGIES.length - 1]
  let picks: StockAnalysis[] = []
  let note = ''

  switch (strategy.id) {
    case 'ma_golden': {
      picks = analyses
        .filter((a) => a.indicators.ma5 !== null && a.indicators.ma10 !== null && a.indicators.ma5 > a.indicators.ma10 && (a.indicators.macd?.hist ?? -1) > 0)
        .sort(byScore)
      note = '同时满足短期均线金叉与 MACD 柱状图为正的标的'
      break
    }
    case 'bull_trend': {
      picks = analyses.filter((a) => a.indicators.bullishAlignment).sort((a, b) => (b.indicators.change20d ?? 0) - (a.indicators.change20d ?? 0))
      note = '四条均线呈多头排列，按 20 日涨幅排序'
      break
    }
    case 'volume_price': {
      picks = analyses.filter((a) => (a.indicators.volumeRatio5 ?? 0) > 1.2 && a.changePct > 0).sort(byScore)
      note = '当日上涨且量比超过 1.2'
      break
    }
    case 'oversold': {
      picks = analyses.filter((a) => (a.indicators.rsi14 ?? 100) < 35 && (a.indicators.drawdownFromHigh60 ?? 0) > 15).sort((a, b) => (a.indicators.rsi14 ?? 0) - (b.indicators.rsi14 ?? 0))
      note = 'RSI14 低于 35 且较 60 日高点回撤超过 15%'
      break
    }
    case 'low_position': {
      picks = analyses.filter((a) => (a.indicators.rangePosition60 ?? 1) < 0.3).sort((a, b) => (a.indicators.rangePosition60 ?? 1) - (b.indicators.rangePosition60 ?? 1))
      note = '现价位于近 60 日区间 30% 分位以下'
      break
    }
    case 'breakout': {
      picks = analyses.filter((a) => (a.indicators.rangePosition60 ?? 0) > 0.9 || (a.indicators.boll?.position ?? 0) > 0.95).sort(byScore)
      note = '价格处于 60 日区间 90% 分位以上或已触及布林上轨'
      break
    }
    case 'macd_momentum': {
      picks = analyses.filter((a) => (a.indicators.macd?.hist ?? -999) > 0).sort((a, b) => (b.indicators.macd?.hist ?? 0) - (a.indicators.macd?.hist ?? 0))
      note = '按 MACD 柱状图数值从高到低排列'
      break
    }
    case 'steady': {
      picks = analyses.filter((a) => a.rating !== '卖出').sort((a, b) => (a.indicators.volatility60d ?? 999) - (b.indicators.volatility60d ?? 999))
      note = '剔除评级为「卖出」的标的后，按 60 日年化波动率从低到高排列'
      break
    }
    case 'risk_control': {
      picks = analyses
        .filter((a) => !a.indicators.bearishAlignment && (a.indicators.rsi14 ?? 100) < 70 && (a.indicators.drawdownFromHigh60 ?? 100) < 25)
        .sort(byScore)
      note = '已剔除空头排列、RSI 超买、较 60 日高点回撤超过 25% 的标的'
      break
    }
    default: {
      picks = analyses.slice().sort(byScore)
      note = '按技术面综合评分从高到低排列'
    }
  }

  return { strategy, picks, note: picks.length ? note : `${note}。当前自选股中没有满足条件的标的` }
}

export function applyStrategy(strategyId: string, ctx: AgentContext): StrategyResult {
  return applyOne(strategyId, ctx.analyses)
}

function formatMarket(ctx: AgentContext): string {
  const { snapshot } = ctx
  if (!snapshot || !snapshot.indices.length) return '大盘数据还没有加载完成，请稍后重试。'
  const indexLines = snapshot.indices.map((item) => `${item.name} ${item.price}（${item.changePct >= 0 ? '+' : ''}${item.changePct}%）`).join('，')
  const { breadth } = snapshot
  const upSectors = snapshot.sectorsUp.slice(0, 3).map((item) => `${item.name} ${item.changePct >= 0 ? '+' : ''}${item.changePct}%`).join('，')
  const downSectors = snapshot.sectorsDown.slice(0, 3).map((item) => `${item.name} ${item.changePct}%`).join('，')
  return [
    `主要指数：${indexLines}。`,
    breadth
      ? `全市场上涨 ${breadth.up} 家、下跌 ${breadth.down} 家、平盘 ${breadth.flat} 家，涨停 ${breadth.limitUp} 家、跌停 ${breadth.limitDown} 家。`
      : '涨跌家数暂不可用。',
    upSectors ? `领涨板块：${upSectors}。` : '',
    downSectors ? `领跌板块：${downSectors}。` : '',
    `数据截至北京时间 ${snapshot.updatedAt}，来源为东方财富公开行情接口。`,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatRanking(ctx: AgentContext): string {
  if (!ctx.analyses.length) return '自选股分析还没有完成，请先在「决策仪表盘」加载数据。'
  const ranked = ctx.analyses.slice().sort(byScore)
  const lines = ranked.map((item, index) => `${index + 1}. ${item.name}（${item.code}）评分 ${item.score}，评级「${item.rating}」，趋势「${item.trend}」，现价 ${item.price}`)
  return `当前自选股技术面排名：\n${lines.join('\n')}\n\n评分来自趋势、动量、量能、位置四个维度共 ${ranked[0].signals.length} 项指标的加权求和，满分 100。`
}

function formatRisks(ctx: AgentContext): string {
  if (!ctx.analyses.length) return '自选股分析还没有完成，请先在「决策仪表盘」加载数据。'
  const withRisk = ctx.analyses.filter((item) => item.risks.length && !item.risks[0].startsWith('当前未触发'))
  if (!withRisk.length) return '当前自选股均未触发明显风险信号。注意：指标平静不代表没有风险，仍需结合基本面、公告与大盘环境判断。'
  const lines = withRisk.map((item) => `【${item.name}】${item.risks.slice(0, 2).join('；')}`)
  return `触发的风险信号如下：\n${lines.join('\n')}`
}

function formatSingle(name: string, ctx: AgentContext): string | null {
  const keyword = name.trim()
  if (!keyword) return null
  const target = ctx.analyses.find((item) => item.name.includes(keyword) || item.code === keyword.toUpperCase())
  if (!target) return null
  const { indicators } = target
  const details = [
    `现价 ${target.price}，当日 ${target.changePct >= 0 ? '+' : ''}${target.changePct}%`,
    `评分 ${target.score}/100，评级「${target.rating}」，趋势「${target.trend}」`,
    `MA5/10/20/60：${indicators.ma5 ?? '—'} / ${indicators.ma10 ?? '—'} / ${indicators.ma20 ?? '—'} / ${indicators.ma60 ?? '—'}`,
    `RSI14 ${indicators.rsi14 ?? '—'}，MACD 柱状图 ${indicators.macd?.hist ?? '—'}`,
    `量比 ${indicators.volumeRatio5 ?? '—'}，60 日区间位置 ${indicators.rangePosition60 !== null ? `${Math.round(indicators.rangePosition60 * 100)}%` : '—'}`,
    target.reference.stopLoss !== null ? `止损参考 ${target.reference.stopLoss}，目标参考 ${target.reference.target}` : '',
    target.sufficient ? '' : '⚠️ K 线数据不足 60 根，指标覆盖不完整，结论仅供参考。',
  ]
    .filter(Boolean)
    .join('\n')
  return `${target.name}（${target.code}）技术面：\n${details}\n\n主要依据：${target.signals.slice(0, 3).map((s) => s.label).join('、') || '无'}。以上不构成投资建议。`
}

function formatStrategyAnswer(strategyId: string, ctx: AgentContext): string {
  const result = applyStrategy(strategyId, ctx)
  if (!result.picks.length) return `按「${result.strategy.name}」筛选：${result.note}`
  const lines = result.picks.map((item, index) => `${index + 1}. ${item.name}（${item.code}）评分 ${item.score}，${item.price}，${item.changePct >= 0 ? '+' : ''}${item.changePct}%`)
  return `策略「${result.strategy.name}」——${result.strategy.description}\n${result.note}\n\n${lines.join('\n')}\n\n筛选基于真实 K 线计算的指标，不构成投资建议。`
}

const HELP = `我可以回答这几类问题：\n\n1. 大盘怎么样 / 今天市场如何 —— 指数、涨跌家数、领涨领跌板块\n2. 排名 / 排序 / 哪只最强 —— 按技术面综合评分排列自选股\n3. 风险 —— 当前自选股触发的风险信号\n4. 直接输入股票名称或代码，如「贵州茅台」「600519」\n5. 策略名，如「均线金叉」「超跌反弹」「多头趋势」「量价齐升」\n\n可用策略：${STRATEGIES.map((item) => item.name).join('、')}\n\n说明：我由本地规则引擎驱动，不做自然语言理解，也不调用大模型。所有数字都来自真实行情与技术指标计算。`

export function answerQuestion(question: string, ctx: AgentContext): string {
  const text = question.trim()
  if (!text) return '请输入你的问题。'
  if (/^(帮助|help|？|\?)$/i.test(text) || /怎么用|能做什么|如何使用/.test(text)) return HELP

  if (/大盘|市场|行情|今天|涨幅|涨跌家数|情绪/.test(text)) return formatMarket(ctx)
  if (/风险|危险|谨慎|回避|止损/.test(text)) return formatRisks(ctx)
  if (/排名|排序|最强|最弱|最好|最差|推荐|选股/.test(text)) return formatRanking(ctx)

  const strategy = STRATEGIES.find((item) => text.includes(item.name) || text.includes(item.id))
  if (strategy) return formatStrategyAnswer(strategy.id, ctx)

  const single = formatSingle(text, ctx)
  if (single) return single

  return `我没理解这个问题。可以试试：\n· 「大盘怎么样」\n· 「排名」\n· 「风险」\n· 「贵州茅台」或「600519」\n· 策略名：${STRATEGIES.slice(0, 5).map((item) => item.name).join('、')}\n\n输入「帮助」查看完整说明。`
}
