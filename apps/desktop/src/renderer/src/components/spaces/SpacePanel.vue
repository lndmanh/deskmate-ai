<script setup lang="ts">
import { Check, Crown, Globe, Heart, LayoutGrid, Search, Volume2, VolumeX, X } from '@lucide/vue'

import { getSpaceThumbnail, useSpaces } from '@/composables/useSpaces'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { getCategoryIcon } from '@/lib/space-categories'
import { cn } from '@/lib/utils'

const {
  isPanelOpen,
  closePanel,
  search,
  categories,
  filteredSpaces,
  selectedSpaceId,
  selectSpace,
  toggleCategory,
  clearCategories,
  isCategorySelected,
  selectedCategories,
  showFavouritesOnly,
  isFavourite,
  toggleFavourite,
  volume,
  isMuted,
  setVolume,
  toggleMute
} = useSpaces()

function onVolumeChange(value: number[] | undefined): void {
  if (value && value.length > 0) setVolume(value[0])
}
</script>

<template>
  <Transition name="space-panel">
    <Card
      v-if="isPanelOpen"
      class="bg-background/85 supports-backdrop-filter:bg-background/70 fixed top-20 left-1/2 z-40 flex max-h-[72vh] w-104 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-xl border py-0 shadow-2xl backdrop-blur-xl"
    >
      <CardHeader class="gap-3 px-4 pt-4 pb-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Globe class="text-primary size-4" />
            <span class="text-sm font-semibold tracking-tight">Spaces</span>
            <Badge variant="secondary" class="ml-1 tabular-nums">
              {{ filteredSpaces.length }}
            </Badge>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-pressed="showFavouritesOnly"
              :class="cn(showFavouritesOnly && 'text-red-500')"
              aria-label="Show favourites only"
              @click="showFavouritesOnly = !showFavouritesOnly"
            >
              <Heart :class="cn('size-4', showFavouritesOnly && 'fill-current')" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Close" @click="closePanel">
              <X class="size-4" />
            </Button>
          </div>
        </div>

        <!-- Search -->
        <div class="relative">
          <Search
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input v-model="search" placeholder="Search spaces…" class="h-9 pl-8" />
        </div>

        <!-- Category filters -->
        <div class="category-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            :class="
              cn(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
                selectedCategories.size === 0
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent text-muted-foreground'
              )
            "
            @click="clearCategories"
          >
            <LayoutGrid class="size-3" />
            All
          </button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            :class="
              cn(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium capitalize transition-colors',
                isCategorySelected(category)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent text-muted-foreground'
              )
            "
            @click="toggleCategory(category)"
          >
            <component :is="getCategoryIcon(category)" class="size-3" />
            {{ category.toLowerCase() }}
            <Check v-if="isCategorySelected(category)" class="size-3" />
          </button>
        </div>
      </CardHeader>

      <Separator />

      <!-- Space list -->
      <CardContent class="p-0">
        <ScrollArea class="h-[46vh]">
          <ul class="grid grid-cols-2 gap-x-3 gap-y-4 p-3">
            <li v-for="space in filteredSpaces" :key="space.id" class="flex flex-col gap-1.5">
              <button
                type="button"
                :class="
                  cn(
                    'group relative aspect-video w-full overflow-hidden rounded-lg transition-shadow',
                    selectedSpaceId === space.id
                      ? 'ring-primary ring-2 ring-offset-1'
                      : 'hover:ring-border hover:ring-2'
                  )
                "
                @click="selectSpace(space)"
              >
                <img
                  v-if="getSpaceThumbnail(space)"
                  :src="getSpaceThumbnail(space) ?? ''"
                  :alt="space.name"
                  loading="lazy"
                  decoding="async"
                  class="bg-muted size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div v-else class="bg-muted size-full" aria-hidden="true" />

                <Crown
                  v-if="space.isPremium"
                  class="absolute bottom-1.5 left-1.5 size-4 text-amber-400 drop-shadow"
                  aria-label="Premium"
                />

                <span
                  role="button"
                  tabindex="0"
                  aria-label="Toggle favourite"
                  :class="
                    cn(
                      'absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50',
                      isFavourite(space.id) && 'text-red-500'
                    )
                  "
                  @click.stop="toggleFavourite(space.id)"
                  @keydown.enter.stop.prevent="toggleFavourite(space.id)"
                  @keydown.space.stop.prevent="toggleFavourite(space.id)"
                >
                  <Heart :class="cn('size-4', isFavourite(space.id) && 'fill-current')" />
                </span>
              </button>
              <span class="text-foreground truncate text-sm font-medium">{{ space.name }}</span>
            </li>
            <li
              v-if="filteredSpaces.length === 0"
              class="text-muted-foreground col-span-2 py-10 text-center text-sm"
            >
              No spaces found.
            </li>
          </ul>
        </ScrollArea>
      </CardContent>

      <Separator />

      <!-- Volume -->
      <CardFooter class="gap-3 px-4 py-1">
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="isMuted ? 'Unmute' : 'Mute'"
          @click="toggleMute"
        >
          <VolumeX v-if="isMuted || volume === 0" class="size-4" />
          <Volume2 v-else class="size-4" />
        </Button>
        <Slider
          :model-value="[isMuted ? 0 : volume]"
          :min="0"
          :max="100"
          :step="1"
          class="flex-1"
          @update:model-value="onVolumeChange"
        />
        <span class="text-muted-foreground w-8 text-right text-xs tabular-nums">
          {{ isMuted ? 0 : volume }}
        </span>
      </CardFooter>
    </Card>
  </Transition>
</template>

<style scoped>
.space-panel-enter-active,
.space-panel-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.space-panel-enter-from,
.space-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, -1.25rem);
}

.category-scroll {
  scrollbar-color: var(--border) transparent;
  scrollbar-width: thin;
}

.category-scroll::-webkit-scrollbar {
  height: 6px;
  background: transparent;
}

.category-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.category-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 9999px;
}
</style>
