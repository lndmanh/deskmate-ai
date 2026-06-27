import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

from .types import RetrievedDocument


@dataclass(frozen=True)
class VectorRecord:
    source: str
    title: str
    content: str
    embedding: list[float]


class JsonVectorStore:
    def __init__(self, index_path: str | Path = "rag_index/knowledge_base_vectors.json") -> None:
        self.index_path = Path(index_path)
        self.records = self._load_records()

    def is_available(self) -> bool:
        return self.index_path.exists() and len(self.records) > 0

    def save(self, records: list[VectorRecord]) -> None:
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "records": [asdict(record) for record in records],
        }
        self.index_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.records = records

    def search(self, query_embedding: list[float], limit: int = 4) -> list[RetrievedDocument]:
        scored_documents: list[RetrievedDocument] = []

        for record in self.records:
            score = cosine_similarity(query_embedding, record.embedding)
            scored_documents.append(
                RetrievedDocument(
                    source=record.source,
                    title=record.title,
                    content=record.content,
                    score=score,
                )
            )

        return sorted(scored_documents, key=lambda document: document.score, reverse=True)[:limit]

    def _load_records(self) -> list[VectorRecord]:
        if not self.index_path.exists():
            return []

        data = json.loads(self.index_path.read_text(encoding="utf-8"))
        records_data = data.get("records", [])

        records: list[VectorRecord] = []
        for item in records_data:
            records.append(
                VectorRecord(
                    source=item["source"],
                    title=item["title"],
                    content=item["content"],
                    embedding=item["embedding"],
                )
            )

        return records


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0

    dot_product = sum(left * right for left, right in zip(a, b))
    norm_a = math.sqrt(sum(value * value for value in a))
    norm_b = math.sqrt(sum(value * value for value in b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot_product / (norm_a * norm_b)
