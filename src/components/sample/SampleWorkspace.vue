<script setup lang="ts">
import { shallowRef } from 'vue'
import { moveAnnotation } from '@/services/sampleGeometry'
import { ScanLine, Upload, Download, Settings2, ArrowLeft } from 'lucide-vue-next'
import { useSampleAnnotation } from '@/composables/useSampleAnnotation'
import AnnotationCanvas from './AnnotationCanvas.vue'
import PartInspector from './PartInspector.vue'
import './sample.css'
const { refine, language, reportText, provider, config, image, filename, dimensions, notes, error, busy, parts, selected, ready, upload, analyze, add, remove, exportImage, exportText, cancel } = useSampleAnnotation()
const relocating = shallowRef(false)
const showReport = shallowRef(false), copied = shallowRef(false)
async function copyReport() { try { await navigator.clipboard.writeText(reportText.value); copied.value = true } catch { error.value = '复制失败，请选中预览文字手动复制。' } }
const settings = shallowRef(false), fileInput = shallowRef<HTMLInputElement>(), dragging = shallowRef(false)
function update(i: number, field: 'material' | 'color' | 'style' | 'description' | 'descriptionZh', value: string) { const p = parts.value[i]; if (p) { p[field] = value; p.confirmed = false } }
function move(i: number, kind: 'point' | 'label' | 'length', value: [number, number]) {
  const p = parts.value[i]
  if (!p || busy.value) return
  const next = moveAnnotation(p, kind, value)
  p.point = next.point; p.label = next.label; p.confirmed = false; relocating.value = false
}
function drop(e: DragEvent) { dragging.value = false; void upload(e.dataTransfer?.files[0]) }
</script>
<template>
  <div class="sa-app"><header class="sa-header"><RouterLink to="/" aria-label="返回功能导航"><ArrowLeft :size="18"/></RouterLink><ScanLine :size="26"/><div><b>样品标注室</b><small>SAMPLE ANNOTATION</small></div><span class="sa-header-note">识别 · 校对 · 归档</span><button @click="settings = !settings"><Settings2 :size="16"/> 模型设置</button></header>
    <main id="main" class="sa-main"><div class="sa-heading"><div><p class="sa-kicker">TESTED PARTS / 工作台</p><h1>让每个部件，清楚有据。</h1><p>上传样品图片，生成部件描述与编号，校对后用于你的报告。</p></div><div class="sa-step"><span :class="{ current: !image }">01 上传</span><i></i><span :class="{ current: image && !ready }">02 识别与编辑</span><i></i><span :class="{ current: ready }">03 导出</span></div></div>
    <section v-show="settings" class="sa-settings" aria-label="模型设置"><label>识别模型<select v-model="provider" :disabled="busy"><option value="qwen">Qwen3.7 Flash</option><option value="deepseek">DeepSeek</option></select></label><label>API Key<input v-model="config.key" :disabled="busy" type="password" autocomplete="off" placeholder="填写所选服务的 API Key"/></label><label>模型名称<input v-model="config.model" :disabled="busy"/></label><label class="sa-endpoint">接口地址<input v-model="config.endpoint" :disabled="busy" type="url"/></label><label class="sa-refine"><input v-model="refine" :disabled="busy" type="checkbox"/>额外复核定位（增加一次 AI 请求，耗时更长）</label><p>Key 仅在当前页面内存中使用，刷新后清除。图片将在识别时发送至所选接口；接口需允许浏览器访问。</p></section>
    <div v-if="error" class="sa-error" role="alert">{{ error }}</div>
    <div class="sa-workspace"><section class="sa-stage"><div class="sa-section-title"><h2>样品原图</h2><button v-if="parts.length" :disabled="busy" :aria-pressed="relocating" @click="relocating = !relocating">{{ relocating ? `请点击图片上部件 ${selected + 1} 的实际位置（再次点击此按钮取消）` : `重新定位部件 ${selected + 1}` }}</button><button :disabled="busy" @click="fileInput?.click()"><Upload :size="15"/>{{ image ? '更换图片' : '上传图片' }}</button><input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="upload(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''"/></div>
      <div class="sa-board" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="drop">
        <AnnotationCanvas v-if="image" :image="image" :dimensions="dimensions" :parts="parts" :selected="selected" :relocating="relocating" @select="selected = $event" @move="move"/>
        <button v-else class="sa-upload" @click="fileInput?.click()"><span class="sa-upload-frame"><ScanLine :size="45" :stroke-width="1"/></span><strong>将样品图片放在这里</strong><span>拖拽上传，或点击选择文件</span><small>PNG / JPG / WebP · 最大 15 MB</small></button>
        <div v-if="busy" class="sa-loading" role="status"><ScanLine :size="28"/><strong>正在识别部件与定位…</strong><span>请保留此页面，最长等待 2 分钟</span><button @click="cancel">取消识别</button></div>
      </div>
      <div class="sa-image-meta"><span>{{ filename || '尚未上传图片' }}</span><span>{{ image ? `${dimensions.width} × ${dimensions.height} px` : '原图保留 · 仅叠加标注' }}</span></div>
      <p v-if="parts.length" class="sa-muted">拖动线条或端点调整长短；拖动编号移动整条标注，始终保持水平。</p>
      <label class="sa-notes">补充信息 <span>选填</span><textarea v-model="notes" :disabled="busy" rows="2" placeholder="可填写已知材料、产品组成或需要检测的部件，帮助识别。"/></label>
      <div class="sa-analyze-row"><span>{{ parts.length ? '重新识别将替换当前部件清单' : '自动区分材料、颜色与部件样式' }}</span><button class="sa-primary" :disabled="!image || busy" @click="analyze"><ScanLine :size="17"/>{{ busy ? '正在识别…' : parts.length ? '重新识别' : '开始识别并标注' }}</button></div>
    </section><PartInspector :parts="parts" :selected="selected" :disabled="busy || !image" @select="selected = $event" @update="update" @remove="remove" @add="add"/></div>
    <footer class="sa-export"><div><b>{{ parts.length }} 个测试部件</b><span>{{ ready ? '描述与标注已就绪，可以导出。' : '上传图片并识别，即可编辑与导出。' }}</span></div><label class="sa-language">输出语言<select v-model="language" @change="copied = false"><option value="en">English</option><option value="zh">中文</option></select></label><button :disabled="!parts.length || busy" @click="showReport = true; copied = false">预览文字</button><button :disabled="!ready || busy" @click="exportText">下载文字</button><button class="sa-primary" :disabled="!ready || busy" @click="exportImage"><Download :size="17"/>导出标注图片</button></footer>
    <div v-if="showReport" class="sa-report-backdrop" @click.self="showReport = false"><section role="dialog" aria-modal="true" aria-label="输出文字预览" class="sa-report-dialog" @keydown.esc="showReport = false"><div class="sa-section-title"><h2>{{ language === 'en' ? '英文描述预览' : '中文描述预览' }}</h2><button autofocus @click="showReport = false">关闭</button></div><pre tabindex="0">{{ reportText }}</pre><div class="sa-report-actions"><button @click="copyReport">{{ copied ? '已复制' : '复制文字' }}</button><button :disabled="!ready" @click="exportText">下载 TXT</button></div></section></div>    </main>
  </div>
</template>








