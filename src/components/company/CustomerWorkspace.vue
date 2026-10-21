<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import { ElTable, ElTableColumn } from 'element-plus'
import { Plus, Search } from 'lucide-vue-next'
import { useCompanyData } from '@/composables/useCompanyData'
import { saveCustomer } from '@/services/printRepository'
import type { Customer } from '@/types/print-orders'
import ArtTableHeader from './art/ArtTableHeader.vue'
import CompanyDialog from './CompanyDialog.vue'
const {customers, orders, loading, refresh} = useCompanyData()
const query = shallowRef(''); const editing = shallowRef<string | null>(null); const opened = shallowRef(false); const busy = shallowRef(false); const error = shallowRef('')
const form = reactive({name:'',company:'',contact:'',note:''})
const filtered = computed(()=>customers.value.filter(c=>`${c.name} ${c.company} ${c.contact}`.toLowerCase().includes(query.value.trim().toLowerCase())))
function open(c?: Customer) {editing.value = c?.id || null; Object.assign(form,{name:c?.name || '',company:c?.company || '',contact:c?.contact || '',note:c?.note || ''}); error.value = ''; opened.value = true}
async function submit() {busy.value = true; try {await saveCustomer({...form},editing.value || undefined); opened.value = false; await refresh()} catch(cause){error.value = cause instanceof Error?cause.message:'客户保存失败'}finally{busy.value=false}}
</script>
<template><section><div class="company-page-heading"><div><p>CUSTOMER DIRECTORY</p><h1>客户管理</h1><span>记录客户与定制需求，让每次合作都有迹可循。</span></div><button class="company-primary" @click="open()"><Plus :size="16"/>新增客户</button></div><section class="company-panel"><ArtTableHeader title="客户列表" :count="filtered.length" :loading="loading" @refresh="refresh"/><div class="company-filter-row"><div class="company-search"><Search :size="16"/><input v-model="query" aria-label="搜索客户" placeholder="搜索姓名、公司或联系方式"/></div></div><ElTable :data="filtered" empty-text="暂无匹配的客户"><ElTableColumn label="客户" min-width="150"><template #default="{row}"><span class="company-customer-name"><i>{{ row.name.slice(0,1) }}</i>{{ row.name }}</span></template></ElTableColumn><ElTableColumn prop="company" label="公司 / 团体" min-width="160"/><ElTableColumn prop="contact" label="联系方式" min-width="200"/><ElTableColumn label="订单数" width="100"><template #default="{row}">{{ orders.filter(o=>o.customerId === row.id).length }} 笔</template></ElTableColumn><ElTableColumn prop="note" label="备注" min-width="180"/><ElTableColumn label="操作" width="90" fixed="right"><template #default="{row}"><button class="company-text-button" @click="open(row)">编辑</button></template></ElTableColumn></ElTable></section><CompanyDialog v-if="opened" :title="editing ? '编辑客户' : '新增客户'" @close="opened = false"><form class="company-form" @submit.prevent="submit"><label>客户姓名<span>*</span><input v-model="form.name" required maxlength="40"/></label><label>公司 / 团体<input v-model="form.company" maxlength="80"/></label><label>联系方式<input v-model="form.contact" maxlength="120" placeholder="手机、微信或邮箱"/></label><label>备注<textarea v-model="form.note" maxlength="500" rows="3"/></label><p v-if="error" class="company-form-error" role="alert">{{ error }}</p><footer><button type="button" @click="opened = false">取消</button><button class="company-primary" :disabled="busy">{{ busy ? '保存中…' : '保存客户' }}</button></footer></form></CompanyDialog></section></template>
