<script setup lang="ts">
import { onUnmounted, shallowRef, watch } from 'vue'
import { ArrowDownToLine, FileImage } from 'lucide-vue-next'
import { useCompanyData } from '@/composables/useCompanyData'
import { getDesign } from '@/services/printRepository'
import { downloadBlob, formatTime } from '@/services/printFiles'
import type { PrintDesign } from '@/types/print-orders'
const {orders} = useCompanyData()
const designs = shallowRef<(PrintDesign & {url:string})[]>([]); const error = shallowRef('')
let version = 0
watch(orders, async list => {
  const current = ++version
  try { const files = await Promise.all(list.filter(o=>o.designId).map(o=>getDesign(o.designId!))); if(current !== version) return; designs.value.forEach(d=>URL.revokeObjectURL(d.url)); designs.value = files.filter((d):d is PrintDesign=>Boolean(d)).map(d=>({...d,url:URL.createObjectURL(d.preview)})); error.value = '' }
  catch {error.value='文件读取失败，请刷新页面重试'}
}, {immediate:true})
onUnmounted(()=>{version++;designs.value.forEach(d=>URL.revokeObjectURL(d.url))})
</script>
<template><section><div class="company-page-heading"><div><p>PRINT FILE LIBRARY</p><h1>印花文件</h1><span>按订单归档的最新设计，源稿与高清印花对应保存。</span></div><span class="company-library-count">{{ designs.length }} 份当前版本</span></div><p v-if="error" class="company-form-error" role="alert">{{ error }}</p><div class="company-file-grid"><article v-for="d in designs" :key="d.id" class="company-file-card"><RouterLink :to="`/company/orders?order=${d.orderId}`" class="company-checker"><img :src="d.url" :alt="d.spec.name"/><span>V{{ d.version }}</span></RouterLink><div><small>{{ d.orderId }}</small><h2>{{ d.spec.name }}</h2><p>{{ Math.round(d.spec.width*10)/10 }} × {{ Math.round(d.spec.height*10)/10 }} cm · {{ d.spec.dpi }} DPI</p><p>{{ formatTime(d.submittedAt) }} 提交</p><button @click="downloadBlob(d.png,`${d.orderId}-V${d.version}-300dpi.png`)"><ArrowDownToLine :size="14"/>下载高清 PNG</button></div></article></div><div v-if="!designs.length" class="company-empty-copy"><FileImage :size="32"/><h2>还没有提交的印花文件</h2><p>给客户分享订单设计链接，提交后会自动归档在这里。</p></div></section></template>
