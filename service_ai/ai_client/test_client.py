from types import SimpleNamespace
from unittest import TestCase

from .client import AIClient


class _FakeChatCompletions:
    def __init__(self) -> None:
        self.requests = []

    def create(self, **request):
        self.requests.append(request)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=" hello "))]
        )


class _FakeEmbeddings:
    def __init__(self) -> None:
        self.requests = []

    def create(self, **request):
        self.requests.append(request)
        return SimpleNamespace(
            data=[
                SimpleNamespace(embedding=[1.0, 2.0]),
                SimpleNamespace(embedding=[3.0, 4.0]),
            ]
        )


class _FakeOpenAI:
    def __init__(self) -> None:
        self.chat = SimpleNamespace(completions=_FakeChatCompletions())
        self.embeddings = _FakeEmbeddings()


class AIClientTests(TestCase):
    def test_complete_uses_openai_chat_completions(self) -> None:
        openai_client = _FakeOpenAI()
        client = AIClient(
            api_key="test-key",
            chat_model="test-chat-model",
            temperature=0.2,
            openai_client=openai_client,
        )

        text = client.complete("system prompt", "user prompt")

        self.assertEqual(text, "hello")
        self.assertEqual(
            openai_client.chat.completions.requests,
            [
                {
                    "model": "test-chat-model",
                    "messages": [
                        {"role": "system", "content": "system prompt"},
                        {"role": "user", "content": "user prompt"},
                    ],
                    "temperature": 0.2,
                }
            ],
        )

    def test_embed_texts_uses_openai_embeddings(self) -> None:
        openai_client = _FakeOpenAI()
        client = AIClient(
            api_key="test-key",
            embedding_model="test-embedding-model",
            openai_client=openai_client,
        )

        embeddings = client.embed_texts(["one", "two"])

        self.assertEqual(embeddings, [[1.0, 2.0], [3.0, 4.0]])
        self.assertEqual(
            openai_client.embeddings.requests,
            [{"model": "test-embedding-model", "input": ["one", "two"]}],
        )
