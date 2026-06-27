import json
import os
import urllib.error
import urllib.request


class OpenAiEmbeddingClient:
    def __init__(self, model: str = "text-embedding-3-small") -> None:
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.model = os.environ.get("DESKMATE_EMBEDDING_MODEL", model)

    def is_available(self) -> bool:
        return bool(self.api_key)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        if not texts:
            return []

        payload = {
            "model": self.model,
            "input": texts,
        }

        request = urllib.request.Request(
            "https://api.openai.com/v1/embeddings",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            message = error.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"OpenAI embedding request failed: {message}") from error

        sorted_items = sorted(data["data"], key=lambda item: item["index"])
        return [item["embedding"] for item in sorted_items]

    def embed_query(self, text: str) -> list[float]:
        embeddings = self.embed_texts([text])
        if not embeddings:
            raise RuntimeError("No embedding returned for query")
        return embeddings[0]
