import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * Scroll-into-view reveal trigger, mirroring framer-motion's
 * `whileInView` + `viewport={{ once: true, margin: '-80px' }}`.
 *
 * Bind the returned `setRef` to the element's `:ref`; `visible` flips to true
 * once the element is `margin`px inside the viewport, then stays true.
 *
 * Design notes:
 * - No IntersectionObserver: the page applies a responsive CSS `zoom`, and
 *   Chromium's IO rootMargin math is unreliable under `zoom`.
 *   getBoundingClientRect uses zoom-correct visual coordinates instead.
 * - Throttled with setTimeout, not requestAnimationFrame: rAF is frozen in
 *   occluded/background windows, whereas timers keep running, so reveals fire
 *   regardless of window visibility. Each instance drops its listeners as soon
 *   as it has revealed.
 */
export function useReveal(margin = 80) {
  const target = ref<HTMLElement | null>(null)
  const visible = ref(false)
  let scheduled = false
  let cleaned = false

  function checkInView() {
    if (visible.value) return
    const el = target.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    if (r.top < vh - margin && r.bottom > margin) {
      visible.value = true
      cleanup()
    }
  }

  function onScroll() {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      checkInView()
    }, 16)
  }

  function cleanup() {
    if (cleaned) return
    cleaned = true
    // capture phase catches scrolls dispatched on any element/container
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
  }

  onMounted(() => {
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    checkInView() // reveal anything already on screen immediately
    setTimeout(checkInView, 120) // backstop after fonts/layout settle
  })

  onBeforeUnmount(cleanup)

  // Function ref: assignable to Vue's VNodeRef for native elements and dynamic
  // <component> tags alike.
  function setRef(el: unknown) {
    target.value = (el as HTMLElement | null) ?? null
  }

  return { target, visible, setRef }
}
