from pathlib import Path

from ai_client import get_ai_client

from .local_markdown_store import LocalMarkdownRagStore
from .query_expander import expand_query, infer_topic, source_topic_bonus
from .types import RetrievedDocument
from .vector_store import JsonVectorStore


class HybridRagRetriever:
    def __init__(
        self,
        knowledge_base_dir: str | Path = "knowledge_base",
        index_path: str | Path = "rag_index/knowledge_base_vectors.json",
    ) -> None:
        self.bm25_store = LocalMarkdownRagStore(knowledge_base_dir)
        self.embedding_client = get_ai_client()
        self.vector_store = JsonVectorStore(index_path)
        self.last_mode = "bm25"

    def search(self, query: str, limit: int = 4) -> list[RetrievedDocument]:
        topic = infer_topic(query)

        if self.embedding_client.is_available() and self.vector_store.is_available():
            try:
                query_embedding = self.embedding_client.embed_query(query)
                vector_documents = self.vector_store.search(query_embedding, limit=limit)

                if vector_documents:
                    self.last_mode = "vector"
                    return self._apply_topic_boost(vector_documents, topic, limit)
            except RuntimeError:
                self.last_mode = "bm25_fallback"
                documents = self.bm25_store.search(expand_query(query), limit=limit * 2)
                return self._apply_topic_boost(documents, topic, limit)

        self.last_mode = "bm25"
        documents = self.bm25_store.search(expand_query(query), limit=limit * 2)
        return self._apply_topic_boost(documents, topic, limit)

    def _apply_topic_boost(
        self,
        documents: list[RetrievedDocument],
        topic: str,
        limit: int,
    ) -> list[RetrievedDocument]:
        boosted_documents = [
            RetrievedDocument(
                source=document.source,
                title=document.title,
                content=document.content,
                score=document.score + source_topic_bonus(topic, document.source),
            )
            for document in documents
        ]
        return sorted(boosted_documents, key=lambda document: document.score, reverse=True)[:limit]
