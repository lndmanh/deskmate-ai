# AI SDK Integration — Phân tích Điểm Mạnh / Điểm Yếu

## Kiến trúc đúng cho Electron

```
Renderer (Vue)          Preload Bridge          Main Process (Node.js)
     │                       │                        │
  useChat()  ──sendMsg──►  chatAPI  ──ipcMain──►  streamText(openai)
     │                       │                        │
  displayChunk ◄──chunk──  onChunk  ◄──ipcEvent──  textDelta stream
     │                       │                        │
  onDone()   ◄──done───   onDone   ◄──ipcEvent──  stream.finishReason
```

**Tại sao Main Process?**
- API key chỉ tồn tại trong main process — renderer không bao giờ nhìn thấy key
- Node.js HTTP không bị CORS block
- Có thể dùng `electron.safeStorage` để mã hoá key trên disk

---

## ✅ Điểm Mạnh của AI SDK

| Điểm mạnh | Tại sao quan trọng |
|---|---|
| `streamText` trả về async iterable | Forward từng `textDelta` qua IPC dễ dàng |
| Provider abstraction | Đổi OpenAI → Anthropic → Gemini chỉ cần thay 1 dòng |
| TypeScript-first | Khớp hoàn toàn với codebase Electron + Vue 3 |
| AbortSignal built-in | User có thể huỷ stream đang chạy |
| Token usage tracking | Biết chi phí mỗi cuộc hội thoại |
| Tool calling built-in | Sẵn sàng cho future feature: chat trigger nudge, đọc risk score |
| Message history là plain objects | Dễ serialize, lưu local, truyền qua IPC |

---

## ⚠️ Điểm Yếu & Rủi Ro — và cách xử lý

| Vấn đề | Mức độ | Giải pháp |
|---|---|---|
| IPC không phải stream — Electron dùng message-passing, không phải byte stream | Cao | Forward từng `textDelta` như một IPC event riêng với `streamId` |
| API key bảo mật — key lọt renderer = lộ trong DevTools | Cao | Key chỉ trong main process dùng `electron.safeStorage`; preload không expose key |
| Stream bị ngắt giữa chừng — network lỗi sau 50% response | Trung bình | try/catch quanh async iterable; emit `stream:error` với partial text |
| Không có conversation persistence | Trung bình | Tự quản lý `messages[]`; save to JSON sau mỗi turn |
| Context injection thủ công — AI SDK không biết posture/mood | Trung bình | `systemPromptBuilder` fetch risk state từ Python API trước mỗi call |
| Rate limiting 429 | Thấp-Trung | Exponential backoff 3 retry; emit lỗi rõ nếu vẫn fail |
| Concurrent streams | Thấp | `streamId = uuid()` track mỗi stream; abort stream cũ khi có request mới |

---

## Thứ tự Build

```
A1 setup           → cài package, tsconfig             [Haiku]
A2 main_client     → streamText client + system prompt [Opus]
A3 ipc_bridge      → IPC protocol + preload bridge     [Sonnet]
A4 renderer_util   → Vue composable sử dụng bridge     [Sonnet]
A5 error_apikey    → API key storage + error handling  [Sonnet]
```
