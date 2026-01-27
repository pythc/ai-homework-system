import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// // 可选：全局样式
// import './styles/global.css'

// 创建应用实例
const app = createApp(App)

// 注册路由
app.use(router)

// 挂载到 #app
app.mount('#app')
