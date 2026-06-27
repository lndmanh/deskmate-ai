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
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/pages/OnboardingView.vue')
    },
    {
      path: '/activity-test',
      name: 'activity-test',
      component: () => import('@/pages/ActivityTestView.vue')
    },
    {
      path: '/landing',
      name: 'landing',
      component: () => import('@/pages/LandingView.vue')
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('@/pages/ReportView.vue')
    }
  ]
})
