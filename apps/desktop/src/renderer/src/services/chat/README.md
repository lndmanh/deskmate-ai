# DeskMate Chat client contract

File này để người làm UI ghép chat mà không cần biết OpenAI key hoặc RAG internals.

## Flow

```txt
Frontend input
  -> POST http://127.0.0.1:8000/chat
  -> FastAPI backend
  -> RAG search + OpenAI/fallback
  -> Frontend render answer
```

Frontend **không gọi OpenAI trực tiếp** và **không giữ `OPENAI_API_KEY`**. API key nằm ở backend trong `service_ai/.env`.

## Usage

```ts
import { createDeskMateChatClient } from '@/services/chat'

const chatClient = createDeskMateChatClient()

const response = await chatClient.sendMessage({
  question: 'Bạn có lưu ảnh webcam không?',
  context: {
    postureStatus: 'head_tilt',
    postureScore: 66,
    rawImagesStored: 0
  }
})

console.log(response.answer)
console.log(response.usedLlm)
console.log(response.retrievedDocuments)
```

## Request body sent to backend

```json
{
  "question": "Bạn có lưu ảnh webcam không?",
  "context": {
    "posture_status": "head_tilt",
    "posture_score": 66,
    "raw_images_stored": 0
  }
}
```

## Backend response

```json
{
  "answer": "...",
  "used_llm": true,
  "retrieved_documents": []
}
```

UI nên render `response.answer`. `retrievedDocuments` chỉ dùng cho debug/citations nếu cần.
