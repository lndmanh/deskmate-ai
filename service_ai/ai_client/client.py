"""Reusable AI client built on the Python AI SDK (ai-sdk-python).

This module is the single entry point for talking to OpenAI from ``service_ai``.
It centralises credential/model configuration, availability checks and error
handling so individual features (chatbot, RAG embeddings, ...) never construct a
provider client or duplicate request-handling logic themselves.

Both chat completions and embeddings go through one :class:`AIClient`.

Docs: https://pythonaisdk.mintlify.app/
"""

import os
from functools import lru_cache

from ai_sdk import embed, embed_many, generate_text, openai
from ai_sdk.types import CoreAssistantMessage, CoreSystemMessage, CoreUserMessage
from openai import OpenAIError

API_KEY_ENV = "OPENAI_API_KEY"
CHAT_MODEL_ENV = "DESKMATE_OPENAI_MODEL"
EMBEDDING_MODEL_ENV = "DESKMATE_EMBEDDING_MODEL"

DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_TEMPERATURE = 0.4

# A chat message is a simple ``{"role": ..., "content": ...}`` dict.
ChatMessage = dict[str, str]

_ROLE_TO_MESSAGE = {
    "system": CoreSystemMessage,
    "user": CoreUserMessage,
    "assistant": CoreAssistantMessage,
}


class AIClientError(RuntimeError):
    """Raised when an AI request fails or credentials are missing.

    Subclasses :class:`RuntimeError` so existing callers that catch
    ``RuntimeError`` keep working unchanged.
    """


class AIClient:
    """Reusable wrapper over the Python AI SDK for chat and embeddings.

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
    ) -> None:
        self.api_key = api_key or os.environ.get(API_KEY_ENV)
        self.chat_model = chat_model or os.environ.get(CHAT_MODEL_ENV, DEFAULT_CHAT_MODEL)
        self.embedding_model = embedding_model or os.environ.get(
            EMBEDDING_MODEL_ENV, DEFAULT_EMBEDDING_MODEL
        )
        self.temperature = temperature
        # SDK model objects are built lazily and reused across calls so the
        # underlying provider client (and its connection pool) is shared.
        self._chat_model_obj = None
        self._embedding_model_obj = None

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
        roles ``system`` | ``user`` | ``assistant``. AI SDK message objects are
        also accepted and passed through unchanged.
        """
        core_messages = [self._to_core_message(message) for message in messages]
        return self._generate(messages=core_messages, temperature=temperature)

    # -- Embeddings -----------------------------------------------------------

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts, preserving input order."""
        self._ensure_available()

        if not texts:
            return []

        try:
            result = embed_many(model=self._embedding_model(), values=list(texts))
        except OpenAIError as error:
            raise AIClientError(f"OpenAI embedding request failed: {error}") from error

        return result.embeddings

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string."""
        self._ensure_available()

        try:
            result = embed(model=self._embedding_model(), value=text)
        except OpenAIError as error:
            raise AIClientError(f"OpenAI embedding request failed: {error}") from error

        return result.embedding

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
            "model": self._chat_model(),
            "temperature": self.temperature if temperature is None else temperature,
        }
        if messages is not None:
            request["messages"] = messages
        else:
            request["prompt"] = prompt
            if system is not None:
                request["system"] = system

        try:
            result = generate_text(**request)
        except OpenAIError as error:
            raise AIClientError(f"OpenAI request failed: {error}") from error

        text = (result.text or "").strip()
        if not text:
            raise AIClientError("OpenAI response did not include any text content")
        return text

    def _to_core_message(self, message):
        if not isinstance(message, dict):
            return message  # already an AI SDK message object

        role = message.get("role")
        message_type = _ROLE_TO_MESSAGE.get(role)
        if message_type is None:
            raise AIClientError(f"Unsupported chat role: {role!r}")
        return message_type(content=message.get("content", ""))

    def _ensure_available(self) -> None:
        if not self.is_available():
            raise AIClientError(f"{API_KEY_ENV} is not set")

    def _chat_model(self):
        if self._chat_model_obj is None:
            self._chat_model_obj = openai(self.chat_model, api_key=self.api_key)
        return self._chat_model_obj

    def _embedding_model(self):
        if self._embedding_model_obj is None:
            self._embedding_model_obj = openai.embedding(
                self.embedding_model, api_key=self.api_key
            )
        return self._embedding_model_obj


@lru_cache(maxsize=1)
def get_ai_client() -> AIClient:
    """Return a shared :class:`AIClient` configured from the environment.

    Cached so the whole service reuses one client (and one provider connection
    pool). Pass explicit settings to :class:`AIClient` directly when a separate
    configuration is needed, e.g. in tests.
    """
    return AIClient()
