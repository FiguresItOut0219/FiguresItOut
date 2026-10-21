<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { X } from 'lucide-vue-next'
defineProps<{ title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = shallowRef<HTMLDialogElement | null>(null)
onMounted(() => dialog.value?.showModal())
</script>
<template><dialog ref="dialog" class="company-dialog" :class="{wide}" @cancel.prevent="emit('close')"><header><h2>{{ title }}</h2><button class="company-icon-button" @click="emit('close')" aria-label="关闭弹窗"><X :size="19"/></button></header><slot/></dialog></template>
