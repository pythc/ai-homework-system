import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ensureMathJaxReady, typesetMath } from './utils/mathjax'

async function bootstrap() {
  await ensureMathJaxReady()

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

  await router.isReady()

  app.mount('#app')
}

void bootstrap()
  