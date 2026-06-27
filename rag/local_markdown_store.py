import math
import re
from collections import Counter
from pathlib import Path

from .types import RetrievedDocument


STOPWORDS = {
    "và",
    "là",
    "có",
    "không",
    "của",
    "cho",
    "tôi",
    "bạn",
    "mình",
    "này",
    "kia",
    "thì",
    "mà",
    "với",
    "trong",
    "hỏi",
    "gì",
    "sao",
    "thế",
    "nào",
    "như",
    "về",
    "được",
    "đang",
    "the",
    "and",
    "or",
    "to",
    "of",
    "a",
    "an",
    "is",
}


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[\wÀ-ỹ]+", text.lower(), flags=re.UNICODE)
    return [word for word in words if len(word) >= 2 and word not in STOPWORDS]


class LocalMarkdownRagStore:
    def __init__(self, knowledge_base_dir: str | Path) -> None:
        self.knowledge_base_dir = Path(knowledge_base_dir)
        self.documents = self._load_documents()
        self.document_tokens = [tokenize(document.content) for document in self.documents]
        self.document_frequencies = self._build_document_frequencies(self.document_tokens)
        self.average_document_length = self._calculate_average_document_length(self.document_tokens)
        self.k1 = 1.5
        self.b = 0.75

    def search(self, query: str, limit: int = 4) -> list[RetrievedDocument]:
        query_terms = tokenize(query)

        if not query_terms:
            return []

        scored_documents: list[RetrievedDocument] = []

        for index, document in enumerate(self.documents):
            document_terms = self.document_tokens[index]
            score = self._score_bm25(query_terms, document_terms, document.title, document.content)

            if score > 0:
                scored_documents.append(
                    RetrievedDocument(
                        source=document.source,
                        title=document.title,
                        content=document.content,
                        score=score,
                    )
                )

        return sorted(scored_documents, key=lambda document: document.score, reverse=True)[:limit]

    def _load_documents(self) -> list[RetrievedDocument]:
        if not self.knowledge_base_dir.exists():
            return []

        documents: list[RetrievedDocument] = []

        for path in sorted(self.knowledge_base_dir.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            title = self._extract_title(text, path.stem)
            chunks = self._chunk_markdown(text)

            for index, chunk in enumerate(chunks):
                documents.append(
                    RetrievedDocument(
                        source=f"{path.name}#{index + 1}",
                        title=title,
                        content=chunk,
                        score=0,
                    )
                )

        return documents

    def _extract_title(self, text: str, fallback: str) -> str:
        for line in text.splitlines():
            if line.startswith("# "):
                return line.replace("# ", "", 1).strip()
        return fallback.replace("_", " ").title()

    def _chunk_markdown(self, text: str, max_chars: int = 1_200) -> list[str]:
        sections = re.split(r"\n(?=## )", text.strip())
        chunks: list[str] = []

        for section in sections:
            cleaned = section.strip()
            if not cleaned:
                continue

            if len(cleaned) <= max_chars:
                chunks.append(cleaned)
                continue

            paragraphs = cleaned.split("\n\n")
            current = ""

            for paragraph in paragraphs:
                if len(current) + len(paragraph) + 2 > max_chars and current:
                    chunks.append(current.strip())
                    current = paragraph
                else:
                    current = f"{current}\n\n{paragraph}" if current else paragraph

            if current:
                chunks.append(current.strip())

        return chunks

    def _build_document_frequencies(self, tokenized_documents: list[list[str]]) -> dict[str, int]:
        frequencies: dict[str, int] = {}

        for document_terms in tokenized_documents:
            for term in set(document_terms):
                frequencies[term] = frequencies.get(term, 0) + 1

        return frequencies

    def _calculate_average_document_length(self, tokenized_documents: list[list[str]]) -> float:
        if not tokenized_documents:
            return 0

        total_length = sum(len(document_terms) for document_terms in tokenized_documents)
        return total_length / len(tokenized_documents)

    def _score_bm25(
        self,
        query_terms: list[str],
        document_terms: list[str],
        title: str,
        content: str,
    ) -> float:
        if not document_terms or self.average_document_length == 0:
            return 0

        term_counts = Counter(document_terms)
        document_count = len(self.documents)
        document_length = len(document_terms)
        unique_query_terms = list(dict.fromkeys(query_terms))
        score = 0.0

        for term in unique_query_terms:
            term_frequency = term_counts.get(term, 0)

            if term_frequency == 0:
                continue

            document_frequency = self.document_frequencies.get(term, 0)
            idf = math.log(1 + (document_count - document_frequency + 0.5) / (document_frequency + 0.5))
            denominator = term_frequency + self.k1 * (
                1 - self.b + self.b * document_length / self.average_document_length
            )
            score += idf * (term_frequency * (self.k1 + 1)) / denominator

        return score + self._field_bonus(unique_query_terms, title, content)

    def _field_bonus(self, query_terms: list[str], title: str, content: str) -> float:
        lower_title = title.lower()
        lower_content = content.lower()
        bonus = 0.0

        for term in query_terms:
            if term in lower_title:
                bonus += 1.2

            if term in lower_content:
                bonus += 0.15

        return bonus
