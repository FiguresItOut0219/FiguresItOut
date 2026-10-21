import type { Part } from './sampleAnalysis'
export type ReportLanguage = 'en' | 'zh'
export function chineseDescription(part: Part): string {
  if (part.descriptionZh?.trim()) return part.descriptionZh.trim()
  const materials: Record<string, string> = { metal: '金属', plastic: '塑料', rubber: '橡胶', silicone: '硅胶', wood: '木材', glass: '玻璃', textile: '纺织物', paper: '纸', unknown: '未知材料（待确认）' }
  const material = materials[part.material.trim().toLowerCase()] || part.material
  const detail = [part.color, part.style].filter(Boolean).join('')
  return detail ? `${material}（${detail}）` : material
}
export function formatSampleReport(parts: Part[], language: ReportLanguage): string {
  return [language === 'en' ? 'Tested part(s) description' : '测试部件描述', ...parts.map((part, index) => `${index + 1} ${language === 'en' ? part.description : chineseDescription(part)}`)].join('\n')
}
