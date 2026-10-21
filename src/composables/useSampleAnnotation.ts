import { computed, onBeforeUnmount, reactive, ref, shallowRef } from 'vue'
import { analyzeSample, providers, type Part } from '@/services/sampleAnalysis'
import { formatSampleReport, type ReportLanguage } from '@/services/sampleReport'
export function useSampleAnnotation() {
  const refine = shallowRef(false)
  const analysisImage = shallowRef('')
  const language = shallowRef<ReportLanguage>('en')
  const reportText = computed(() => formatSampleReport(parts.value, language.value))
  const provider = shallowRef<'qwen' | 'deepseek'>('qwen')
  const configs = reactive(structuredClone(providers))
  const config = computed(() => configs[provider.value])
  const image = shallowRef(''), filename = shallowRef(''), notes = shallowRef(''), error = shallowRef(''), busy = shallowRef(false)
  const parts = ref<Part[]>([]), selected = shallowRef(0)
  const dimensions = reactive({ width: 0, height: 0 })
  const ready = computed(() => !!image.value && !!parts.value.length)
  let controller: AbortController | undefined
  let revision = 0
  onBeforeUnmount(() => controller?.abort())
  async function upload(file?: File) {
    if (!file || busy.value) return
    error.value = ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { error.value = '请上传 15 MB 以内的 PNG、JPG 或 WebP 图片。'; return }
    const id = ++revision
    try {
      const src = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
      const img = new Image(); img.src = src; await img.decode()
      if (id !== revision) return
      if (img.naturalWidth * img.naturalHeight > 24000000) throw new Error('图片像素过大，请缩小至 2400 万像素以内。')
            const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale)
      const context = canvas.getContext('2d')
      let prepared = src
      if (context) {
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/jpeg', 0.9)
        if (scale < 1 || compressed.length < src.length) prepared = compressed
      }
      analysisImage.value = prepared
      image.value = src; filename.value = file.name; dimensions.width = img.naturalWidth; dimensions.height = img.naturalHeight; parts.value = []; selected.value = 0
    } catch (e) { error.value = e instanceof Error ? e.message : '图片无法读取，请换一张图片。' }
  }
  async function analyze() {
    if (!image.value || busy.value) return
    if (!config.value.key.trim()) { error.value = '请先在模型设置中填写 API Key。'; return }
    busy.value = true; error.value = ''; controller = new AbortController()
    const timer = setTimeout(() => controller?.abort(), 120000)
    try { parts.value = await analyzeSample({ ...config.value }, analysisImage.value || image.value, notes.value, controller.signal, { ...dimensions }, refine.value); selected.value = 0 }
    catch (e) { error.value = e instanceof Error && e.name === 'AbortError' ? '识别已取消或超时，可重新尝试。' : e instanceof TypeError ? '无法连接接口。请检查网络和接口地址；若接口不允许浏览器跨域访问，需要使用支持跨域的兼容接口。' : e instanceof Error ? e.message : '识别失败，请重试。' }
    finally { clearTimeout(timer); busy.value = false }
  }
  function add() { parts.value.push({ material: 'Unknown', color: '', style: '', description: 'Unknown (part)', point: [500, 500], label: [150, 100 + parts.value.length * 25 % 800], confirmed: false }); selected.value = parts.value.length - 1 }
  function remove(i: number) { parts.value.splice(i, 1); selected.value = Math.max(0, Math.min(selected.value, parts.value.length - 1)) }
  function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  async function exportImage() {
    if (!ready.value) return
    try {
      const img = new Image(); img.src = image.value; await img.decode()
      const c = document.createElement('canvas'); c.width = dimensions.width; c.height = dimensions.height
      const ctx = c.getContext('2d'); if (!ctx) throw new Error('浏览器不支持图片导出。')
      ctx.drawImage(img, 0, 0); const unit = Math.min(c.width, c.height) / 700
      ctx.strokeStyle = '#dc2626'; ctx.fillStyle = '#dc2626'; ctx.lineWidth = Math.max(2, unit * 2)
      ctx.font = `bold ${Math.max(18, unit * 24)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      for (const [i, p] of parts.value.entries()) {
        const x = p.point[0] / 1000 * c.width, y = p.point[1] / 1000 * c.height, lx = p.label[0] / 1000 * c.width, ly = p.point[1] / 1000 * c.height
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, Math.max(3, unit * 4), 0, Math.PI * 2); ctx.fill()
        ctx.save(); ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(14, unit * 18), 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.fillText(String(i + 1), lx, ly)
      }
      c.toBlob(blob => { if (blob) download(blob, `${filename.value.replace(/\.[^.]+$/, '')}-annotated.png`); else error.value = '导出失败，请减小图片后重试。' }, 'image/png')
    } catch (e) { error.value = e instanceof Error ? e.message : '导出失败' }
  }
  return { refine, language, reportText, provider, configs, config, image, filename, dimensions, notes, error, busy, parts, selected, ready, upload, analyze, add, remove, exportImage, cancel: () => controller?.abort(), exportText: () => download(new Blob([reportText.value], { type: 'text/plain;charset=utf-8' }), `tested-parts-${language.value}.txt`) }
}






