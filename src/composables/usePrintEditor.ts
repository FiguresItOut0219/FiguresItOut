import { computed, onBeforeUnmount, shallowRef, reactive } from 'vue'
import { initializeCompany, getOrder, getDesign, readAll, submitDesign, importSharedBrief } from '@/services/printRepository'
import { readSharedBrief } from '@/services/printShare'
import { downloadBlob, withPrintDpi } from '@/services/printFiles'
import { editableStatuses, type Customer, type PrintOrder } from '@/types/print-orders'
import { Canvas, FabricText, IText, Rect, Circle, FabricImage, type FabricObject } from 'fabric'
export function usePrintEditor(orderId = '', sharedHash = '') {
  let canvas: Canvas
  const linkedOrder = shallowRef<PrintOrder>()
  const linkedCustomer = shallowRef<Customer>()
  const orderLoading = shallowRef(Boolean(orderId))
  const orderError = shallowRef('')
  const submitting = shallowRef(false)
  const submitted = shallowRef(false)
  const confirmed = shallowRef(false)
  const isLinked = Boolean(orderId)
  const locked = computed(() => isLinked && (orderLoading.value || Boolean(orderError.value) || !linkedOrder.value || !editableStatuses.includes(linkedOrder.value.status)))
  const revisionReason = computed(() => linkedOrder.value?.status === 'needs_revision' ? [...linkedOrder.value.history].reverse().find(item=>item.text.startsWith('退回修改'))?.text : '')
  const layers = shallowRef<FabricObject[]>([])
  const selected = shallowRef<FabricObject | null>(null)
  const message = shallowRef('所有更改仅保存在当前浏览器')
  const spec = reactive({ width: 30, height: 40, dpi: 300, quantity: 1, order: '', name: '旷野来信 · 夏日限定', transparent: true })
  const pixels = computed(() => ({ width: Math.round(spec.width / 2.54 * spec.dpi), height: Math.round(spec.height / 2.54 * spec.dpi) }))
  const warnings = computed(() => layers.value.flatMap(o => {
    const bounds = o.getBoundingRect(); const result: string[] = []
    if (bounds.left < 0 || bounds.top < 0 || bounds.left + bounds.width > 450 || bounds.top + bounds.height > 450 * spec.height / spec.width) result.push('有元素超出画布，导出时将被裁切')
    if (o instanceof FabricImage) { const dpi = o.width / (o.getScaledWidth() / 450 * spec.width / 2.54); if (dpi < 150) result.push(`图片有效分辨率约 ${Math.round(dpi)} DPI，建议更换高清原图`) }
    return result
  }).filter((v, i, all) => all.indexOf(v) === i))
  const history: string[] = []; let index = -1; let restoring = false
  const canUndo = shallowRef(false); const canRedo = shallowRef(false)
  const props = reactive({ fill: '#264b3d', text: '', fontSize: 36, angle: 0 })
  function sync() {
    layers.value = [...canvas.getObjects()].reverse(); selected.value = canvas.getActiveObject() || null
    const o = selected.value
    if (o) { props.fill = typeof o.fill === 'string' ? o.fill : '#264b3d'; props.angle = Math.round(o.angle); if (o instanceof FabricText) { props.text = o.text; props.fontSize = o.fontSize } }
  }
  function snapshot() { sync(); if (restoring) return; history.splice(index + 1); history.push(JSON.stringify(canvas.toJSON())); index = history.length - 1; canUndo.value = index > 0; canRedo.value = false }
  function add(o: FabricObject) { canvas.add(o); canvas.setActiveObject(o); canvas.requestRenderAll(); snapshot() }
  async function init(el: HTMLCanvasElement) {
    canvas = new Canvas(el, { width: 450, height: 600, preserveObjectStacking: true, backgroundColor: '' })
    canvas.on('selection:created', sync); canvas.on('selection:updated', sync); canvas.on('selection:cleared', sync); canvas.on('object:modified', snapshot)
    canvas.add(new IText('FIELD NOTES', { left: 225, top: 72, originX: 'center', fontFamily: 'Georgia', fontSize: 45, fill: '#284e40', charSpacing: 30 }))
    canvas.add(new IText('A LITTLE CLOSER TO NATURE', { left: 225, top: 128, originX: 'center', fontSize: 10, charSpacing: 190, fill: '#284e40' }))
    canvas.add(new Circle({ left: 225, top: 283, originX: 'center', originY: 'center', radius: 105, fill: '#e5ad52' }))
    for (let i = 0; i < 7; i++) {
      canvas.add(new Rect({ left: 120 + i * 31, top: 245 + Math.abs(3-i)*17, width: 23, height: 160 - Math.abs(3-i)*17, fill: ['#284e40','#40644b','#698264'][i%3], angle: i < 3 ? -10 : 10, rx: 12 }))
    }
    canvas.add(new IText('THE WILD\nIS CALLING.', { left: 225, top: 420, originX: 'center', textAlign: 'center', fontFamily: 'Georgia', fontSize: 32, lineHeight: 1.05, fill: '#284e40' }))
    canvas.add(new IText('EXPLORE MORE  /  EST. 2026', { left: 225, top: 530, originX: 'center', fontSize: 9, charSpacing: 170, fill: '#284e40' }))
    snapshot()
    if (orderId) await loadLinkedOrder()
  }
  function addText() { add(new IText('双击编辑文字', { left: 80, top: 260, fontFamily: 'Arial', fontSize: 32, fill: '#284e40' })) }
  function shape(type: string) { add(type === 'circle' ? new Circle({ left: 150, top: 210, radius: 60, fill: '#e5ad52' }) : new Rect({ left: 120, top: 240, width: 180, height: 100, fill: '#284e40', rx: type === 'round' ? 30 : 0 })) }
  async function upload(file?: File) {
    if (!file) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { message.value = '请选择 PNG、JPG 或 WebP 图片'; return }
    const url = URL.createObjectURL(file)
    try { const img = await FabricImage.fromURL(url); img.scaleToWidth(260); img.set({ left: 95, top: 150 }); add(img); message.value = '图片已添加，请留意印刷分辨率' } catch { message.value = '图片读取失败' } finally { URL.revokeObjectURL(url) }
  }
  function update() { const o = canvas.getActiveObject(); if (!o) return; o.set({ fill: props.fill, angle: Number(props.angle) }); if (o instanceof FabricText) o.set({ text: props.text, fontSize: Number(props.fontSize) }); o.setCoords(); canvas.requestRenderAll(); snapshot() }
  function remove() { canvas.getActiveObjects().forEach(o => canvas.remove(o)); canvas.discardActiveObject(); snapshot() }
  async function duplicate() { const o = canvas.getActiveObject(); if (o) { const copy = await o.clone(); copy.set({ left: o.left + 15, top: o.top + 15 }); add(copy) } }
  function select(o: FabricObject) { canvas.setActiveObject(o); canvas.requestRenderAll(); sync() }
  function moveLayer(up: boolean) { const o = canvas.getActiveObject(); if (o) { up ? canvas.bringObjectForward(o) : canvas.sendObjectBackwards(o); snapshot(); canvas.requestRenderAll() } }
  function clearSelection() { canvas.discardActiveObject(); canvas.requestRenderAll(); sync() }
  function center() { const o = canvas.getActiveObject(); if (o) { canvas.centerObjectH(o); o.setCoords(); canvas.requestRenderAll(); snapshot() } }
  async function undo(delta: number) { if (index + delta < 0 || index + delta >= history.length) return; restoring = true; index += delta; await canvas.loadFromJSON(history[index]); restoring = false; canvas.requestRenderAll(); sync(); canUndo.value = index > 0; canRedo.value = index < history.length - 1 }
  function resize() { spec.width = Math.min(60, Math.max(5, Number(spec.width) || 30)); spec.height = Math.min(60, Math.max(5, Number(spec.height) || 40)); canvas.setDimensions({ width: 450, height: 450 * spec.height / spec.width }); canvas.requestRenderAll() }
  function download(url: string, name: string) { const a = document.createElement('a'); a.href = url; a.download = name; a.click() }
  function save() { try { localStorage.setItem(`print-studio:${orderId || 'standalone'}`, JSON.stringify({ spec, design: canvas.toJSON() })); message.value = '草稿已保存到当前浏览器' } catch { message.value = '存储空间不足，请下载生产资料保存设计' } }
  async function restore() { try { const raw = localStorage.getItem(`print-studio:${orderId || 'standalone'}`); if (!raw) { message.value = '还没有已保存的草稿'; return }; const data = JSON.parse(raw); Object.assign(spec, data.spec); if (linkedOrder.value) { spec.order = linkedOrder.value.id; spec.quantity = linkedOrder.value.quantity }; resize(); await canvas.loadFromJSON(data.design); canvas.requestRenderAll(); snapshot(); message.value = '已恢复上次保存的草稿' } catch { message.value = '草稿读取失败' } }
  function canvasBlob(multiplier: number) {
    return new Promise<Blob>((resolve,reject) => canvas.toCanvasElement(multiplier).toBlob(blob => blob ? resolve(blob) : reject(new Error('印花文件生成失败')),'image/png'))
  }
  async function printBlob() {
    resize()
    if (pixels.value.width * pixels.value.height > 36000000) throw new Error('印花尺寸过大，请缩小后重试')
    canvas.backgroundColor = spec.transparent ? '' : '#ffffff'
    const rendered = canvas.toCanvasElement(pixels.value.width / 450)
    const exact = document.createElement('canvas'); exact.width = pixels.value.width; exact.height = pixels.value.height
    exact.getContext('2d')!.drawImage(rendered,0,0,exact.width,exact.height)
    const png = await new Promise<Blob>((resolve,reject)=>exact.toBlob(blob=>blob?resolve(blob):reject(new Error('文件生成失败')),'image/png'))
    return withPrintDpi(png,spec.dpi)
  }
  async function exportPng() { try { downloadBlob(await printBlob(),`${spec.name}-${pixels.value.width}x${pixels.value.height}.png`); message.value = '高清 PNG 已导出，包含 300 DPI 印刷分辨率信息' } catch(cause) { message.value = cause instanceof Error ? cause.message : '导出失败，请重试' } }
  async function loadLinkedOrder() {
    orderLoading.value = true
    try {
      await initializeCompany()
      const brief = readSharedBrief(sharedHash)
      if (brief) { if (brief.id !== orderId) throw new Error('订单编号与分享链接不一致'); await importSharedBrief(brief) }
      const order = await getOrder(orderId)
      if (!order) throw new Error('找不到这笔订单，请联系工作人员重新分享设计入口')
      linkedOrder.value = order
      linkedCustomer.value = (await readAll<Customer>('customers')).find(c=>c.id === order.customerId)
      spec.order = order.id; spec.quantity = order.quantity; spec.name = order.title
      if (order.designId) {
        const design = await getDesign(order.designId)
        if (!design) throw new Error('原设计文件读取失败，请联系工作人员')
        Object.assign(spec, design.spec); resize(); await canvas.loadFromJSON(design.source); canvas.requestRenderAll(); snapshot()
      }
      if (!editableStatuses.includes(order.status)) { canvas.selection = false; canvas.getObjects().forEach(o=>o.set({selectable:false,evented:false})); message.value = '订单已确认或进入生产，设计已锁定' }
      else message.value = `正在为订单 ${order.id} 设计印花`
    } catch(cause) { orderError.value = cause instanceof Error ? cause.message : '订单加载失败'; message.value = orderError.value }
    finally { orderLoading.value = false }
  }
  async function submitPrint() {
    if (submitting.value || locked.value || !confirmed.value || submitted.value) return
    if (!linkedOrder.value) { message.value = '请从订单分享链接打开客户设计入口'; return }
    if (!canvas.getObjects().length) { message.value = '请先添加印花设计'; return }
    submitting.value = true
    try {
      const png = await printBlob(); const preview = await canvasBlob(.6)
      const file = await submitDesign({orderId:linkedOrder.value.id,expectedDesignId:linkedOrder.value.designId,spec:{width:spec.width,height:spec.height,dpi:spec.dpi,name:spec.name,transparent:spec.transparent},pixels:{...pixels.value},source:canvas.toJSON(),png,preview,warnings:[...warnings.value]})
      linkedOrder.value = await getOrder(file.orderId); submitted.value = true; message.value = `印花 V${file.version} 已提交，等待工作人员审核`
    } catch(cause) { message.value = cause instanceof Error ? cause.message : '提交失败，请重试' }
    finally { submitting.value = false }
  }
  function resumeEditing() { submitted.value = false; confirmed.value = false; message.value = '可继续修改，重新提交将生成新的设计版本' }
  function production() { spec.quantity = Math.max(1, Math.floor(Number(spec.quantity) || 1)); if (!spec.order.trim()) { message.value = '请先在生产设置中填写订单编号'; return }; const blob = new Blob([JSON.stringify({ version: 1, order: spec.order, name: spec.name, quantity: spec.quantity, sizeCm: { width: spec.width, height: spec.height }, dpi: spec.dpi, pixels: pixels.value, colorSpace: 'sRGB', design: canvas.toJSON() }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); download(url, `${spec.order}-production.json`); setTimeout(() => URL.revokeObjectURL(url), 1000); message.value = '生产资料已下载；尚未向工厂提交订单' }
  onBeforeUnmount(() => { void canvas?.dispose() })
  return { linkedOrder, linkedCustomer, orderLoading, orderError, submitting, submitted, confirmed, isLinked, locked, revisionReason, submitPrint, resumeEditing, clearSelection, warnings, init, layers, selected, spec, pixels, props, message, canUndo, canRedo, addText, shape, upload, update, remove, duplicate, select, moveLayer, center, undo, resize, save, restore, exportPng, production }
}
