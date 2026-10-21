import { onMounted, onUnmounted, readonly, shallowRef } from 'vue'
import { initializeCompany, readAll } from '@/services/printRepository'
import type { Customer, PrintOrder } from '@/types/print-orders'
const orders = shallowRef<PrintOrder[]>([])
const customers = shallowRef<Customer[]>([])
const loading = shallowRef(false)
const error = shallowRef('')
let generation = 0
export async function refreshCompany() {
  const current = ++generation; loading.value = true
  try { await initializeCompany(); const [o, c] = await Promise.all([readAll<PrintOrder>('orders'), readAll<Customer>('customers')]); if (current !== generation) return; orders.value = o.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); customers.value = c; error.value = '' }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '数据读取失败，请重试' }
  finally { if (current === generation) loading.value = false }
}
export function useCompanyData() {
  const refresh = () => { void refreshCompany() }
  onMounted(() => { refresh(); window.addEventListener('print-orders-changed', refresh); window.addEventListener('focus', refresh) })
  onUnmounted(() => { window.removeEventListener('print-orders-changed', refresh); window.removeEventListener('focus', refresh) })
  return { orders, customers, loading: readonly(loading), error: readonly(error), refresh: refreshCompany }
}
