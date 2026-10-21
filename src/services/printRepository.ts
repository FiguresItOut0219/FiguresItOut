/** Browser repository. Replace this module with authenticated API calls for shared deployments. */
import { editableStatuses, transitions, type Customer, type DesignSubmission, type NewOrder, type OrderStatus, type PrintDesign, type PrintOrder } from '@/types/print-orders'
const DATABASE = 'print-company-v1'
let opening: Promise<IDBDatabase> | undefined
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('print-company-updates') : undefined
export function notifyOrdersChanged() { window.dispatchEvent(new Event('print-orders-changed')); channel?.postMessage('changed') }
channel?.addEventListener('message', () => window.dispatchEvent(new Event('print-orders-changed')))
function database() {
  return opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => { for (const name of ['orders', 'customers', 'designs', 'meta']) request.result.createObjectStore(name, { keyPath: 'id' }) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { opening = undefined; reject(new Error('无法打开本地数据库，请检查浏览器存储权限')) }
    request.onblocked = () => reject(new Error('数据库被其他页面占用，请关闭旧页面后重试'))
  })
}
function transactionResult<T>(tx: IDBTransaction, value: () => T) {
  return new Promise<T>((resolve, reject) => {
    tx.oncomplete = () => resolve(value())
    tx.onabort = () => reject(tx.error || new Error('保存失败，数据未写入。请检查存储空间后重试'))
    tx.onerror = () => { /* onabort reports the final transaction error */ }
  })
}
export async function readAll<T>(store: 'orders' | 'customers' | 'designs') {
  const db = await database(); const tx = db.transaction(store, 'readonly'); const request = tx.objectStore(store).getAll()
  return transactionResult(tx, () => request.result as T[])
}
export async function getOrder(id: string) {
  const db = await database(); const tx = db.transaction('orders', 'readonly'); const request = tx.objectStore('orders').get(id)
  return transactionResult(tx, () => request.result as PrintOrder | undefined)
}
export async function getDesign(id: string) {
  const db = await database(); const tx = db.transaction('designs', 'readonly'); const request = tx.objectStore('designs').get(id)
  return transactionResult(tx, () => request.result as PrintDesign | undefined)
}
function event(text: string, actor: '后台' | '客户' | '系统' = '后台') { return { id: crypto.randomUUID(), at: new Date().toISOString(), text, actor } }
export async function saveCustomer(input: Omit<Customer, 'id' | 'createdAt'>, id?: string) {
  if (!input.name.trim()) throw new Error('请填写客户姓名')
  const db = await database(); const tx = db.transaction('customers', 'readwrite')
  const customer: Customer = { ...input, name: input.name.trim(), id: id || crypto.randomUUID(), createdAt: new Date().toISOString() }
  tx.objectStore('customers').put(customer); await transactionResult(tx, () => customer); notifyOrdersChanged(); return customer
}
export async function createOrder(input: NewOrder) {
  if (!input.title.trim() || !input.customerId || !input.product.trim()) throw new Error('请填写订单名称、客户与产品')
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10000) throw new Error('生产数量须为 1–10000 的整数')
  const db = await database(); const tx = db.transaction(['orders', 'customers'], 'readwrite')
  let result: PrintOrder; let error: Error | undefined
  const done = transactionResult(tx, () => result)
  tx.objectStore('customers').get(input.customerId).onsuccess = e => {
    if (!(e.target as IDBRequest).result) { error = new Error('客户不存在，请重新选择'); tx.abort(); return }
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '')
    const now = new Date().toISOString()
    result = { ...input, title: input.title.trim(), id: `PO${day}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, status: 'awaiting_design', designVersion: 0, createdAt: now, updatedAt: now, history: [event('创建订单，等待客户提交印花设计')] }
    tx.objectStore('orders').add(result)
  }
  try { await done } catch (cause) { throw error || cause }
  notifyOrdersChanged(); return result!
}
export async function submitDesign(input: DesignSubmission) {
  const {width,height,dpi} = input.spec
  if (![width,height,dpi].every(Number.isFinite) || width < 5 || width > 60 || height < 5 || height > 60 || dpi !== 300 || !input.spec.name.trim()) throw new Error('印花尺寸、名称或分辨率无效')
  if (input.pixels.width !== Math.round(width / 2.54 * dpi) || input.pixels.height !== Math.round(height / 2.54 * dpi) || input.pixels.width * input.pixels.height > 36000000) throw new Error('输出像素与印花尺寸不一致')
  if (input.png.size === 0 || input.png.type !== 'image/png') throw new Error('印花 PNG 生成失败，请重新提交')
  const db = await database(); const tx = db.transaction(['orders', 'designs'], 'readwrite'); let error: Error | undefined; let design: PrintDesign
  const done = transactionResult(tx, () => design)
  tx.objectStore('orders').get(input.orderId).onsuccess = e => {
    const order = (e.target as IDBRequest).result as PrintOrder | undefined
    if (!order) error = new Error('订单不存在，请核对订单编号')
    else if (!editableStatuses.includes(order.status)) error = new Error('订单已确认或进入生产，不能修改设计，请联系工作人员')
    else if (order.designId !== input.expectedDesignId) error = new Error('设计已在其他页面更新，请重新打开订单后再提交')
    if (error || !order) { tx.abort(); return }
    design = { id: crypto.randomUUID(), orderId: order.id, version: order.designVersion + 1, spec: input.spec, pixels: input.pixels, source: input.source, png: input.png, preview: input.preview, warnings: input.warnings, submittedAt: new Date().toISOString() }
    order.designId = design.id; order.designVersion = design.version; order.status = 'pending_review'; order.updatedAt = design.submittedAt
    order.history.push(event(`提交印花设计 V${design.version}，等待审核`, '客户'))
    tx.objectStore('designs').add(design); tx.objectStore('orders').put(order)
  }
  try { await done } catch (cause) { throw error || cause }
  notifyOrdersChanged(); return design!
}
export async function transitionOrder(id: string, next: OrderStatus, detail = '', expectedDesignId?: string) {
  const db = await database(); const tx = db.transaction('orders', 'readwrite'); let error: Error | undefined
  const done = transactionResult(tx, () => undefined)
  tx.objectStore('orders').get(id).onsuccess = e => {
    const order = (e.target as IDBRequest).result as PrintOrder | undefined
    if (!order || !transitions[order.status]?.includes(next)) error = new Error('订单状态已变化，请刷新后重试')
    else if (next === 'approved' && (!order.designId || order.designId !== expectedDesignId)) error = new Error('审核的设计版本已变化，请重新查看最新文件')
    else if (['needs_revision', 'cancelled'].includes(next) && !detail.trim()) error = new Error('请填写原因')
    else if (next === 'shipped' && !detail.trim()) error = new Error('请填写物流公司与运单号')
    if (error || !order) { tx.abort(); return }
    const labels: Partial<Record<OrderStatus, string>> = { approved: `审核通过 V${order.designVersion}`, needs_revision: '退回修改', producing: '开始生产', shipped: '发货', completed: '订单完成', cancelled: '取消订单' }
    order.status = next; order.updatedAt = new Date().toISOString(); if (next === 'shipped') order.tracking = detail.trim()
    order.history.push(event(`${labels[next]}${detail.trim() ? `：${detail.trim()}` : ''}`)); tx.objectStore('orders').put(order)
  }
  try { await done } catch (cause) { throw error || cause }
  notifyOrdersChanged()
}
let initialization: Promise<void> | undefined
export function initializeCompany() {
  return initialization ??= (async () => {
    const db = await database(); const tx = db.transaction(['meta', 'orders', 'customers'], 'readwrite'); const done = transactionResult(tx, () => undefined)
    tx.objectStore('meta').get('initialized').onsuccess = e => {
      if ((e.target as IDBRequest).result) return
      const now = new Date().toISOString()
      const customers: Customer[] = [
        { id: 'demo-c1', name: '林小满', company: '山野露营社', contact: '示例客户 · 联系方式未录入', note: '社团活动服定制', createdAt: now },
        { id: 'demo-c2', name: '周予安', company: '自在咖啡', contact: '示例客户 · 联系方式未录入', note: '门店周边定制', createdAt: now },
        { id: 'demo-c3', name: '陈一禾', company: '禾禾工作室', contact: '示例客户 · 联系方式未录入', note: '', createdAt: now },
      ]
      customers.forEach(c => tx.objectStore('customers').add(c))
      const titles = ['山野露营社 · 秋日活动服', '自在咖啡 · 门店帆布袋', '禾禾工作室 · 插画印花', '山野露营社 · 志愿者卫衣']
      titles.forEach((title, i) => {
        const order: PrintOrder = { id: `DEMO-100${i + 1}`, customerId: customers[i % 3]!.id, title, product: ['纯棉短袖 / 米白', '帆布袋 / 原色', '纯棉短袖 / 白色', '连帽卫衣 / 灰色'][i]!, quantity: [30, 50, 12, 20][i]!, dueDate: '', note: '示例订单，可体验完整设计与生产流程。', status: 'awaiting_design', designVersion: 0, createdAt: now, updatedAt: now, demo: true, history: [event('创建示例订单，等待客户设计', '系统')] }
        tx.objectStore('orders').add(order)
      })
      tx.objectStore('meta').put({ id: 'initialized', at: now })
    }
    await done
    await populateSampleDesigns(db)
  })().catch(error => { initialization = undefined; throw error })
}

/** A portable demo brief allows the shared link to open in another browser, without a backend. */
export async function importSharedBrief(brief: { id: string; title: string; product: string; quantity: number; customer: string; dueDate: string; note: string }) {
  const db = await database(); const tx = db.transaction(['orders', 'customers'], 'readwrite'); const done = transactionResult(tx, () => undefined)
  tx.objectStore('orders').get(brief.id).onsuccess = e => {
    if ((e.target as IDBRequest).result) return
    const now = new Date().toISOString(); const customerId = `shared-${brief.id}`
    tx.objectStore('customers').put({id:customerId,name:brief.customer,company:'分享链接客户',contact:'',note:'来自客户设计分享链接',createdAt:now} satisfies Customer)
    const order: PrintOrder = {id:brief.id,customerId,title:brief.title,product:brief.product,quantity:brief.quantity,dueDate:brief.dueDate,note:brief.note,status:'awaiting_design',designVersion:0,createdAt:now,updatedAt:now,history:[event('打开客户设计分享链接（本地演示）', '系统')]}
    tx.objectStore('orders').put(order)
  }
  await done; notifyOrdersChanged()
}

async function populateSampleDesigns(db: IDBDatabase) {
  const checkTx = db.transaction('meta', 'readonly'); const request = checkTx.objectStore('meta').get('sample-designs'); const seeded = await transactionResult(checkTx, () => Boolean(request.result)); if (seeded) return
  const {makeSampleDesign} = await import('./printSample'); const sample = await makeSampleDesign()
  const tx = db.transaction(['meta','orders','designs'],'readwrite'); const done = transactionResult(tx,()=>undefined)
  tx.objectStore('meta').get('sample-designs').onsuccess = e => {
    if ((e.target as IDBRequest).result) return
    ;(['DEMO-1002','DEMO-1003'] as const).forEach((id,index) => {
      tx.objectStore('orders').get(id).onsuccess = oe => {
        const order = (oe.target as IDBRequest).result as PrintOrder | undefined
        if (!order || order.designId || order.status !== 'awaiting_design') return
        const submittedAt = new Date(Date.now() - (index+1)*3600000).toISOString()
        const design: PrintDesign = { ...sample,id:`sample-file-${id}`,orderId:id,version:1,submittedAt }
        order.designId = design.id; order.designVersion = 1; order.status = index === 0 ? 'pending_review' : 'producing'; order.updatedAt = submittedAt
        order.history.push({...event('提交示例印花设计 V1','客户'),at:submittedAt})
        if (index === 1) { order.history.push({...event('审核通过 V1'),at:submittedAt}); order.history.push({...event('开始生产'),at:submittedAt}) }
        tx.objectStore('designs').put(design); tx.objectStore('orders').put(order)
      }
    })
    tx.objectStore('meta').put({id:'sample-designs',at:new Date().toISOString()})
  }
  await done
}
