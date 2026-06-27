/**
 * IPC channel names for mascot chat.
 *
 * Kept dependency-free so both the main process and preload bridge can import
 * it without pulling the AI SDK into the preload bundle.
 */
export const CHAT_CHANNELS = {
  sendMascotMessage: 'chat:mascot:send-message'
}
