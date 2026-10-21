<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, ArrowUpRight, ChevronRight, FileImage, LayoutDashboard, Layers, Package, Users } from 'lucide-vue-next'
import { useCompanyData } from '@/composables/useCompanyData'
import './company.css'
import 'element-plus/es/components/base/style/css'
import 'element-plus/es/components/table/style/css'
import 'element-plus/es/components/table-column/style/css'
import 'element-plus/es/components/pagination/style/css'
const route = useRoute()
const { error, refresh } = useCompanyData()
const navigation = [
  { path:'/company/overview', title:'工作概览', icon:LayoutDashboard },
  { path:'/company/orders', title:'订单管理', icon:Package },
  { path:'/company/customers', title:'客户管理', icon:Users },
  { path:'/company/designs', title:'印花文件', icon:FileImage },
]
const title = computed(() => navigation.find(item => route.path.startsWith(item.path))?.title || '订单管理')
</script>
<template><div class="company-app"><aside class="company-sidebar"><RouterLink class="company-brand" to="/company/orders"><span><Layers :size="24"/></span><b>印作<small>PRINT OPERATIONS</small></b></RouterLink><div class="company-workspace-label">企业工作空间<span>DEMO</span></div><nav aria-label="公司系统导航"><RouterLink v-for="item in navigation" :key="item.path" :to="item.path"><component :is="item.icon" :size="18"/><span>{{ item.title }}</span><ChevronRight :size="13"/></RouterLink></nav><div class="company-sidebar-bottom"><div class="company-client-entry"><span>客户 DIY 工作台</span><p>让每一份设计，都有订单可循。</p><RouterLink to="/tools/print-studio">打开设计工作台<ArrowUpRight :size="15"/></RouterLink></div><RouterLink class="company-back" to="/"><ArrowLeft :size="15"/>返回功能导航</RouterLink></div></aside><div class="company-frame"><header class="company-topbar"><span>印作公司系统<ChevronRight :size="13"/><b>{{ title }}</b></span><div><span class="company-local-dot"></span>本地演示<span class="company-user-avatar">管</span><b>演示管理员</b></div></header><div class="company-demo-notice">演示模式 · 数据仅保存在当前浏览器，同一浏览器内可体验客户设计与订单联动。</div><div v-if="error" class="company-error" role="alert">{{ error }} <button @click="refresh">重试</button></div><main id="main" class="company-content"><RouterView/></main><footer class="company-footer"><span>印作 · 轻量订单管理</span><a href="https://github.com/Daymychen/art-design-pro" target="_blank" rel="noopener noreferrer">Art Design Pro 精简版</a><a href="/licenses/art-design-pro.txt" target="_blank">MIT License</a></footer></div></div></template>
