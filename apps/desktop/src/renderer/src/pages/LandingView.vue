<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import LandingHeader from '@/components/landing/LandingHeader.vue'
import AnimatedHeading from '@/components/landing/AnimatedHeading.vue'
import AnimatedText from '@/components/landing/AnimatedText.vue'
import MaskedImage from '@/components/landing/MaskedImage.vue'
import ModulesCarousel from '@/components/landing/ModulesCarousel.vue'
import { ASSETS } from '@/lib/landing-assets'

const TT = '"TT Hoves", "Helvetica Neue", Helvetica, Arial, sans-serif'

const scrollRoot = ref<HTMLElement | null>(null)
const scrolled = ref(false)

function onScroll() {
  const el = scrollRoot.value
  if (!el) return
  // Logo swaps to dark once we scroll past the dark hero.
  scrolled.value = el.scrollTop > window.innerHeight - 80
}

// Responsive zoom: uniformly downscale the document below 1728px so every
// pixel value below is authored at the 1728px reference width.
function applyZoom() {
  const w = document.documentElement.clientWidth
  if (!w) return // guard: never scale to 0 on a transient zero-width measurement
  const z = w < 1728 ? w / 1728 : 1
  ;(document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = String(z)
}

onMounted(() => {
  applyZoom()
  window.addEventListener('resize', applyZoom)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', applyZoom)
  ;(document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = ''
})

// "Why a reminder app isn't enough" — the gaps DeskMate fills. Card 02 is
// rendered image-first (reversed), matching the original layout.
const benefits = [
  {
    n: '(01)',
    title: 'Invisible',
    desc: 'Strain rarely arrives in a single moment. It builds quietly across days of long sessions, skipped breaks, and poor posture — until your body or mind suddenly forces you to stop.',
    img: ASSETS.clockLamp
  },
  {
    n: '(02)',
    title: 'Generic',
    desc: 'One-size-fits-all break reminders do not understand your workday. A developer, a support agent, and a manager each strain differently and need different help at different times.',
    img: ASSETS.pills
  },
  {
    n: '(03)',
    title: 'Surveilled',
    desc: 'Monitoring tools make people feel watched. DeskMate stays private by default — local-first, user-owned, and raw webcam frames are never stored.',
    img: ASSETS.waitlist
  }
]

const gridLineStyle = {
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.45) 1px, transparent 1px)',
  backgroundSize: '1px 100%, 1px 100%',
  backgroundPosition: '33.3333% 0, 66.6666% 0',
  backgroundRepeat: 'no-repeat'
}
const hLineStyle = {
  background:
    'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.45) 15%, rgba(255,255,255,0.45) 85%, transparent 100%)'
}
</script>

<template>
  <div
    ref="scrollRoot"
    class="landing-page h-screen overflow-y-auto bg-background text-foreground"
    @scroll="onScroll"
  >
    <LandingHeader :dark="scrolled" />

    <main>
      <!-- ============ HERO ============ -->
      <section class="relative h-screen min-h-[780px] w-full overflow-hidden">
        <img
          :src="ASSETS.doctorComputer"
          alt="Person working at a computer"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <div class="absolute inset-0 bg-black/25"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>

        <div class="absolute inset-0 flex flex-col justify-end pb-16 px-8 md:px-12">
          <div class="flex items-end justify-between gap-8">
            <!-- left column -->
            <div class="max-w-3xl">
              <AnimatedHeading as="h1" class="text-white font-medium leading-[1.05]">
                <span style="font-size: 72.73px; line-height: 1.05; display: block">
                  Your Personal<br />Work-Wellness Hub
                </span>
              </AnimatedHeading>
              <div class="mt-8 w-max">
                <AnimatedText class="text-white/85 max-w-xl leading-relaxed">
                  <span style="font-size: 20.99px; line-height: 28.21px; display: block; width: 608px">
                    Meet your personal work-wellness hub — a local-first, modular companion that
                    understands your workday and helps protect your body, energy, focus, and recovery
                    with friendly, private nudges.
                  </span>
                </AnimatedText>
              </div>
            </div>

            <!-- right column -->
            <div class="flex items-center gap-6 shrink-0 pb-1">
              <button
                class="bg-white text-foreground rounded-full pl-6 pr-2 py-2 flex items-center gap-3 font-medium text-sm hover:bg-white/90 transition"
              >
                Try for Free
                <span
                  class="w-9 h-9 rounded-full bg-foreground text-white flex items-center justify-center"
                >
                  <ArrowUpRight class="w-4 h-4" />
                </span>
              </button>
              <a href="#" class="text-white flex items-center gap-1 text-sm font-medium">
                Watch Demo <ArrowUpRight class="w-4 h-4" />
              </a>
            </div>
          </div>

          <!-- footer strip -->
          <div
            class="border-t border-white/20 flex items-center justify-between tracking-[0.2em] text-white/70 uppercase mt-12 pt-5"
            style="font-size: 12px"
          >
            <span>Local-First Work-Wellness Hub</span>
            <span class="flex items-center gap-6">
              <span><span class="text-white">01</span> / 04</span>
              <span>Next</span>
            </span>
            <span>Scroll to Explore</span>
          </div>
        </div>
      </section>

      <!-- ============ MODULES ============ -->
      <section class="py-32 px-8 md:px-12" :style="{ fontFamily: TT }">
        <div style="padding-left: 335.26px">
          <div
            class="mb-16 flex gap-24 tracking-[0.2em] uppercase text-muted-foreground"
            :style="{ fontSize: '11.26px', fontFamily: TT }"
          >
            <span>DeskMate AI</span>
            <span>Modules</span>
          </div>
          <AnimatedHeading class="font-medium leading-[1.05]">
            <span style="font-size: 58.55px; line-height: 1.05; display: block">
              Meet the Modules that<br />Get It All Done
            </span>
          </AnimatedHeading>
        </div>

        <div class="mt-20">
          <ModulesCarousel>
            <template #intro>
              <AnimatedText class="text-muted-foreground leading-relaxed">
                <span style="font-size: 16.89px; line-height: 1.5; display: block; width: 270px">
                  DeskMate is modular by design. Switch on only the modules that fit your work and
                  life, and the AI fuses their signals to understand your day.
                </span>
              </AnimatedText>
            </template>
          </ModulesCarousel>
        </div>
      </section>

      <!-- ============ BENEFITS ============ -->
      <section class="py-32 px-8 md:px-12 bg-[var(--surface)]">
        <div class="grid grid-cols-12 gap-12 mb-24">
          <div class="col-span-12 md:col-span-7">
            <AnimatedHeading class="text-5xl md:text-6xl font-medium leading-[1.05]">
              Why a Reminder App<br />Isn't Enough
            </AnimatedHeading>
          </div>
          <div class="col-span-12 md:col-span-4 md:col-start-9 md:pt-4">
            <AnimatedText class="text-base text-muted-foreground leading-relaxed">
              Existing tools each miss something. Productivity trackers ignore your body, posture
              apps ignore context, generic wellness apps do not understand your workday, and
              monitoring tools feel like surveillance.
            </AnimatedText>
          </div>
        </div>

        <div class="relative grid grid-cols-1 md:grid-cols-3" :style="gridLineStyle">
          <span
            aria-hidden="true"
            class="pointer-events-none absolute left-0 right-0 top-0 h-px"
            :style="hLineStyle"
          ></span>
          <span
            aria-hidden="true"
            class="pointer-events-none absolute left-0 right-0 bottom-0 h-px"
            :style="hLineStyle"
          ></span>

          <div v-for="(b, i) in benefits" :key="i" class="p-10 flex flex-col gap-8">
            <!-- card 02 is reversed: image on top -->
            <template v-if="i === 1">
              <div class="aspect-square overflow-hidden">
                <MaskedImage :src="b.img" :alt="b.title" class="w-full h-full" :delay="i * 0.12" />
              </div>
              <div class="mt-auto">
                <div class="flex items-start gap-3 mb-4">
                  <span class="text-xs text-muted-foreground mt-2">{{ b.n }}</span>
                  <AnimatedHeading as="h3" class="text-3xl font-medium" :delay="i * 0.1">
                    {{ b.title }}
                  </AnimatedHeading>
                </div>
                <AnimatedText
                  class="text-sm text-muted-foreground leading-relaxed max-w-sm"
                  :delay="0.2 + i * 0.1"
                >
                  {{ b.desc }}
                </AnimatedText>
              </div>
            </template>

            <!-- cards 01 & 03: content on top, image on bottom -->
            <template v-else>
              <div>
                <div class="flex items-start gap-3 mb-4">
                  <span class="text-xs text-muted-foreground mt-2">{{ b.n }}</span>
                  <AnimatedHeading as="h3" class="text-3xl font-medium" :delay="i * 0.1">
                    {{ b.title }}
                  </AnimatedHeading>
                </div>
                <AnimatedText
                  class="text-sm text-muted-foreground leading-relaxed max-w-sm"
                  :delay="0.2 + i * 0.1"
                >
                  {{ b.desc }}
                </AnimatedText>
              </div>
              <div class="mt-auto">
                <div class="aspect-square overflow-hidden">
                  <MaskedImage :src="b.img" :alt="b.title" class="w-full h-full" :delay="i * 0.12" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
