<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ArrowDown, ArrowUpRight, Command, Search, X } from 'lucide-vue-next'
import SiteEntry from './SiteEntry.vue'
import { siteCategories, siteEntries, type SiteCategory } from '@/data/sites'
import './directory.css'
const search = shallowRef('')
const category = shallowRef<SiteCategory | '全部'>('全部')
const groups = computed(() => siteCategories.map(name => ({ name, entries: siteEntries.filter(site => (category.value === '全部' || site.category === category.value) && site.category === name && `${site.name} ${site.subtitle} ${site.description} ${site.tags.join(' ')}`.toLowerCase().includes(search.value.trim().toLowerCase())) })).filter(group => group.entries.length))
const resultCount = computed(() => groups.value.reduce((sum, group) => sum + group.entries.length, 0))
function reset() { search.value = ''; category.value = '全部' }
</script>
<template>
  <div class="directory-page">
    <header class="directory-header"><RouterLink class="directory-brand" to="/" aria-label="FAN 功能导航首页"><span class="directory-mark"><Command :size="22" /></span><b>FAN<span>功能导航</span></b></RouterLink><nav aria-label="首页导航"><a class="directory-nav-active" href="#directory">所有网站</a><RouterLink to="/portfolio">关于与合作<ArrowUpRight :size="13" /></RouterLink></nav><span class="directory-header-note"><i></i> 小工具，大用处。</span></header>
    <main id="main" class="directory-main">
      <section class="directory-intro"><div><p class="directory-eyebrow">THE FAN COLLECTION <span>/ 01</span></p><h1>想做的事，<br/>从这里开始<span>。</span></h1><p class="directory-lead">设计、计算，或是放松一下。<br class="mobile-break"/>所有工具与作品，一个入口就够了。</p></div><div class="directory-index"><span>EXPLORE THE COLLECTION</span><strong>{{ String(siteEntries.length).padStart(2, '0') }}<small>个独立网站</small></strong><a href="#directory">找到你的下一站<ArrowDown :size="16" /></a></div></section>
      <section id="directory" class="directory-catalog" aria-label="功能网站目录">
        <div class="directory-controls"><div class="directory-filters" role="group" aria-label="网站分类"><button v-for="item in ['全部', ...siteCategories] as const" :key="item" :class="{ active: category === item }" :aria-pressed="category === item" @click="category = item">{{ item }}<span>{{ item === '全部' ? siteEntries.length : siteEntries.filter(site => site.category === item).length }}</span></button></div><div class="directory-search"><Search :size="16" aria-hidden="true"/><input v-model="search" aria-label="搜索网站" type="search" placeholder="搜索工具、作品…"/><button v-if="search" aria-label="清空搜索" @click="search = ''"><X :size="15"/></button></div></div>
        <p v-if="search" class="directory-search-summary" role="status">找到 {{ resultCount }} 个与「{{ search }}」相关的网站</p>
        <section v-for="group in groups" :key="group.name" class="directory-group" :aria-label="group.name"><div class="directory-group-title"><h2>{{ group.name }}</h2><span>{{ String(group.entries.length).padStart(2, '0') }}</span><p>{{ group.name === '实用工具' ? '把复杂的事情，交给顺手的工具。' : group.name === '游戏休闲' ? '暂时放下待办，来一局。' : '不同的品牌，不同的数字体验。' }}</p></div><div :class="group.name === '实用工具' ? 'directory-featured-grid' : 'directory-site-list'"><SiteEntry v-for="site in group.entries" :key="site.id" :site="site" :featured="group.name === '实用工具'" /></div></section>
        <div v-if="!resultCount" class="directory-empty"><Search :size="28"/><h2>没有找到相关网站</h2><p>试试“印花”“买房”或“游戏”，也可以查看全部功能。</p><button @click="reset">查看全部网站</button></div>
      </section>
      <aside class="directory-contact"><div><span class="directory-eyebrow">HAVE SOMETHING IN MIND?</span><h2>也想把一个点子，变成好用的网站？</h2></div><RouterLink to="/portfolio#contact">聊聊你的想法<ArrowUpRight :size="18"/></RouterLink></aside>
    </main>
    <footer class="directory-footer"><span>© {{ new Date().getFullYear() }} FAN</span><p>用心做一些，有用的东西。</p><RouterLink to="/game">游戏大厅<ArrowUpRight :size="12"/></RouterLink></footer>
  </div>
</template>
