<script setup lang="ts">
import { devtools } from '@vue/devtools'

if (process.env.NODE_ENV === 'development')
  devtools.connect(/* host (the default is "http://localhost"), port (the default is 8090) */)
</script>

<template>
  <RouterView />
</template>
