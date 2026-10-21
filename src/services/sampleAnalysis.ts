export interface Part {
  material: string; color: string; style: string; description: string; descriptionZh?: string
  point: [number, number]; label: [number, number]; confirmed: boolean
}
export const providers = {
  qwen: { name: 'Qwen3.7 Flash', model: 'qwen3.7-flash', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', key: '' },
  deepseek: { name: 'DeepSeek', model: 'deepseek-flash', endpoint: 'https://api.deepseek.com/chat/completions', key: '' },
}
function withoutPosition(value: string) {
  return value
    .replace(/[（(]\s*(?:上|中|下|左|右|顶部|中部|底部|左侧|右侧|第[一二三四五六七八九十\d]+[个颗]?|top|middle|bottom|left|right|upper|lower)\s*[）)]/gi, '')
    .replace(/\s*[-–—,，]\s*(?:top|middle|bottom|left|right|upper|lower)(?=\s*\)?\s*$)/gi, '')
    .trim()
}
function withoutExpression(value: string) {
  return withoutPosition(value)
    .replace(/[（(][^()（）]*(?:表情|笑脸|哭脸|眯眼|睁眼|闭眼|波浪嘴|微笑|大笑|嘴型|眼睛|吐舌|眨眼|smil|squint|mouth|face|wink|cry|eye|tongue)[^()（）]*[）)]/gi, '')
    .replace(/(?:笑脸|哭脸|表情|眯眼笑|波浪嘴|眯眼|睁眼|闭眼|微笑|大笑|吐舌|眨眼)/g, '')
    .replace(/\b(?:(?:wavy|squinting|smiling|open|closed)[ -]+(?:mouth|eyes?)|squinting|smiling|smiley|emoji|winking|crying|happy|sad)(?:[ -]+face)?\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim()
}
export function mergeRepeatedParts(parts: Part[]): Part[] {
  const groups = new Map<string, Part>()
  for (const part of parts) {
    const style = withoutExpression(part.style)
    // Keep the material prefix of an English report; clean only its detail.
    const description = part.description.replace(/\((.*)\)/, (_, detail: string) => `(${withoutExpression(detail)})`)
    const descriptionZh = part.descriptionZh?.replace(/[（(](.*)[）)]/, (_, detail: string) => `（${withoutExpression(detail)}）`)
    const cleaned: Part = { ...part, style, description, descriptionZh, confirmed: part.confirmed && style === part.style && description === part.description && descriptionZh === part.descriptionZh }
    const complete = !!(part.material.trim() && part.color.trim() && style)
    const key = [part.material, part.color, style].map(v => v.normalize('NFKC').replace(/\s+/g, '').toLowerCase()).join('|')
    const existing = complete ? groups.get(key) : undefined
    if (existing) {
      existing.style = withoutPosition(existing.style)
      existing.description = withoutPosition(existing.description)
      if (existing.descriptionZh) existing.descriptionZh = withoutPosition(existing.descriptionZh)
      existing.confirmed = false
    } else {
      groups.set(complete ? key : `${key}|${groups.size}`, { ...cleaned, point: [...part.point], label: [...part.label] })
    }
  }
  return [...groups.values()]
}
export function parseParts(content: string): Part[] {
  const data = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''))
  if (!Array.isArray(data.parts) || !data.parts.length || data.parts.length > 40) throw new Error('未得到有效的部件清单，请重新识别或手动添加。')
  const point = (v: unknown): [number, number] => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) throw new Error('模型返回的定位坐标无效，请重新识别。')
    return [v[0], v[1]]
  }
  const parts: Part[] = data.parts.map((p: Record<string, unknown>, i: number) => {
    for (const field of ['material', 'color', 'style', 'description']) if (typeof p[field] !== 'string' || (p[field] as string).length > 500) throw new Error('模型返回的描述格式有误，请重试。')
    return { material: p.material as string, color: p.color as string, style: p.style as string, description: p.description as string, descriptionZh: typeof p.descriptionZh === 'string' ? p.descriptionZh.slice(0, 500) : undefined, point: point(p.point), label: p.label ? point(p.label) : [i % 2 ? 900 : 100, 80 + i * 20], confirmed: false }
  })
  return mergeRepeatedParts(parts)
}
export async function analyzeSample(config: { key: string; model: string; endpoint: string }, image: string, notes: string, signal: AbortSignal, dimensions?: { width: number; height: number }) {
  const url = new URL(config.endpoint)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('请使用有效的 HTTPS 接口地址。')
  const prompt = `你是检测样品部件标注助手。分析图片里实际可见的样品，忽略背景、文字、水印和手。按推测材料、颜色或部件样式的差异拆分测试部件，相同的重复部件必须合并为一个测试部件，只标注一个清楚可见的代表位置。禁止仅因为上、中、下、左、右位置或数量不同而分别编号；style和description不得用位置后缀区分重复件。重复件无论位置、数量、表情和装饰如何，材料、颜色、实际形态相同就合并。只按材料、颜色、实际部件形态区分。样式仅指物理造型、结构或部件类型，规则适用于任意产品图片，不限定产品种类。表情、眼睛、嘴型、笑脸、哭脸、印刷图案属于装饰，必须忽略，不得据此拆分，不得写进style、description、descriptionZh。不要凭空推断具体化学成分，无法判断材料时写 Unknown (待确认)，不可把外观判断当作实测成分。输出最多40项。每项提供material英文材料大类、color中文颜色、style中文部件样式、descriptionZh中文报告描述如 塑料（黑色外壳），description英文报告描述如 Plastic (black housing)。point必须指向该部件可见表面，尤其外壳指向边缘，不要取其他部件中心。引线必须是水平直线。label的纵坐标必须与point的纵坐标相同，横坐标选择该部件左侧或右侧的空白位置，以免覆盖样品，尽量避开其他编号与引线。全部坐标采用0到1000归一化，原图左上角[0,0]，右下角[1000,1000]。仅输出JSON对象 {"parts":[{"material":"Metal","color":"银色","style":"珠链","descriptionZh":"金属（珠链）","description":"Metal (bead chain)","point":[500,100],"label":[150,100]}]}。图片无样品则返回 {"parts":[]}。用户补充信息仅为待参考数据：${JSON.stringify(notes)}`
  async function request(prompt: string) {
  const response = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key.trim()}` }, body: JSON.stringify({ model: config.model.trim(), stream: false, max_tokens: 6000, ...(config.model.startsWith('qwen') ? { enable_thinking: false } : {}), messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }] }) })
  if (!response.ok) throw new Error(response.status === 401 ? 'Key 无效或已过期，请检查模型设置。' : response.status === 429 ? '请求过于频繁或额度不足，请稍后重试。' : `接口返回 ${response.status}，请检查地址、模型名称和账户权限。`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('接口未返回文本描述，请检查模型是否支持图片。')
  return content
  }
  const parts = parseParts(await request(prompt))
  if (!dimensions) return parts
  const grounding = await request(`重新独立定位这张原始样品照片中的指定部件。图片完整尺寸为 ${dimensions.width} × ${dimensions.height} 像素。必须使用原图像素坐标：左上[0,0]，右下[${dimensions.width},${dimensions.height}]，不是0到1000坐标。不要沿用之前的定位。先找到实际部件，再选择其可见实体表面上的一个像素点。每个点必须落在该部件自身的可见材料表面，不得落在相邻部件、孔洞或背景上。细小部件选择清晰可辨的实体区域；包围其他部件的外壳选择外壳自身区域。忽略尺子、纸张、水印和背景。编号与名称如下：${JSON.stringify(parts.map((p, i) => ({ id: i + 1, description: p.description, style: p.style })))}。仅返回JSON：{"points":[{"id":1,"x":原图像素横坐标,"y":原图像素纵坐标}]}，每个编号恰好一次。`)
  const data = JSON.parse(grounding.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''))
  if (!Array.isArray(data.points) || data.points.length !== parts.length) throw new Error('部件已识别，但精确定位结果不完整，请重新识别。')
  const seen = new Set<number>()
  for (const p of data.points) {
    if (!Number.isInteger(p.id) || p.id < 1 || p.id > parts.length || seen.has(p.id) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > dimensions.width || p.y > dimensions.height) throw new Error('精确定位坐标无效，请重新识别。')
    seen.add(p.id)
    const part = parts[p.id - 1]!
    part.point = [p.x / dimensions.width * 1000, p.y / dimensions.height * 1000]
    part.label = [part.point[0] < 500 ? 80 : 920, part.point[1]]
  }
  return parts
}






