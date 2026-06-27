// Shared open/closed state for the activity summary popover and the detail
// dialog, so the toolbar button, the draggable popover, and the dialog can all
// coordinate without prop-drilling.
import { ref } from 'vue'

const isPopoverOpen = ref(false)
const isDialogOpen = ref(false)

function togglePopover(): void {
  isPopoverOpen.value = !isPopoverOpen.value
}

function closePopover(): void {
  isPopoverOpen.value = false
}

function openDialog(): void {
  isDialogOpen.value = true
}

function closeDialog(): void {
  isDialogOpen.value = false
}

export function useActivityPanels() {
  return {
    isPopoverOpen,
    isDialogOpen,
    togglePopover,
    closePopover,
    openDialog,
    closeDialog
  }
}
