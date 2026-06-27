import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * Scroll-into-view reveal trigger, mirroring framer-motion's
 * `whileInView` + `viewport={{ once: true, margin: '-80px' }}`.
 *
 * Bind the returned `setRef` to the element's `:ref`; `visible` flips to true
 * once the element is `margin`px inside the viewport, then stays true.
 *
 * We intentionally avoid IntersectionObserver: the page applies a CSS `zoom`
 * to the document for responsive downscaling, and Chromium's IO rootMargin
 * math is unreliable under `zoom` (it can leave content stuck hidden). A
 * capture-phase scroll listener + getBoundingClientRect uses zoom-correct
 * visual coordinates, so reveals always fire. Each instance removes its own
 * listeners as soon as it has revealed.
 */
export function useReveal(margin = 80) {
  const target = ref<HTMLElement | null>(null)
  const visible = ref(false)
  let raf = 0
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
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      checkInView()
    })
  }

  function cleanup() {
    if (cleaned) return
    cleaned = true
    if (raf) cancelAnimationFrame(raf)
    // capture-phase listener catches scrolls dispatched on any element
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
  }

  onMounted(() => {
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    requestAnimationFrame(checkInView)
    setTimeout(checkInView, 120) // backstop where rAF is throttled
  })

  onBeforeUnmount(cleanup)

  // Function ref: assignable to Vue's VNodeRef for both native elements and
  // dynamic <component> tags.
  function setRef(el: unknown) {
    target.value = (el as HTMLElement | null) ?? null
  }

  return { target, visible, setRef }
}
