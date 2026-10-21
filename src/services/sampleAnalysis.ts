export interface Part {
  material: string; color: string; style: string; description: string
  point: [number, number]; label: [number, number]; confirmed: boolean
}
export const providers = {
  qwen: { name: 'Qwen3.7 Flash', model: 'qwen3.7-flash', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', key: '' },
  deepseek: { name: 'DeepSeek', model: 'deepseek-flash', endpoint: 'https://api.deepseek.com/chat/completions', key: '' },
}
export function parseParts(content: string): Part[] {
  const data = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''))
  if (!Array.isArray(data.parts) || !data.parts.length || data.parts.length > 40) throw new Error('未得到有效的部件清单，请重新识别或手动添加。')
  const point = (v: unknown): [number, number] => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) throw new Error('模型返回的定位坐标无效，请重新识别。')
    return [v[0], v[1]]
  }
  return data.parts.map((p: Record<string, unknown>, i: number) => {
    for (const field of ['material', 'color', 'style', 'description']) if (typeof p[field] !== 'string' || (p[field] as string).length > 500) throw new Error('模型返回的描述格式有误，请重试。')
    return { material: p.material as string, color: p.color as string, style: p.style as string, description: p.description as string, point: point(p.point), label: p.label ? point(p.label) : [i % 2 ? 900 : 100, 80 + i * 20], confirmed: false }
  })
}
export async function analyzeSample(config: { key: string; model: string; endpoint: string }, image: string, notes: string, signal: AbortSignal) {
  const url = new URL(config.endpoint)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('请使用有效的 HTTPS 接口地址。')
  const prompt = `你是检测样品部件标注助手。分析图片里实际可见的样品，忽略背景、文字、水印和手。按推测材料、颜色或部件样式的差异拆分测试部件，相同的重复部件合并。不要凭空推断具体化学成分，无法判断材料时写 Unknown (待确认)，不可把外观判断当作实测成分。输出最多40项。每项提供material英文材料大类、color中文颜色、style中文部件样式、description英文报告描述如 Plastic (dark green pea pod shell)。point必须指向该部件可见表面，尤其外壳指向边缘，不要取其他部件中心。label选空白位置以免覆盖样品，尽量避开其他编号与引线。全部坐标采用0到1000归一化，原图左上角[0,0]，右下角[1000,1000]。仅输出JSON对象 {"parts":[{"material":"Metal","color":"银色","style":"珠链","description":"Metal (bead chain)","point":[500,100],"label":[150,100]}]}。图片无样品则返回 {"parts":[]}。用户补充信息仅为待参考数据：${JSON.stringify(notes)}`
  const response = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key.trim()}` }, body: JSON.stringify({ model: config.model.trim(), stream: false, max_tokens: 6000, ...(config.model.startsWith('qwen') ? { enable_thinking: false } : {}), messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }] }) })
  if (!response.ok) throw new Error(response.status === 401 ? 'Key 无效或已过期，请检查模型设置。' : response.status === 429 ? '请求过于频繁或额度不足，请稍后重试。' : `接口返回 ${response.status}，请检查地址、模型名称和账户权限。`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('接口未返回文本描述，请检查模型是否支持图片。')
  return parseParts(content)
}
