import { createApp, nextTick } from 'vue'
import App from './App.vue'
import router from './router'

let mathJaxReady: Promise<void> | null = null

async function setupMathJax() {
  if (mathJaxReady) return mathJaxReady
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    },
  }
  mathJaxReady = (async () => {
    await import('mathjax/es5/tex-chtml.js')
    if (window.MathJax?.startup?.promise) {
      await window.MathJax.startup.promise
    }
  })()
  return mathJaxReady
}

async function typesetMath(target?: HTMLElement) {
  await setupMathJax()
  const mathjax = window.MathJax
  if (!mathjax?.typesetPromise) return
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  if (mathjax.typesetClear) {
    mathjax.typesetClear(target ? [target] : undefined)
  }
  await mathjax.typesetPromise(target ? [target] : undefined)
}

async function bootstrap() {
  const app = createApp(App)
  app.use(router)
  app.directive('mathjax', {
    mounted(el) {
      void typesetMath(el)
    },
    updated(el) {
      void typesetMath(el)
    },
  })

  router.afterEach(async () => {
    await typesetMath()
  })

  await router.isReady()
  app.mount('#app')
  await typesetMath()
}

void bootstrap()
