<script setup lang="ts">
import type { Part } from '@/services/sampleAnalysis'
defineProps<{ parts: Part[]; selected: number; disabled: boolean }>()
const emit = defineEmits<{ select: [index: number]; update: [index: number, field: 'material' | 'color' | 'style' | 'description', value: string]; confirm: [index: number]; remove: [index: number]; add: [] }>()
</script>
<template>
  <aside class="sa-inspector"><div class="sa-section-title"><h2>部件清单 <small>{{ parts.length.toString().padStart(2, '0') }}</small></h2><button :disabled="disabled" @click="emit('add')">＋ 添加部件</button></div>
    <p class="sa-muted sa-note">按材料、颜色或样式区分；相同重复部件合并编号。</p>
    <div v-if="!parts.length" class="sa-list-empty"><span>01 —</span><h3>从一张样品图片开始</h3><p>自动生成的部件描述将在这里显示，也可以手动添加。</p></div>
    <fieldset v-for="(p, i) in parts" :key="i" class="sa-part" :class="{ active: selected === i }" :disabled="disabled" @focusin="emit('select', i)" @click="emit('select', i)">
      <div class="sa-part-head"><b><span>{{ i + 1 }}</span> 测试部件</b><small :class="{ done: p.confirmed }">{{ p.confirmed ? '已确认' : '待确认' }}</small><button :aria-label="`删除部件 ${i + 1}`" @click.stop="emit('remove', i)">删除</button></div>
      <div class="sa-fields"><label v-for="field in (['material', 'color', 'style'] as const)" :key="field">{{ { material: '推测材料', color: '颜色', style: '样式 / 部件' }[field] }}<input :value="p[field]" @input="emit('update', i, field, ($event.target as HTMLInputElement).value)"/></label></div>
      <label>英文报告描述<textarea :value="p.description" rows="2" @input="emit('update', i, 'description', ($event.target as HTMLTextAreaElement).value)"/></label>
      <button class="sa-confirm" :disabled="p.confirmed || !p.description.trim()" @click.stop="emit('confirm', i)">{{ p.confirmed ? '已确认此部件' : '确认描述与位置' }}</button>
    </fieldset>
    <p class="sa-material-note">材料为图像外观推测，实际成分请结合产品资料确认。</p>
  </aside>
</template>
