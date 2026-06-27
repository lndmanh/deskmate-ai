import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { useAppReady } from './composables/useAppReady'

createApp(App).use(router).mount('#app')

// Replace with real boot work (config load, IPC handshake, etc.) before calling markReady().
useAppReady().markReady()
