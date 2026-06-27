import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'loader',
      component: () => import('@/pages/LoaderView.vue')
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/pages/HomeView.vue')
    }
  ]
})
