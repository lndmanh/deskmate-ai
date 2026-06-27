# AI SDK Integration — Checklist đồng đội

> Cập nhật: 27/06/2026 — sau khi pull branch

---

## ✅ Đã xong

- [x] Cài `ai`, `@ai-sdk/openai` — package.json đã có
- [x] `config.ts` — model `gpt-4o-mini`, params mặc định
- [x] `types.ts` — ChatMessage, ChatRequest, DeskMateContext, stream event types
- [x] `client.ts` — ChatClient với streamText, abort theo streamId, trả partialText khi lỗi
- [x] `system-prompt.ts` — inject context tư thế/mood vào system prompt tiếng Việt
- [x] `useChat.ts` — Vue composable: send, abort, clear, streaming state
- [x] `conversation.ts` — load/save message history vào localStorage, giới hạn 20 messages
- [x] `stream-id.ts` — generate unique ID cho mỗi stream

---

## ❌ Còn thiếu — cần làm để app chạy được

- [ ] **`CHAT_IPC` constants** — append vào `types.ts` (xem `A3_ipc_bridge.md`)
- [ ] **`ipc.ts`** — IPC handlers trong main process kết nối ChatClient với renderer
- [ ] **`preload/index.ts`** — expose `window.chatAPI` lên renderer (hiện vẫn là `api = {}`)
- [ ] **`preload/index.d.ts`** — TypeScript types cho `window.chatAPI`
- [ ] **`main/index.ts`** — gọi `registerChatIpcHandlers(mainWindow)` sau createWindow()
- [ ] **Xoá test comment** ở cuối `client.ts`

---

## ⚠️ Nên làm trước demo

- [ ] `api-key-store.ts` — lưu API key mã hoá bằng `electron.safeStorage`
- [ ] `error-handler.ts` — parse lỗi 401/429/timeout thành message tiếng Việt
- [ ] Wire `parseChatError` vào `client.ts` catch block
- [ ] Thay stub key trong `ipc.ts` bằng `ApiKeyStore`

---

## Thứ tự ưu tiên

```
1. A3 — IPC Bridge       → app mới giao tiếp được với ChatClient
2. A5 — Key + Errors     → key persist sau restart, lỗi rõ ràng
3. UI chat component     → dùng useChat() để render
```

---

## Ghi chú kỹ thuật quan trọng

| Vấn đề | Đã xử lý chưa |
|---|---|
| `window.chatAPI` chưa tồn tại → `useChat.ts` crash | ❌ Cần A3 |
| API key mất khi restart app | ❌ Cần A5 |
| Test comment còn trong `client.ts` | ❌ Xoá trước merge |
| `onChunk/onDone/onError` phải trả cleanup `() => void` | ✅ useChat.ts đã xử lý đúng |
| Listener register trước khi send (tránh race condition) | ✅ useChat.ts đúng thứ tự |
| AI SDK v7: dùng `inputTokens`/`outputTokens` không phải `promptTokens` | ✅ client.ts đúng |
