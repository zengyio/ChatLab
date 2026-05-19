import { createApp } from 'vue'
import App from './App.vue'
import { router } from './routes/'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { backendPersistPlugin } from '@/plugins/backendPersist'
import ui from '@nuxt/ui/vue-plugin'
import i18n from './i18n'
import './assets/styles/main.css'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
pinia.use(backendPersistPlugin)

app.use(pinia)
app.use(router)
app.use(ui)
app.use(i18n)

app.mount('#app')
