<script setup lang="ts">
import { useRoute } from 'vue-router'
import { orderStatuses } from '@/types/print-orders'
import { computed, onMounted, shallowRef } from 'vue'
import { ArrowDownToLine, Check, ChevronDown, CircleHelp, Copy, ImagePlus, Layers, Leaf, Maximize, Minus, MousePointer2, Plus, Redo2, RotateCcw, Save, Shapes, Trash2, Type, Undo2, Upload, X } from 'lucide-vue-next'
import { FabricText, FabricImage } from 'fabric'
import { usePrintEditor } from '@/composables/usePrintEditor'
import './print.css'
import PrintInspector from './PrintInspector.vue'
const route = useRoute()
const e = usePrintEditor(typeof route.query.order === 'string' ? route.query.order : '',route.hash)
const { spec, layers, selected, message, canUndo, canRedo, linkedOrder, linkedCustomer, submitted, orderLoading, orderError, revisionReason } = e
const canvasEl = shallowRef<HTMLCanvasElement | null>(null)
const fileEl = shallowRef<HTMLInputElement | null>(null)
const tab = shallowRef('素材')
const zoom = shallowRef(85)
const help = shallowRef(false)
const canvasStyle = computed(() => ({ transform: `scale(${zoom.value / 100})`, width: '450px', height: `${450 * spec.height / spec.width}px` }))
const layerName = (o: typeof selected.value) => o instanceof FabricText ? o.text : o instanceof FabricImage ? '上传的图片' : o?.type === 'circle' ? '圆形图案' : '几何图形'
function upload(event: Event) { const input = event.target as HTMLInputElement; void e.upload(input.files?.[0]); input.value = '' }
onMounted(() => { if (canvasEl.value) void e.init(canvasEl.value) })
</script>

<template>
<main id="main" class="print-app">
  <header class="print-header">
    <a class="print-brand" href="/" aria-label="返回首页"><span class="brand-symbol"><Layers :size="23" /></span> 印作<span class="brand-en">PRINT STUDIO</span></a>
    <span class="header-divider"></span><input class="design-title" v-model="spec.name" aria-label="设计名称" /><span class="draft-label">草稿</span>
    <div class="header-actions"><button class="help-button" @click="help = true"><CircleHelp :size="17" />使用帮助</button><button @click="e.save"><Save :size="16" />保存草稿</button><button class="primary" @click="e.exportPng"><ArrowDownToLine :size="17" />导出印花文件</button></div>
  </header>
  <div class="workflow-bar"><span><span class="step-number">1</span><b>设计排版</b></span><i></i><span><span class="step-number inactive">2</span>确认印花文件</span><i></i><span><span class="step-number inactive">3</span>关联订单生产</span><small>从一个灵感，到一件成品。</small></div>
  <section v-if="e.isLinked" class="print-order-banner"><div><b>{{ linkedOrder?.title || '客户印花设计' }}</b><span>{{ linkedCustomer?.name || '客户' }} · {{ linkedOrder?.product || '正在读取订单' }} · {{ linkedOrder?.quantity || '—' }} 件</span></div><span v-if="linkedOrder">{{ linkedOrder.id }} <b>{{ orderStatuses[linkedOrder.status] }}</b></span><small>前端演示：提交仅保存在当前浏览器</small></section>
  <div v-if="revisionReason" class="print-revision-note">{{ revisionReason }}</div>
  <section v-if="submitted" class="print-submission-result" role="status"><span class="print-result-icon"><Check :size="25"/></span><h2>印花已提交</h2><p>订单 {{ linkedOrder?.id }} · V{{ linkedOrder?.designVersion }}，等待工作人员审核。</p><p>这是前端演示，当前浏览器的订单后台已同步更新。</p><div><button @click="e.resumeEditing">继续修改设计</button><RouterLink :to="`/company/orders?order=${linkedOrder?.id}`">查看后台演示</RouterLink></div></section>
  <p v-if="orderError" class="print-order-error" role="alert">{{ orderError }}</p>
  <div class="studio-body" v-show="!submitted && !orderError" :inert="orderLoading || e.locked.value || undefined">
    <nav class="tool-rail" aria-label="编辑工具"><button v-for="t in ['素材','文字','图形','图层']" :key="t" :class="{ active: tab === t }" @click="tab = t"><ImagePlus v-if="t === '素材'" :size="21"/><Type v-else-if="t === '文字'" :size="21"/><Shapes v-else-if="t === '图形'" :size="21"/><Layers v-else :size="21"/><span>{{ t }}</span></button><button class="rail-help" aria-label="使用帮助" @click="help = true"><CircleHelp :size="20"/></button></nav>
    <aside class="asset-panel">
      <div class="panel-heading"><h2>{{ tab === '素材' ? '设计素材' : tab === '图层' ? '图层管理' : `添加${tab}` }}</h2><span>{{ tab === '图层' ? layers.length : '' }}</span></div>
      <template v-if="tab === '素材'">
        <div class="asset-tabs"><button class="chosen">我的素材</button><button @click="tab = '图形'">基础图形</button></div>
        <button class="upload-zone" @click="fileEl?.click()" @dragover.prevent @drop.prevent="e.upload($event.dataTransfer?.files[0])"><span class="upload-icon"><Upload :size="22"/></span><b>点击或拖拽上传图片</b><small>PNG、JPG、WebP</small><small>推荐使用透明背景高清原图</small></button>
        <p class="asset-note"><Check :size="13"/>你的素材仅在本地处理</p>
        <div class="section-caption">为你的灵感，添一点形状<span>06</span></div>
        <div class="shape-grid"><button v-for="(shape, i) in ['circle','rect','round','circle','rect','round']" :key="i" @click="e.shape(shape)" :aria-label="`添加${shape}图形`"><span :class="['shape-sample', shape, `sample-${i}`]"></span></button></div>
        <div class="material-tip"><Leaf :size="18"/><div><b>好设计，从清晰开始</b><p>图片放大后可能影响印刷清晰度，请尽量上传原始文件。</p></div></div>
      </template>
      <template v-else-if="tab === '文字'"><p class="panel-description">添加文字后，双击画布中的文字编辑内容。</p><button class="add-text" @click="e.addText"><Type :size="20"/>添加文字</button><button class="text-preset" @click="e.addText">写下你的灵感<span>让文字成为设计的一部分</span></button></template>
      <template v-else-if="tab === '图形'"><p class="panel-description">点击图形添加到画布，自由调整颜色与大小。</p><div class="shape-grid"><button v-for="s in ['circle','rect','round']" :key="s" @click="e.shape(s)" :aria-label="`添加${s}`"><span :class="['shape-sample',s]"></span></button></div></template>
      <template v-else><p class="panel-description">上方图层显示在设计的最前面。</p><button class="layer-row" v-for="(o,i) in layers" :key="i" :class="{ chosen: selected === o }" @click="e.select(o)"><Type v-if="o instanceof FabricText" :size="16"/><Shapes v-else :size="16"/><span>{{ layerName(o) }}</span></button><div class="layer-order"><button @click="e.moveLayer(true)">上移图层</button><button @click="e.moveLayer(false)">下移图层</button></div></template>
      <button class="restore-draft" @click="e.restore"><RotateCcw :size="14"/>恢复已保存的草稿</button>
      <input ref="fileEl" hidden type="file" accept="image/png,image/jpeg,image/webp" @change="upload" />
    </aside>
    <section class="workspace">
      <div class="canvas-toolbar"><div><button aria-label="选择工具" class="tool-selected"><MousePointer2 :size="17"/></button><span class="toolbar-rule"></span><button aria-label="撤销" :disabled="!canUndo" @click="e.undo(-1)"><Undo2 :size="17"/></button><button aria-label="重做" :disabled="!canRedo" @click="e.undo(1)"><Redo2 :size="17"/></button></div><span class="canvas-caption">正面印花 <ChevronDown :size="13"/></span><div><button aria-label="复制选中元素" :disabled="!selected" @click="e.duplicate"><Copy :size="16"/></button><button aria-label="删除选中元素" :disabled="!selected" @click="e.remove"><Trash2 :size="16"/></button></div></div>
      <div class="canvas-area"><div class="artboard-label"><span>印花画布</span><span>{{ spec.width }} × {{ spec.height }} cm</span></div><div class="artboard-wrapper" :style="{ width: `${450 * zoom / 100}px`, height: `${450 * spec.height / spec.width * zoom / 100}px` }"><div class="artboard" :style="canvasStyle"><canvas ref="canvasEl"></canvas></div></div><div class="canvas-under"><span class="green-dot"></span>透明背景 · 仅导出画布内的设计</div></div>
      <div class="workspace-bottom"><span><MousePointer2 :size="13"/>拖动以移动，双击编辑文字</span><div class="zoom-control"><button aria-label="缩小" @click="zoom = Math.max(25, zoom - 10)"><Minus :size="15"/></button><span>{{ zoom }}%</span><button aria-label="放大" @click="zoom = Math.min(150, zoom + 10)"><Plus :size="15"/></button><i></i><button aria-label="适应画布" @click="zoom = 85"><Maximize :size="15"/></button></div></div>
    </section>
    <PrintInspector :editor="e" />
  </div>
  <footer class="print-footer"><span role="status"><span class="green-dot"></span>{{ message }}</span><span>PRINT STUDIO<span class="footer-separator">/</span>让创意，成为实物。</span></footer>
  <div v-if="help" class="modal-backdrop" @click.self="help = false"><section class="help-dialog" role="dialog" aria-modal="true" aria-label="使用帮助"><button class="dialog-close" aria-label="关闭帮助" @click="help = false"><X :size="20"/></button><h2>从设计到印花</h2><ol><li>设置印花实际宽高，上传图片或添加文字。</li><li>拖动、缩放和旋转元素，使用图层调整遮挡关系。</li><li>导出 PNG，以指定厘米尺寸排印即可获得 300 DPI。</li><li>填写订单号并下载生产资料，连同 PNG 交给生产人员。</li></ol><p>当前为前端演示，可从订单后台分享客户设计链接，提交后在同一浏览器中查看订单。PNG 为 sRGB，印刷前请确认颜色与实际样品；放大低清图片不会增加原始细节。</p></section></div>
</main>
</template>

