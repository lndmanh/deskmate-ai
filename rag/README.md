# RAG Module

Folder này chứa phần Retrieval-Augmented Generation cho DeskMate AI.

RAG hiện tại là **Hybrid Level 3**:

```txt
OpenAI embeddings + local JSON vector store + BM25 fallback
```

Nếu đã có vector index và `OPENAI_API_KEY`, RAG dùng semantic vector search. Nếu chưa có API key hoặc chưa index, RAG tự fallback về BM25 local search.

Nguồn tài liệu là các file markdown trong:

```txt
knowledge_base/
```

Không cần ChromaDB/FAISS. Vector index được lưu bằng JSON local.

## Cách tạo vector index

Set OpenAI key:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

Index knowledge base:

```bash
python -m rag.index_knowledge_base
```

Kết quả sẽ được lưu vào:

```txt
rag_index/knowledge_base_vectors.json
```

Nếu không chạy lệnh này, RAG vẫn dùng BM25 fallback.

## Public API mới

```python
from rag import HybridRagRetriever

retriever = HybridRagRetriever("knowledge_base")
documents = retriever.search("Nó có soi mặt tôi không?")
print(retriever.last_mode)  # vector, bm25, hoặc bm25_fallback
```

## BM25 fallback

Pipeline:

```txt
knowledge_base/*.md
  -> load markdown
  -> chunk theo heading/độ dài
  -> tokenize tiếng Việt/Anh cơ bản
  -> BM25 ranking
  -> top-k chunks đưa cho chatbot
```

BM25 tốt hơn keyword count đơn giản vì có:

- Term frequency: từ xuất hiện nhiều trong chunk có trọng số hơn.
- Inverse document frequency: từ hiếm quan trọng hơn từ phổ biến.
- Length normalization: chunk dài không tự động thắng chỉ vì chứa nhiều từ.
- Title/content bonus: match trong tiêu đề được cộng điểm.

## Public API

```python
from rag import LocalMarkdownRagStore

store = LocalMarkdownRagStore("knowledge_base")
documents = store.search("Bạn có lưu ảnh webcam không?")
```

## File chính

- `types.py`: `RetrievedDocument`.
- `local_markdown_store.py`: load/chunk/BM25 search markdown.
- `document_loader.py`: load/chunk markdown dùng chung.
- `openai_embeddings.py`: gọi OpenAI embeddings.
- `vector_store.py`: lưu/load/search vector JSON.
- `hybrid_retriever.py`: vector-first, BM25 fallback.
- `index_knowledge_base.py`: CLI tạo vector index.

## Nâng cấp sau

- Thêm embeddings.
- Thêm ChromaDB/FAISS.
- Thêm reranking.
- Thêm metadata theo topic: privacy, posture, nudge, event schema.
