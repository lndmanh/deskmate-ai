# DeskMate Chatbot + RAG

Đây là chatbot MVP cho DeskMate AI.

Code được tách thành 2 folder chính:

```txt
chatbot/  # logic coach, prompt, LLM client
rag/      # hybrid retrieval từ knowledge_base: vector nếu có, BM25 fallback
```

## Chức năng

- Chat bằng tiếng Việt.
- Có RAG từ folder `rag/`, đọc dữ liệu trong `knowledge_base/`.
- Hỗ trợ OpenAI embeddings + local JSON vector store + BM25 fallback.
- Dùng OpenAI nếu có `OPENAI_API_KEY`.
- Nếu chưa có API key, tự fallback local bằng rule đơn giản.
- Có guardrail: không chẩn đoán bệnh, không xem ảnh webcam, không phân tích cảm xúc.

## Chạy thử

```bash
python chatbot_cli.py
```

Nếu PowerShell bị lỗi font/encoding khi in tiếng Việt, chạy trước:

```powershell
$env:PYTHONIOENCODING="utf-8"
chcp 65001
python chatbot_cli.py
```

Thử hỏi:

```txt
Hôm nay tư thế tôi thế nào?
Bạn có lưu ảnh webcam không?
Cho tôi bài reset cổ vai 90 giây
Forward head là gì?
Khoảng cách màn hình đo thế nào?
```

## Dùng OpenAI

Set API key:

```powershell
$env:OPENAI_API_KEY="sk-..."
python chatbot_cli.py
```

Nếu không set key, chatbot vẫn chạy bằng fallback local.

## Tạo vector index cho RAG Level 3

```powershell
$env:OPENAI_API_KEY="sk-..."
python -m rag.index_knowledge_base
```

Sau đó chatbot sẽ ưu tiên semantic vector search. Nếu chưa index hoặc thiếu key, chatbot tự dùng BM25 fallback.

## Import vào app chính

```python
from chatbot import DeskMateCoach, DeskMateContext

coach = DeskMateCoach()

context = DeskMateContext(
    active_time="7h 12m",
    longest_session="96m",
    current_session_minutes=76,
    posture_status="head_tilt",
    posture_score=66,
    posture_confidence=1.0,
    cloud_mode=False,
    raw_images_stored=0,
    latest_mood="tired",
    latest_mood_note="ngủ ít",
    average_energy=2.0,
    average_stress=4.0,
)

response = coach.ask("Tôi nên làm gì bây giờ?", context)
print(response.answer)
```

## Nâng cấp sau MVP

- Thay keyword RAG bằng embeddings.
- Lưu conversation memory.
- Kết nối event store thật.
- Thêm user tone examples riêng.
- Thêm feedback accepted/rejected để cải thiện câu trả lời.
