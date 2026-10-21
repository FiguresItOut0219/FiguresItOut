import type { Customer, PrintOrder } from '@/types/print-orders'
export interface SharedBrief { version: 1; id: string; title: string; product: string; quantity: number; customer: string; dueDate: string; note: string }
export function customerDesignLink(order: PrintOrder, customer?: Customer) {
  const brief: SharedBrief = {version:1,id:order.id,title:order.title,product:order.product,quantity:order.quantity,customer:customer?.name || '定制客户',dueDate:order.dueDate,note:order.note}
  const encoded = btoa(Array.from(new TextEncoder().encode(JSON.stringify(brief)), byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
  return `${location.origin}/tools/print-studio?order=${encodeURIComponent(order.id)}#brief=${encoded}`
}
export function readSharedBrief(hash: string): SharedBrief | undefined {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('brief'); if (!raw) return
  if (raw.length > 12000) throw new Error('设计链接内容过长，请联系工作人员重新分享')
  try {
    const value = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0)))) as SharedBrief
    if (value.version !== 1 || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.customer !== 'string' || typeof value.product !== 'string' || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 10000 || typeof value.note !== 'string' || typeof value.dueDate !== 'string') throw new Error()
    return value
  } catch { throw new Error('设计链接已损坏，请联系工作人员重新分享') }
}
