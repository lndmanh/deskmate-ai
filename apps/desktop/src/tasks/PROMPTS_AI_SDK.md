# Claude Code Prompts — AI SDK Integration

Mở Claude Code từ `apps/desktop/`:
```bash
cd apps/desktop
claude
```

---

## PROMPT A1 — Setup (Haiku, default)

```
Read src/tasks/A1_setup.md.

Run exactly:
  npm install ai @ai-sdk/openai electron-store zod

Then create:
  src/main/features/chat/config.ts
  src/main/features/chat/types.ts

Use the exact code from the task file. Do not add extra fields or change type names.

Verify with: npx tsc --noEmit
Fix any type errors before finishing.
```

---

## PROMPT A2 — Main Client (Opus, ultrathink)

```
Read src/tasks/A2_main_client.md in full.
Also read src/main/features/chat/config.ts and src/main/features/chat/types.ts first.

Create:
  src/main/features/chat/system-prompt.ts
  src/main/features/chat/client.ts

Critical requirements:
1. system-prompt.ts must skip undefined context fields — never output "Tư thế: undefined"
2. ChatClient.stream() must iterate result.textStream with for-await — do not use .on('chunk')
3. abort() must be called at start of stream() if same streamId already active
4. onError must receive partialText accumulated before the error occurred
5. AbortSignal abort = silent return, not an onError emit
6. No `any` types anywhere

After implementing, add a temporary test at the bottom of client.ts:
  // TEST — remove before commit
  // const client = new ChatClient()
  // client.stream('sk-test', { streamId: 'x', messages: [{ role: 'user', content: 'ping' }] }, {
  //   onChunk: (e) => console.log('chunk:', e.delta),
  //   onDone: (e) => console.log('done:', e),
  //   onError: (e) => console.error('error:', e),
  // })

Run: npx tsc --noEmit
```

---

## PROMPT A3 — IPC Bridge (Sonnet, think)

```
Read src/tasks/A3_ipc_bridge.md in full.
Also read src/main/index.ts and src/preload/index.ts first to understand current structure.

Create:
  src/main/features/chat/ipc.ts

Modify:
  src/preload/index.ts  — replace empty `api` object with chatAPI from task file
  src/preload/index.d.ts — add Window.chatAPI type declaration
  src/main/index.ts — import registerChatIpcHandlers and call it after createWindow()

Critical:
- onChunk / onDone / onError in preload MUST return a cleanup function () => void
  so callers can removeListener. This prevents memory leaks across hot reloads.
- CHAT_IPC constants must be imported from types.ts — do not hardcode strings
- ipc.ts uses ApiKeyStore from ./api-key-store — create a stub if A5 not done yet:
  class ApiKeyStore { hasKey() { return false } getKey() { return null } }

Run: npx tsc --noEmit
Verify: start the app with `npm run dev`, open DevTools, run:
  window.chatAPI
  // Should print the chatAPI object with 7 methods
```

---

## PROMPT A4 — Renderer Composable (Sonnet, think)

```
Read src/tasks/A4_renderer_util.md in full.
Also read src/renderer/src/composables/useAppReady.ts to understand composable patterns used here.

Create:
  src/renderer/src/lib/stream-id.ts
  src/renderer/src/lib/conversation.ts
  src/renderer/src/composables/useChat.ts

Critical:
- Register onChunk/onDone/onError listeners BEFORE calling window.chatAPI.send()
  to avoid race condition where chunks arrive before listeners are attached
- clearListeners() must be called in onDone, onError, and abort() — never leave orphan listeners
- streamingText accumulates during stream, gets committed to messages[] on onDone, then resets to ''
- Listener callbacks must check event.streamId === currentStreamId before acting
- No `any` types
- conversation.ts uses localStorage — this is fine for Electron renderer process

Run: npx tsc --noEmit
```

---

## PROMPT A5 — API Key & Error Handling (Sonnet, think)

```
Read src/tasks/A5_error_apikey.md in full.
Also read src/main/features/chat/client.ts to understand where parseChatError plugs in.

Create:
  src/main/features/chat/api-key-store.ts
  src/main/features/chat/error-handler.ts

Then modify src/main/features/chat/client.ts:
- Import parseChatError from ./error-handler
- In the catch block: call parseChatError(error), if code === 'STREAM_ABORTED' return silently,
  otherwise call callbacks.onError with parsed.message

Critical:
- safeStorage requires app to be ready — wrap saveKey/getKey in try/catch
- KEY_FILE path uses app.getPath('userData') — do NOT hardcode a path
- validateKey uses native fetch (available in Electron main process Node 18+)
- deleteKey must also reset this.cachedKey = null

If safeStorage.isEncryptionAvailable() returns false (some Linux setups),
fall back to storing key in plain text with a console.warn — do not crash.

Run: npx tsc --noEmit
```

---

## Thứ tự thực thi

```
Terminal 1: PROMPT A1  (Haiku, ~10 min)
     ↓
Terminal 1: PROMPT A2  (Opus, ~20 min)
Terminal 2: PROMPT A5  (Sonnet, ~15 min)  ← chạy song song với A2
     ↓
Terminal 1: PROMPT A3  (Sonnet, ~15 min)
     ↓
Terminal 1: PROMPT A4  (Sonnet, ~15 min)
```

## Commit order

```
feat: cài ai sdk và định nghĩa types chat
feat: thêm chat client với streamText và system prompt builder
feat: thêm lưu trữ api key an toàn và xử lý lỗi
feat: thêm ipc bridge cho streaming chat giữa main và renderer
feat: thêm composable useChat và quản lý lịch sử hội thoại
```
