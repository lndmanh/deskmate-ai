"""Reusable AI client for service_ai, built on the Python AI SDK.

See https://pythonaisdk.mintlify.app/
"""

from .client import AIClient, AIClientError, ChatMessage, get_ai_client

__all__ = [
    "AIClient",
    "AIClientError",
    "ChatMessage",
    "get_ai_client",
]
