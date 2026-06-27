"""Reusable AI client built on the official OpenAI Python SDK.

This module is the single entry point for talking to OpenAI from ``service_ai``.
It centralises credential/model configuration, availability checks and error
handling so individual features (chatbot, RAG embeddings, ...) never construct a
provider client or duplicate request-handling logic themselves.

Both chat completions and embeddings go through one :class:`AIClient`.

Docs: https://github.com/openai/openai-python
"""

import os
from functools import lru_cache

from openai import OpenAI, OpenAIError

API_KEY_ENV = "OPENAI_API_KEY"
CHAT_MODEL_ENV = "DESKMATE_OPENAI_MODEL"
EMBEDDING_MODEL_ENV = "DESKMATE_EMBEDDING_MODEL"

DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_TEMPERATURE = 0.4

# A chat message is a simple ``{"role": ..., "content": ...}`` dict.
ChatMessage = dict[str, str]

_SUPPORTED_ROLES = {"system", "user", "assistant"}


class AIClientError(RuntimeError):
    """Raised when an AI request fails or credentials are missing.

    Subclasses :class:`RuntimeError` so existing callers that catch
    ``RuntimeError`` keep working unchanged.
    """


class AIClient:
    """Reusable wrapper over the OpenAI Python SDK for chat and embeddings.

    Configuration falls back to environment variables (``OPENAI_API_KEY``,
    ``DESKMATE_OPENAI_MODEL``, ``DESKMATE_EMBEDDING_MODEL``) but every value can
    be overridden via the constructor, which keeps the client easy to test.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        chat_model: str | None = None,
        embedding_model: str | None = None,
        temperature: float = DEFAULT_TEMPERATURE,
        openai_client=None,
    ) -> None:
        self.api_key = api_key or os.environ.get(API_KEY_ENV)
        self.chat_model = chat_model or os.environ.get(CHAT_MODEL_ENV, DEFAULT_CHAT_MODEL)
        self.embedding_model = embedding_model or os.environ.get(
            EMBEDDING_MODEL_ENV, DEFAULT_EMBEDDING_MODEL
        )
        self.temperature = temperature
        self._openai_client = openai_client

    def is_available(self) -> bool:
        """Return ``True`` when an API key is configured."""
        return bool(self.api_key)

    # -- Chat -----------------------------------------------------------------

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        temperature: float | None = None,
    ) -> str:
        """Generate a single response from a system + user prompt."""
        return self._generate(
            system=system_prompt,
            prompt=user_prompt,
            temperature=temperature,
        )

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float | None = None,
    ) -> str:
        """Generate a response from a multi-turn message list.

        ``messages`` is a list of ``{"role": ..., "content": ...}`` dicts with
        roles ``system`` | ``user`` | ``assistant``.
        """
        openai_messages = [self._to_openai_message(message) for message in messages]
        return self._generate(messages=openai_messages, temperature=temperature)

    # -- Embeddings -----------------------------------------------------------

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts, preserving input order."""
        self._ensure_available()

        if not texts:
            return []

        try:
            result = self._client().embeddings.create(
                model=self.embedding_model,
                input=list(texts),
            )
        except OpenAIError as error:
            raise AIClientError(f"OpenAI embedding request failed: {error}") from error

        return [item.embedding for item in result.data]

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string."""
        self._ensure_available()

        try:
            result = self._client().embeddings.create(
                model=self.embedding_model,
                input=text,
            )
        except OpenAIError as error:
            raise AIClientError(f"OpenAI embedding request failed: {error}") from error

        return result.data[0].embedding

    # -- Internals ------------------------------------------------------------

    def _generate(
        self,
        *,
        system: str | None = None,
        prompt: str | None = None,
        messages: list | None = None,
        temperature: float | None = None,
    ) -> str:
        self._ensure_available()

        request: dict = {
            "model": self.chat_model,
            "temperature": self.temperature if temperature is None else temperature,
        }
        if messages is not None:
            request["messages"] = messages
        else:
            request["messages"] = [{"role": "user", "content": prompt or ""}]
            if system is not None:
                request["messages"].insert(0, {"role": "system", "content": system})

        try:
            result = self._client().chat.completions.create(**request)
        except OpenAIError as error:
            raise AIClientError(f"OpenAI request failed: {error}") from error

        text = (result.choices[0].message.content or "").strip()
        if not text:
            raise AIClientError("OpenAI response did not include any text content")
        return text

    def _to_openai_message(self, message: ChatMessage) -> ChatMessage:
        role = message.get("role")
        if role not in _SUPPORTED_ROLES:
            raise AIClientError(f"Unsupported chat role: {role!r}")
        return {"role": role, "content": message.get("content", "")}

    def _ensure_available(self) -> None:
        if not self.is_available():
            raise AIClientError(f"{API_KEY_ENV} is not set")

    def _client(self):
        if self._openai_client is None:
            self._openai_client = OpenAI(api_key=self.api_key)
        return self._openai_client


@lru_cache(maxsize=1)
def get_ai_client() -> AIClient:
    """Return a shared :class:`AIClient` configured from the environment.

    Cached so the whole service reuses one client (and one provider connection
    pool). Pass explicit settings to :class:`AIClient` directly when a separate
    configuration is needed, e.g. in tests.
    """
    return AIClient()
