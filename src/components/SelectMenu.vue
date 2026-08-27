<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'

type SelectTone = 'dark' | 'light' | 'sand'

interface Props {
  options: string[]
  placeholder: string
  label: string
  tone?: SelectTone
  invalid?: boolean
  describedBy?: string
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'light',
  invalid: false,
  describedBy: undefined,
})

const model = defineModel<string>({ default: '' })
const isOpen = shallowRef(false)
const menuRef = useTemplateRef<HTMLElement>('menu')

const selectedLabel = computed(() => model.value || props.placeholder)
const isPlaceholder = computed(() => !model.value)

function close() {
  isOpen.value = false
}

function select(option: string) {
  model.value = option
  close()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    isOpen.value = true
  }
}

function handleOutsideClick(event: MouseEvent) {
  if (!menuRef.value?.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', handleOutsideClick))
</script>

<template>
  <div ref="menu" class="select-menu" :class="[`select-menu--${props.tone}`, { 'is-open': isOpen, 'is-invalid': props.invalid }]">
    <button
      class="select-trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-invalid="props.invalid || undefined"
      :aria-describedby="props.describedBy"
      :aria-label="props.label"
      @click="isOpen = !isOpen"
      @keydown="handleKeydown"
    >
      <span :class="{ placeholder: isPlaceholder }">{{ selectedLabel }}</span>
      <span class="chevron" aria-hidden="true"></span>
    </button>
    <div v-if="isOpen" class="select-options" role="listbox" :aria-label="props.label">
      <button
        v-for="option in props.options"
        :key="option"
        class="select-option"
        :class="{ selected: option === model }"
        type="button"
        role="option"
        :aria-selected="option === model"
        @click="select(option)"
      >
        <span>{{ option }}</span>
        <span v-if="option === model" aria-hidden="true">Selected</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.select-menu { --select-surface: #fff; --select-ink: #111; --select-line: #a9a9a0; --select-hover: #f2f2ed; --select-accent: #111; position: relative; margin-top: .65rem; font: 500 .9rem/1.35 var(--sans, Arial, sans-serif); letter-spacing: 0; text-transform: none; }
.select-menu--dark { --select-surface: #20201e; --select-ink: #fff; --select-line: #555550; --select-hover: #2b2b28; --select-accent: var(--acid, #c8ff3d); }
.select-menu--sand { --select-surface: #d7c9ad; --select-ink: #171714; --select-line: #5f5749; --select-hover: #ebe2d0; --select-accent: #7e9900; }
.select-trigger { width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .8rem .95rem; border: 1px solid var(--select-line); border-radius: 2px; background: var(--select-surface); color: var(--select-ink); text-align: left; transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease; }
.select-trigger:hover { border-color: var(--select-accent); background: var(--select-hover); }
.select-trigger:focus-visible { outline: none; border-color: var(--select-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--select-accent) 26%, transparent); }
.placeholder { opacity: .64; }
.chevron { width: .58rem; height: .58rem; flex: 0 0 auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; color: var(--select-accent); transform: translateY(-2px) rotate(45deg); transition: transform .18s ease; }
.is-open .chevron { transform: translateY(2px) rotate(225deg); }
.select-options { position: absolute; z-index: 30; top: calc(100% + .4rem); left: 0; right: 0; padding: .35rem; border: 1px solid var(--select-line); background: var(--select-surface); box-shadow: 0 14px 30px #0000002e; animation: option-in .16s ease-out; }
.select-option { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .7rem .72rem; border: 0; border-left: 2px solid transparent; background: transparent; color: var(--select-ink); text-align: left; font: inherit; }
.select-option:hover, .select-option:focus-visible, .select-option.selected { border-left-color: var(--select-accent); background: var(--select-hover); outline: none; }
.select-option span:last-child { color: var(--select-accent); font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.is-invalid .select-trigger { border-color: #ff7a74; }
@keyframes option-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .select-options { animation: none; } }
</style>
