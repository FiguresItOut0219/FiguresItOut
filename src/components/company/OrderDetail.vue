<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { ArrowDownToLine, ArrowRight, Check, Copy, ExternalLink, FileImage, Link, X } from 'lucide-vue-next'
import { editableStatuses, orderStatuses, type Customer, type OrderStatus, type PrintDesign, type PrintOrder } from '@/types/print-orders'
import { getDesign, transitionOrder } from '@/services/printRepository'
import { customerDesignLink } from '@/services/printShare'
import { downloadBlob, formatTime } from '@/services/printFiles'
import CompanyDialog from './CompanyDialog.vue'
const props = defineProps<{ order: PrintOrder; customer?: Customer }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const design = shallowRef<PrintDesign>(); const previewUrl = shallowRef(''); const busy = shallowRef(false); const error = shallowRef(''); const feedback = shallowRef(''); const reason = shallowRef(''); const checked = shallowRef(false)
const action = shallowRef<'needs_revision' | 'cancelled' | 'shipped' | ''>('')
const shareUrl = computed(() => customerDesignLink(props.order, props.customer))
const editable = computed(() => editableStatuses.includes(props.order.status))
const nextAction = computed(() => ({approved:{label:'开始生产',status:'producing'},producing:{label:'登记发货',status:'shipped'},shipped:{label:'确认完成',status:'completed'}}[props.order.status as 'approved' | 'producing' | 'shipped']))
let sequence = 0
watch(() => props.order.designId, async id => {
  const current = ++sequence; checked.value = false; design.value = undefined
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = ''
  if (!id) return
  try { const result = await getDesign(id); if (current !== sequence) return; design.value = result; if (result) previewUrl.value = URL.createObjectURL(result.preview) }
  catch { error.value = '印花文件读取失败，请关闭后重试' }
}, {immediate:true})
onUnmounted(() => { sequence++; if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })
async function change(status: OrderStatus) {
  error.value = ''; busy.value = true
  try { await transitionOrder(props.order.id,status,reason.value,design.value?.id); action.value = ''; reason.value = ''; feedback.value = '订单状态已更新'; emit('changed') }
  catch(cause) { error.value = cause instanceof Error ? cause.message : '状态更新失败' }
  finally {busy.value = false}
}
async function copy() { try { await navigator.clipboard.writeText(shareUrl.value); feedback.value = '客户设计链接已复制' } catch { feedback.value = '请选中下方链接手动复制' } }
function source() { if (design.value) downloadBlob(new Blob([JSON.stringify({version:1,orderId:props.order.id,spec:design.value.spec,design:design.value.source},null,2)],{type:'application/json'}),`${props.order.id}-V${design.value.version}-source.json`) }
</script>
<template><CompanyDialog :title="`订单详情 · ${order.id}`" wide @close="emit('close')"><div class="company-detail"><div class="company-detail-title"><div><span class="company-status" :class="order.status">{{ orderStatuses[order.status] }}</span><h3>{{ order.title }}</h3><p>{{ customer?.name }}<span>{{ customer?.company }}</span></p></div><b>{{ order.quantity }}<small>件</small></b></div><dl class="company-detail-facts"><div><dt>产品规格</dt><dd>{{ order.product }}</dd></div><div><dt>交付日期</dt><dd>{{ order.dueDate || '未设置' }}</dd></div><div><dt>创建时间</dt><dd>{{ formatTime(order.createdAt) }}</dd></div><div><dt>物流信息</dt><dd>{{ order.tracking || '尚未发货' }}</dd></div></dl><p v-if="order.note" class="company-detail-note">备注：{{ order.note }}</p>
<section v-if="editable" class="company-share-box"><h4><Link :size="15"/>客户设计入口</h4><p>客户打开链接后，直接为这笔订单设计并提交印花。</p><div><input aria-label="客户设计分享链接" readonly :value="shareUrl" @focus="($event.target as HTMLInputElement).select()"/><button @click="copy"><Copy :size="14"/>复制链接</button></div><RouterLink :to="shareUrl.replace(/^https?:\/\/[^/]+/,'')">模拟客户打开<ExternalLink :size="13"/></RouterLink><small>纯前端演示：跨设备可打开设计信息，提交结果仅保存在客户当前浏览器。</small></section>
<section class="company-design-section"><div class="company-section-heading"><h4>印花文件<span v-if="design">V{{ design.version }}</span></h4><span>{{ design ? '客户已提交' : '等待客户提交' }}</span></div><div v-if="design" class="company-design-file"><div class="company-checker"><img :src="previewUrl" :alt="design.spec.name"/></div><div><h4>{{ design.spec.name }}</h4><p>{{ design.spec.width }} × {{ design.spec.height }} cm · {{ design.spec.dpi }} DPI</p><p>{{ design.pixels.width }} × {{ design.pixels.height }} px · PNG · sRGB</p><p>提交于 {{ formatTime(design.submittedAt) }}</p><p class="company-form-error" v-for="warning in design.warnings" :key="warning">{{ warning }}</p><div class="company-file-actions"><button @click="downloadBlob(design.png,`${order.id}-V${design.version}-300dpi.png`)"><ArrowDownToLine :size="14"/>下载印花 PNG</button><button @click="source">设计源稿</button></div></div></div><div v-else class="company-design-empty"><FileImage :size="29"/><p>设计提交后，预览与高清文件将在这里显示。</p></div></section>
<section class="company-history"><h4>订单动态</h4><ol><li v-for="item in [...order.history].reverse()" :key="item.id"><i></i><div><b>{{ item.text }}</b><span>{{ formatTime(item.at) }} · {{ item.actor }}</span></div></li></ol></section>
<p v-if="error" class="company-form-error" role="alert">{{ error }}</p><p v-if="feedback" class="company-form-feedback" role="status">{{ feedback }}</p>
<div v-if="action" class="company-action-confirm"><label>{{ action === 'shipped' ? '物流公司与运单号' : action === 'needs_revision' ? '修改要求（客户打开设计入口可见）' : '取消原因' }}<textarea v-model="reason" rows="2" maxlength="500" :placeholder="action === 'shipped' ? '例如：顺丰 SF1234567890' : '请填写具体原因'"/></label><div><button @click="action = ''">返回</button><button class="company-primary" :disabled="busy || !reason.trim()" @click="change(action as OrderStatus)">确认{{ action === 'shipped' ? '发货' : action === 'needs_revision' ? '退回' : '取消' }}</button></div></div>
<div v-else class="company-detail-actions"><button v-if="['awaiting_design','pending_review','needs_revision','approved'].includes(order.status)" :disabled="busy" @click="action = 'cancelled'"><X :size="14"/>取消订单</button><template v-if="order.status === 'pending_review' && design"><label class="company-review-check"><input type="checkbox" v-model="checked"/>已核对图稿、尺寸和清晰度</label><button :disabled="busy" @click="action = 'needs_revision'">退回修改</button><button class="company-primary" :disabled="busy || !checked" @click="change('approved')"><Check :size="15"/>审核通过</button></template><button v-if="nextAction" class="company-primary" :disabled="busy" @click="nextAction.status === 'shipped' ? action = 'shipped' : change(nextAction.status as OrderStatus)">{{ nextAction.label }}<ArrowRight :size="15"/></button></div></div></CompanyDialog></template>
