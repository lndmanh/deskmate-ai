<script setup lang="ts">
import { Bot, Send, Sparkles } from '@lucide/vue'
import { AnimatePresence, motion } from 'motion-v'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { useMascot } from '@/composables/useMascot'

const { playMotion } = useMascot()

const message = ref('')
const isSending = ref(false)
const errorMessage = ref<string | null>(null)
const latestReply = ref<string | null>(null)

const trimmedMessage = computed(() => message.value.trim())
const canSend = computed(() => trimmedMessage.value.length > 0 && !isSending.value)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Could not reach mascot chat.'
}

async function sendMessage(): Promise<void> {
  if (!canSend.value) return

  const outgoingMessage = trimmedMessage.value
  isSending.value = true
  errorMessage.value = null

  try {
    const response = await window.api.mascotChat.sendMessage({ message: outgoingMessage })
    latestReply.value = response.message
    message.value = ''
    if (!playMotion(response.motion)) playMotion('happy')
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
    playMotion('liked')
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <div
    class="fixed bottom-4 left-1/2 z-30 w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2"
  >
    <motion.div
      :initial="{ opacity: 0, y: 16, scale: 0.98 }"
      :animate="{ opacity: 1, y: 0, scale: 1 }"
      :transition="{ type: 'spring', stiffness: 260, damping: 28, mass: 0.8 }"
    >
      <form
        class="bg-background/90 supports-backdrop-filter:bg-background/75 flex flex-col gap-2 rounded-xl border p-2 shadow-2xl backdrop-blur-xl"
        aria-label="Mascot chat"
        @submit.prevent="sendMessage"
      >
        <AnimatePresence>
          <motion.p
            v-if="latestReply && !errorMessage"
            key="mascot-reply"
            class="text-muted-foreground flex items-start gap-2 px-2 pt-1 text-xs leading-relaxed"
            aria-live="polite"
            :initial="{ opacity: 0, y: 4 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -4 }"
            :transition="{ duration: 0.16 }"
          >
            <Sparkles class="text-primary mt-0.5 size-3.5 shrink-0" />
            <span>{{ latestReply }}</span>
          </motion.p>
        </AnimatePresence>

        <FieldGroup class="gap-2">
          <Field :data-invalid="errorMessage ? true : undefined" class="gap-1.5">
            <FieldLabel for="mascot-chat-message" class="sr-only">Message for DeskMate</FieldLabel>
            <InputGroup
              class="bg-background/70 supports-backdrop-filter:bg-background/50 min-h-11 rounded-lg shadow-none backdrop-blur"
            >
              <InputGroupAddon align="inline-start" class="pl-3 pr-1">
                <Bot class="text-primary size-4" aria-hidden="true" />
              </InputGroupAddon>

              <InputGroupTextarea
                id="mascot-chat-message"
                v-model="message"
                placeholder="Ask DeskMate anything…"
                rows="1"
                :disabled="isSending"
                :aria-invalid="errorMessage ? true : undefined"
                :aria-describedby="errorMessage ? 'mascot-chat-error' : undefined"
                class="max-h-32 min-h-11 py-3 text-sm"
              />

              <InputGroupAddon align="inline-end" class="pl-1 pr-2">
                <Button
                  type="submit"
                  size="icon-sm"
                  class="rounded-full"
                  :disabled="!canSend"
                  :aria-label="isSending ? 'Sending message' : 'Send message'"
                >
                  <Spinner v-if="isSending" size="sm" class="text-current" />
                  <Send v-else aria-hidden="true" />
                </Button>
              </InputGroupAddon>
            </InputGroup>

            <FieldError
              v-if="errorMessage"
              id="mascot-chat-error"
              class="px-2 text-xs"
              :errors="[errorMessage]"
            />
          </Field>
        </FieldGroup>
      </form>
    </motion.div>
  </div>
</template>
