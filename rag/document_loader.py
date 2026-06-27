import re
from pathlib import Path

from .types import RetrievedDocument


def load_markdown_documents(knowledge_base_dir: str | Path) -> list[RetrievedDocument]:
    base_dir = Path(knowledge_base_dir)

    if not base_dir.exists():
        return []

    documents: list[RetrievedDocument] = []

    for path in sorted(base_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        title = extract_title(text, path.stem)
        chunks = chunk_markdown(text)

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


def extract_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line.replace("# ", "", 1).strip()
    return fallback.replace("_", " ").title()


def chunk_markdown(text: str, max_chars: int = 1_200) -> list[str]:
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
