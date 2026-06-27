import { useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import rawSpaces from '@/assets/spaces.json'
import type { Space, SpacesFile } from '@/types/space'

const FAVOURITES_STORAGE_KEY = 'deskmate:favourite-spaces'
const SELECTED_STORAGE_KEY = 'deskmate:selected-space'

const data: SpacesFile = rawSpaces

// Only surface spaces that are ready to show (shown unless explicitly flagged otherwise).
const availableSpaces: Space[] = data.spaces.filter(
  (space) => space.isProdReady !== false && !space.removed
)

/** Extract the YouTube video id from an embed url and build a thumbnail url. */
export function getSpaceThumbnail(space: Space): string | null {
  if (space.thumbnailUrl && space.thumbnailUrl.length > 0) return space.thumbnailUrl
  const match = space.videoUrl.match(/\/embed\/([^?/&]+)/)
  const videoId = match?.[1]
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null
}

const isPanelOpen = ref(false)

// Persist the last selected space, falling back to the first available one.
const selectedSpaceId = useStorage<string | null>(SELECTED_STORAGE_KEY, null)
if (!selectedSpaceId.value || !availableSpaces.some((space) => space.id === selectedSpaceId.value))
  selectedSpaceId.value = availableSpaces[0]?.id ?? null

const search = ref('')
const selectedCategories = ref<Set<string>>(new Set())
const showFavouritesOnly = ref(false)

// Persisted list of favourite space ids.
const favouriteIds = useStorage<string[]>(FAVOURITES_STORAGE_KEY, [])

// Audio is muted by default so the YouTube background can autoplay.
const volume = ref(50)
const isMuted = ref(true)

const categories = computed(() => data.activeCategories)

const selectedSpace = computed(
  () => availableSpaces.find((space) => space.id === selectedSpaceId.value) ?? null
)

const filteredSpaces = computed(() => {
  const query = search.value.trim().toLowerCase()

  return availableSpaces.filter((space) => {
    if (showFavouritesOnly.value && !favouriteIds.value.includes(space.id)) return false
    if (selectedCategories.value.size > 0 && !selectedCategories.value.has(space.category))
      return false
    if (query.length > 0 && !space.name.toLowerCase().includes(query)) return false
    return true
  })
})

function openPanel(): void {
  isPanelOpen.value = true
}

function closePanel(): void {
  isPanelOpen.value = false
}

function togglePanel(): void {
  isPanelOpen.value = !isPanelOpen.value
}

function selectSpace(space: Space): void {
  selectedSpaceId.value = space.id
}

function toggleCategory(category: string): void {
  const next = new Set(selectedCategories.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  selectedCategories.value = next
}

function clearCategories(): void {
  selectedCategories.value = new Set()
}

function isCategorySelected(category: string): boolean {
  return selectedCategories.value.has(category)
}

function isFavourite(id: string): boolean {
  return favouriteIds.value.includes(id)
}

function toggleFavourite(id: string): void {
  if (favouriteIds.value.includes(id))
    favouriteIds.value = favouriteIds.value.filter((favourite) => favourite !== id)
  else favouriteIds.value = [...favouriteIds.value, id]
}

function setVolume(value: number): void {
  volume.value = value
  if (value > 0) isMuted.value = false
}

function toggleMute(): void {
  isMuted.value = !isMuted.value
}

export function useSpaces() {
  return {
    // state
    isPanelOpen,
    selectedSpace,
    selectedSpaceId,
    search,
    selectedCategories,
    showFavouritesOnly,
    categories,
    filteredSpaces,
    favouriteIds,
    volume,
    isMuted,
    // actions
    openPanel,
    closePanel,
    togglePanel,
    selectSpace,
    toggleCategory,
    clearCategories,
    isCategorySelected,
    isFavourite,
    toggleFavourite,
    setVolume,
    toggleMute
  }
}
