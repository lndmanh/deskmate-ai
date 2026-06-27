<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import HexLoader from '@/components/HexLoader.vue'
import { useAppReady } from '@/composables/useAppReady'
import { isOnboardingComplete } from '@/components/onboarding/storage'

const router = useRouter()
const { whenReady } = useAppReady()

onMounted(async () => {
  await whenReady()
  router.replace({ name: (await isOnboardingComplete()) ? 'home' : 'onboarding' })
})
</script>

<template>
  <HexLoader />
</template>
