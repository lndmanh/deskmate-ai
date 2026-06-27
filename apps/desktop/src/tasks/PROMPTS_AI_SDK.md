# Claude Code Prompts — AI SDK Integration
# Cập nhật theo code thực tế đã pull

## Trạng thái hiện tại

| Task | File | Trạng thái |
|---|---|---|
| A1 | config.ts, types.ts | ✅ Xong |
| A2 | client.ts, system-prompt.ts | ✅ Xong |
| A4 | useChat.ts, conversation.ts, stream-id.ts | ✅ Xong |
| A3 | ipc.ts, preload/index.ts | ❌ Chưa có — làm ngay |
| A5 | api-key-store.ts, error-handler.ts | ❌ Chưa có |

**Làm A3 trước — app không chạy được nếu thiếu.**

---

## PROMPT A3 — IPC Bridge (Sonnet, think) ← LÀM NGAY

```
Read src/tasks/A3_ipc_bridge.md in full.

Also read these files first to understand the current state:
- src/main/features/chat/types.ts
- src/main/features/chat/client.ts
- src/preload/index.ts  (currently has empty api = {})
- src/main/index.ts

Do the following in order:

1. Append CHAT_IPC constants to src/main/features/chat/types.ts
   (do not rewrite the file — only append the export const CHAT_IPC block)

2. Create src/main/features/chat/ipc.ts
   Use env var OPENAI_API_KEY as stub key for now — ApiKeyStore comes in A5.

3. Replace src/preload/index.ts entirely with the version in the task file.
   Critical: onChunk/onDone/onError must return () => void cleanup functions.

4. Replace src/preload/index.d.ts entirely with the version in the task file.

5. Modify src/main/index.ts:
   - Add import for registerChatIpcHandlers and cleanupChatIpcHandlers
   - Call registerChatIpcHandlers(mainWindow) after createWindow()
   - Add app.on('before-quit', () => cleanupChatIpcHandlers())

6. Remove the test comment block at the bottom of src/main/features/chat/client.ts

Run: npx tsc --noEmit
Fix all type errors before finishing.

Verify by running npm run dev, opening DevTools console, and running:
  typeof window.chatAPI   // should print "object"
  Object.keys(window.chatAPI)  // should show 7 keys
```

---

## PROMPT A5 — API Key & Error Handling (Sonnet, think) ← SAU A3

```
Read src/tasks/A5_error_apikey.md in full.
Also read src/main/features/chat/ipc.ts (created in A3) and src/main/features/chat/client.ts.

Do the following in order:

1. Create src/main/features/chat/api-key-store.ts
2. Create src/main/features/chat/error-handler.ts

3. Update src/main/features/chat/ipc.ts:
   - Remove the _apiKey variable and env var stub
   - Import ApiKeyStore and replace the 3 stub ipcMain.handle calls
   - Keep OPENAI_API_KEY as fallback: keyStore.getKey() ?? process.env['OPENAI_API_KEY'] ?? null

4. Update src/main/features/chat/client.ts catch block:
   - Import parseChatError from ./error-handler
   - If parsed.code === 'STREAM_ABORTED' return silently
   - Otherwise pass parsed.message to callbacks.onError

Run: npx tsc --noEmit
Test: set OPENAI_API_KEY in .env, run npm run dev, open DevTools, call:
  await window.chatAPI.validateKey('sk-invalid')
  // Should return { valid: false, error: '...' }
```

---

## Thứ tự và thời gian ước tính

```
Bây giờ:   PROMPT A3  (Sonnet, think)   ~20 phút
Sau A3:    PROMPT A5  (Sonnet, think)   ~15 phút
Sau A5:    Bắt đầu build UI chat component
```
