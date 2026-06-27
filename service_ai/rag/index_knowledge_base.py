from .document_loader import load_markdown_documents
from .openai_embeddings import OpenAiEmbeddingClient
from .vector_store import JsonVectorStore, VectorRecord


def main() -> None:
    documents = load_markdown_documents("knowledge_base")
    embedding_client = OpenAiEmbeddingClient()

    if not embedding_client.is_available():
        raise SystemExit("OPENAI_API_KEY chưa được set. Không thể tạo vector index.")

    if not documents:
        raise SystemExit("Không tìm thấy tài liệu trong knowledge_base.")

    print(f"Indexing {len(documents)} knowledge chunks with {embedding_client.model}...")

    texts = [f"{document.title}\n\n{document.content}" for document in documents]
    embeddings = embedding_client.embed_texts(texts)
    records = [
        VectorRecord(
            source=document.source,
            title=document.title,
            content=document.content,
            embedding=embedding,
        )
        for document, embedding in zip(documents, embeddings)
    ]

    vector_store = JsonVectorStore()
    vector_store.save(records)
    print(f"Saved {len(records)} vectors to {vector_store.index_path}")


if __name__ == "__main__":
    main()
