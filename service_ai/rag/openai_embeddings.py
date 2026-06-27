import os

from openai import OpenAI, OpenAIError


class OpenAiEmbeddingClient:
    def __init__(self, model: str = "text-embedding-3-small") -> None:
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.model = os.environ.get("DESKMATE_EMBEDDING_MODEL", model)
        self.client = OpenAI(api_key=self.api_key, timeout=60.0) if self.api_key else None

    def is_available(self) -> bool:
        return bool(self.api_key)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if self.client is None:
            raise RuntimeError("OPENAI_API_KEY is not set")

        if not texts:
            return []

        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=texts,
            )
        except OpenAIError as error:
            raise RuntimeError(f"OpenAI embedding request failed: {error}") from error

        sorted_items = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in sorted_items]

    def embed_query(self, text: str) -> list[float]:
        embeddings = self.embed_texts([text])
        if not embeddings:
            raise RuntimeError("No embedding returned for query")
        return embeddings[0]
