<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElTable, ElTableColumn, ElPagination } from 'element-plus'
import { ArrowDownToLine, Plus, Search } from 'lucide-vue-next'
import { useCompanyData } from '@/composables/useCompanyData'
import { orderStatuses, type OrderStatus } from '@/types/print-orders'
import { downloadBlob, formatTime } from '@/services/printFiles'
import ArtTableHeader from './art/ArtTableHeader.vue'
import NewOrderDialog from './NewOrderDialog.vue'
import OrderDetail from './OrderDetail.vue'
const route = useRoute(); const router = useRouter()
const { orders, customers, loading, refresh } = useCompanyData()
const search = shallowRef(''); const status = shallowRef(''); const page = shallowRef(1); const creating = shallowRef(false)
const chosen = computed(() => orders.value.find(o => o.id === route.query.order))
const customerMap = computed(() => new Map(customers.value.map(c => [c.id, c])))
const filtered = computed(() => orders.value.filter(o => (!status.value || o.status === status.value) && `${o.id} ${o.title} ${customerMap.value.get(o.customerId)?.name || ''} ${customerMap.value.get(o.customerId)?.company || ''}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const visible = computed(() => filtered.value.slice((page.value - 1) * 8, page.value * 8))
watch([search, status], () => page.value = 1)
watch(() => route.query.status, value => { status.value = typeof value === 'string' && value in orderStatuses ? value : '' }, {immediate:true})
function open(id: string) { void router.replace({query:{...route.query,order:id}}) }
function close() { const query = {...route.query}; delete query.order; void router.replace({query}) }
async function created(id: string) { creating.value = false; await refresh(); open(id) }
function exportOrders() {
  const safe = (value: unknown) => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"','""')}"`
  const rows = [['订单编号','订单名称','客户','产品','数量','状态','交付日期'], ...filtered.value.map(o => [o.id,o.title,customerMap.value.get(o.customerId)?.name,o.product,o.quantity,orderStatuses[o.status],o.dueDate])]
  downloadBlob(new Blob(['\ufeff' + rows.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'印作-订单清单.csv')
}
</script>
<template><section><div class="company-page-heading"><div><p>ORDER MANAGEMENT</p><h1>订单管理</h1><span>从客户的第一个灵感，到每一件准时交付的成品。</span></div><button class="company-primary" @click="creating = true"><Plus :size="17"/>新建订单</button></div><div class="company-status-tabs" role="group" aria-label="订单状态筛选"><button :class="{active:!status}" :aria-pressed="!status" @click="status = ''">全部订单<span>{{ orders.length }}</span></button><button v-for="(label,key) in orderStatuses" :key="key" :class="{active:status === key}" :aria-pressed="status === key" @click="status = key as OrderStatus">{{ label }}<span>{{ orders.filter(o=>o.status === key).length }}</span></button></div><section class="company-panel"><ArtTableHeader title="订单列表" :count="filtered.length" :loading="loading" @refresh="refresh"><button @click="exportOrders"><ArrowDownToLine :size="15"/>导出清单</button></ArtTableHeader><div class="company-filter-row"><div class="company-search"><Search :size="16"/><input v-model="search" aria-label="搜索订单" placeholder="搜索订单号、名称或客户"/></div><span>设计提交后，将自动进入待审核列表</span></div><div class="company-table-wrap"><ElTable :data="visible" row-key="id" empty-text="没有符合条件的订单" style="width:100%"><ElTableColumn label="订单信息" min-width="245"><template #default="{row}"><button class="company-order-link" @click="open(row.id)">{{ row.title }}</button><span class="company-cell-sub">{{ row.id }}<i v-if="row.demo">示例</i></span></template></ElTableColumn><ElTableColumn label="客户" min-width="140"><template #default="{row}"><span class="company-cell-main">{{ customerMap.get(row.customerId)?.name }}</span><span class="company-cell-sub">{{ customerMap.get(row.customerId)?.company || '个人客户' }}</span></template></ElTableColumn><ElTableColumn label="产品 / 数量" min-width="155"><template #default="{row}"><span>{{ row.product }}</span><span class="company-cell-sub">{{ row.quantity }} 件</span></template></ElTableColumn><ElTableColumn label="印花文件" min-width="100"><template #default="{row}"><span :class="row.designId ? 'company-design-ready' : 'company-cell-muted'">{{ row.designId ? `已提交 · V${row.designVersion}` : '待提交' }}</span></template></ElTableColumn><ElTableColumn label="订单状态" min-width="110"><template #default="{row}"><span class="company-status" :class="row.status">{{ orderStatuses[row.status as OrderStatus] }}</span></template></ElTableColumn><ElTableColumn label="更新 / 交付" min-width="120"><template #default="{row}"><span class="company-cell-sub">{{ formatTime(row.updatedAt) }}</span><span class="company-cell-sub">{{ row.dueDate || '未设交期' }}</span></template></ElTableColumn><ElTableColumn label="操作" width="83" fixed="right"><template #default="{row}"><button class="company-text-button" @click="open(row.id)" :aria-label="`查看订单 ${row.id}`">查看</button></template></ElTableColumn></ElTable></div><div class="company-pagination"><span>共 {{ filtered.length }} 笔订单</span><ElPagination v-model:current-page="page" :page-size="8" :total="filtered.length" layout="prev, pager, next" :hide-on-single-page="false"/></div></section><p class="company-under-note">订单流程：客户设计 → 文件审核 → 生产 → 发货 → 完成</p><NewOrderDialog v-if="creating" :customers="customers" @close="creating = false" @created="created"/><OrderDetail v-if="chosen" :key="chosen.id" :order="chosen" :customer="customerMap.get(chosen.customerId)" @close="close" @changed="refresh"/></section></template>
