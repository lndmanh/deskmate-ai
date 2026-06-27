<script setup lang="ts">
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy
} from '@pixiv/three-vrm-animation'
import type { VRMAnimation } from '@pixiv/three-vrm-animation'
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Clock,
  DirectionalLight,
  LoopOnce,
  LoopRepeat,
  MOUSE,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three'
import type { AnimationAction, AnimationClip } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useMascot } from '@/composables/useMascot'
import type { MascotDriver, MascotMotion } from '@/types/mascot'

import MascotRadialMenu from './MascotRadialMenu.vue'

// Bundled assets resolved to hashed urls at build time (local-first, no network).
const motionModules = import.meta.glob<string>('../../assets/motions/**/*.vrma', {
  query: '?url',
  import: 'default',
  eager: true
})
const modelModules = import.meta.glob<string>('../../assets/vrmodel/**/*.vrm', {
  query: '?url',
  import: 'default',
  eager: true
})

const motionUrlByFile: Record<string, string> = {}
for (const [path, url] of Object.entries(motionModules)) {
  const marker = '/motions/'
  const index = path.indexOf(marker)
  if (index !== -1) motionUrlByFile[path.slice(index + marker.length)] = url
}

function pickDefaultModelUrl(): string | null {
  const entries = Object.entries(modelModules)
  if (entries.length === 0) return null
  // Default to the round white "Shimaenaga" bird; fall back to the first model.
  const preferred = entries.find(([path]) => path.includes('シマエナガ'))
  return (preferred ?? entries[0])[1]
}

const mascot = useMascot()

const containerRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(true)
const hasError = ref(false)
const isMenuOpen = ref(false)

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let vrm: VRM | null = null
let mixer: AnimationMixer | null = null
let frameHandle = 0
let resizeObserver: ResizeObserver | null = null

const clock = new Clock()
const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))
loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

// Retargeted clips are cached per motion file for the current model.
const clipCache = new Map<string, AnimationClip>()
let idleAction: AnimationAction | null = null
let oneShotAction: AnimationAction | null = null

// Idle blink state machine.
let blinkCooldown = randomBetween(2, 5)
let blinkPhase = 1
let isBlinking = false

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// --- Pointer handling: right-drag orbits (OrbitControls), left-click opens the menu. ---
const pointerStart = { x: 0, y: 0, time: 0 }

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  pointerStart.x = event.clientX
  pointerStart.y = event.clientY
  pointerStart.time = performance.now()
}

function onPointerUp(event: PointerEvent): void {
  if (event.button !== 0) return
  const movement = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
  const elapsed = performance.now() - pointerStart.time
  if (movement < 6 && elapsed < 350) isMenuOpen.value = !isMenuOpen.value
}

async function getClip(motion: MascotMotion): Promise<AnimationClip | null> {
  const cached = clipCache.get(motion.file)
  if (cached) return cached

  const url = motionUrlByFile[motion.file]
  if (!url || !vrm) return null

  const gltf = await loader.loadAsync(url)
  const animations: VRMAnimation[] = gltf.userData.vrmAnimations ?? []
  if (animations.length === 0) return null

  const clip = createVRMAnimationClip(animations[0], vrm)
  clipCache.set(motion.file, clip)
  return clip
}

function currentAction(): AnimationAction | null {
  return oneShotAction ?? idleAction
}

// Driver method exposed through useMascot — the single entry point for the radial
// menu and any programmatic caller (e.g. a chatbot).
function playMotion(motion: MascotMotion): void {
  void playMotionInternal(motion)
}

async function playMotionInternal(motion: MascotMotion): Promise<void> {
  const clip = await getClip(motion)
  if (!clip || !mixer) return

  const action = mixer.clipAction(clip)
  const previous = currentAction()

  if (motion.loop) {
    action.setLoop(LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.reset()
    action.play()
    if (previous && previous !== action) action.crossFadeFrom(previous, 0.4, true)
    else action.fadeIn(0.4)
    idleAction = action
    oneShotAction = null
    return
  }

  action.setLoop(LoopOnce, 1)
  action.clampWhenFinished = true
  action.reset()
  action.play()
  if (previous && previous !== action) action.crossFadeFrom(previous, 0.25, true)
  else action.fadeIn(0.25)
  oneShotAction = action
}

function onMixerFinished(event: { action: AnimationAction }): void {
  // A one-shot ended: ease back into the looping idle pose.
  if (event.action !== oneShotAction || !idleAction) return
  const finished = oneShotAction
  oneShotAction = null
  idleAction.reset()
  idleAction.enabled = true
  idleAction.play()
  idleAction.crossFadeFrom(finished, 0.35, true)
}

function updateBlink(delta: number): void {
  const expressions = vrm?.expressionManager
  if (!expressions) return

  if (!isBlinking) {
    blinkCooldown -= delta
    if (blinkCooldown <= 0) {
      isBlinking = true
      blinkPhase = 0
      blinkCooldown = randomBetween(2, 5)
    }
  }

  if (isBlinking) {
    blinkPhase += delta / 0.12
    expressions.setValue('blink', Math.sin(Math.min(blinkPhase, 1) * Math.PI))
    if (blinkPhase >= 1) {
      isBlinking = false
      expressions.setValue('blink', 0)
    }
  }
}

function frameModel(target: VRM): void {
  if (!camera || !controls) return

  const box = new Box3().setFromObject(target.scene)
  const center = new Vector3()
  const size = new Vector3()
  box.getCenter(center)
  box.getSize(size)

  const fitHeightDistance = size.y / (2 * Math.tan((camera.fov * Math.PI) / 360))
  const fitWidthDistance = size.x / camera.aspect / (2 * Math.tan((camera.fov * Math.PI) / 360))
  const distance = 1.5 * Math.max(fitHeightDistance, fitWidthDistance, 0.1)

  controls.target.copy(center)
  camera.position.set(center.x, center.y, center.z + distance)
  controls.minDistance = distance * 0.5
  controls.maxDistance = distance * 2.5
  controls.update()
}

function resize(): void {
  const container = containerRef.value
  if (!container || !renderer || !camera) return
  const width = container.clientWidth
  const height = container.clientHeight
  if (width === 0 || height === 0) return
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate(): void {
  frameHandle = requestAnimationFrame(animate)
  if (!renderer || !scene || !camera) return

  const delta = clock.getDelta()
  mixer?.update(delta)
  controls?.update()

  if (vrm) {
    updateBlink(delta)
    vrm.update(delta)
  }

  renderer.render(scene, camera)
}

async function init(): Promise<void> {
  const container = containerRef.value
  if (!container) return

  const modelUrl = pickDefaultModelUrl()
  if (!modelUrl) {
    hasError.value = true
    isLoading.value = false
    return
  }

  renderer = new WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  scene = new Scene()
  camera = new PerspectiveCamera(30, 1, 0.1, 20)
  scene.add(camera)

  const keyLight = new DirectionalLight(0xffffff, Math.PI)
  keyLight.position.set(1, 1, 1).normalize()
  scene.add(keyLight)
  scene.add(new AmbientLight(0xffffff, 0.7))

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  // Right-drag orbits; the left button is freed up for click-to-open-menu.
  controls.mouseButtons = { MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }

  resize()

  try {
    const gltf = await loader.loadAsync(modelUrl)
    const loaded: VRM = gltf.userData.vrm

    VRMUtils.rotateVRM0(loaded) // no-op for VRM 1.0 birds; fixes VRM 0.x facing.
    VRMUtils.removeUnnecessaryVertices(loaded.scene)
    loaded.scene.traverse((object) => {
      object.frustumCulled = false
    })

    // Required so VRMA look-at tracks can drive the avatar.
    if (loaded.lookAt) {
      const lookAtProxy = new VRMLookAtQuaternionProxy(loaded.lookAt)
      lookAtProxy.name = 'lookAtQuaternionProxy'
      loaded.scene.add(lookAtProxy)
    }

    vrm = loaded
    scene.add(vrm.scene)
    mixer = new AnimationMixer(vrm.scene)
    mixer.addEventListener('finished', onMixerFinished)
    frameModel(vrm)
    isLoading.value = false
  } catch (error) {
    console.error('Failed to load mascot model:', error)
    hasError.value = true
    isLoading.value = false
    return
  }

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  animate()
  void startup()
}

// Prepare the idle loop, then play the intro once. When the intro finishes,
// `onMixerFinished` eases into the (already prepared) idle pose.
async function startup(): Promise<void> {
  if (!mixer) return

  const idle = mascot.idleMotion.value
  if (idle) {
    const idleClip = await getClip(idle)
    if (idleClip) {
      idleAction = mixer.clipAction(idleClip)
      idleAction.setLoop(LoopRepeat, Infinity)
    }
  }

  const intro = mascot.introMotion.value
  if (intro) {
    const introClip = await getClip(intro)
    if (introClip) {
      const action = mixer.clipAction(introClip)
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.reset().play()
      action.fadeIn(0.2)
      oneShotAction = action
      return
    }
  }

  // No intro to show — settle straight into the idle loop.
  if (idleAction) {
    idleAction.reset().play()
    idleAction.fadeIn(0.4)
  }
}

const driver: MascotDriver = { playMotion }

onMounted(() => {
  mascot.registerDriver(driver)
  void init()
})

onBeforeUnmount(() => {
  mascot.unregisterDriver(driver)
  cancelAnimationFrame(frameHandle)
  renderer?.domElement.removeEventListener('pointerdown', onPointerDown)
  renderer?.domElement.removeEventListener('pointerup', onPointerUp)
  resizeObserver?.disconnect()
  mixer?.removeEventListener('finished', onMixerFinished)
  mixer?.stopAllAction()
  controls?.dispose()
  clipCache.clear()
  if (vrm) {
    scene?.remove(vrm.scene)
    VRMUtils.deepDispose(vrm.scene)
    vrm = null
  }
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
  scene = null
  camera = null
  controls = null
  mixer = null
})
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full [&>canvas]:h-full [&>canvas]:w-full">
    <div
      v-if="isLoading"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
    >
      <span class="animate-pulse">Waking up…</span>
    </div>
    <div
      v-else-if="hasError"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
    >
      Couldn’t load the mascot.
    </div>

    <MascotRadialMenu :open="isMenuOpen" @close="isMenuOpen = false" />
  </div>
</template>
