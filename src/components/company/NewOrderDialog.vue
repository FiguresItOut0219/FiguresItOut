<script setup lang="ts">
import { reactive, shallowRef } from 'vue'
import { Plus } from 'lucide-vue-next'
import { createOrder } from '@/services/printRepository'
import type { Customer } from '@/types/print-orders'
import CompanyDialog from './CompanyDialog.vue'
defineProps<{ customers: Customer[] }>()
const emit = defineEmits<{ close: []; created: [id: string] }>()
const form = reactive({ customerId:'', title:'', product:'纯棉短袖 / 白色', quantity:1, dueDate:'', note:'' })
const busy = shallowRef(false); const error = shallowRef('')
async function submit() { busy.value = true; error.value = ''; try { const order = await createOrder({...form}); emit('created', order.id) } catch(cause) { error.value = cause instanceof Error ? cause.message : '订单创建失败' } finally { busy.value = false } }
</script>
<template><CompanyDialog title="新建印花订单" @close="emit('close')"><form class="company-form" @submit.prevent="submit"><p class="company-form-hint">先建立订单，再将设计入口提供给客户。</p><label>订单名称<span>*</span><input v-model="form.title" required maxlength="80" placeholder="例如：秋日露营活动服"/></label><label>所属客户<span>*</span><select v-model="form.customerId" required><option value="" disabled>选择一个客户</option><option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}{{ c.company ? ` · ${c.company}` : '' }}</option></select></label><p v-if="!customers.length" class="company-form-hint">请先前往客户管理添加客户。</p><label>产品 / 规格<span>*</span><input required v-model="form.product" maxlength="100"/></label><div class="company-form-row"><label>生产数量<input v-model.number="form.quantity" required type="number" min="1" max="10000" step="1"/></label><label>交付日期<input v-model="form.dueDate" type="date"/></label></div><label>订单备注<textarea v-model="form.note" maxlength="500" rows="3" placeholder="印花位置、工艺与其他要求"/></label><p v-if="error" class="company-form-error" role="alert">{{ error }}</p><footer><button type="button" @click="emit('close')">取消</button><button class="company-primary" :disabled="busy || !customers.length"><Plus :size="15"/>{{ busy ? '创建中…' : '创建订单' }}</button></footer></form></CompanyDialog></template>
