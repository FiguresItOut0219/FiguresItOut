import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

/**
 * 白屏兜底。
 *
 * Vue 初始化或渲染期一旦抛异常，默认表现就是 <div id="app"> 空着——用户看到一片白，
 * 控制台之外没有任何线索。这里在 app 确实为空时把错误渲染出来，让问题可诊断。
 * 页面已经正常渲染过内容时不会触发，不影响正常使用。
 */
let fatalShown = false

function showFatal(error: unknown) {
  if (fatalShown) return
  const target = document.getElementById('app')
  // 只有真的空屏才介入；已经渲染出内容就不动它
  if (!target || target.childElementCount > 0) return
  fatalShown = true

  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  target.innerHTML =
    '<div style="max-width:640px;margin:12vh auto;padding:24px 28px;border:1px solid #d8d8d2;border-radius:10px;' +
    'background:#fff;font:14px/1.7 system-ui,sans-serif;color:#111">' +
    '<strong style="display:block;margin-bottom:8px">页面加载失败</strong>' +
    '<span style="color:#686864">前端脚本抛出异常，请按 Ctrl+Shift+R 强刷；仍有问题请把下面这行发给开发者：</span>' +
    '<pre style="margin:12px 0 0;padding:10px;background:#f5f5f5;border-radius:6px;overflow:auto;font-size:12px"></pre>' +
    '</div>'
  const pre = target.querySelector('pre')
  if (pre) pre.textContent = detail
}

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  console.error('[vue]', error, info)
  showFatal(error)
}

window.addEventListener('error', (event) => showFatal(event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => showFatal((event as PromiseRejectionEvent).reason))

app.use(router).mount('#app')
