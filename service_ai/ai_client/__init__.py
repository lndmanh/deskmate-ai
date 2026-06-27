"""Reusable AI client for service_ai, built on the OpenAI Python SDK.

See https://github.com/openai/openai-python
"""

from .client import AIClient, AIClientError, ChatMessage, get_ai_client

__all__ = [
    "AIClient",
    "AIClientError",
    "ChatMessage",
    "get_ai_client",
]
