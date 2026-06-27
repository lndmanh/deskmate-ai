import os

from openai import OpenAI, OpenAIError


class OpenAiChatClient:
    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.model = os.environ.get("DESKMATE_OPENAI_MODEL", model)
        self.client = OpenAI(api_key=self.api_key, timeout=45.0) if self.api_key else None

    def is_available(self) -> bool:
        return bool(self.api_key)

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        if self.client is None:
            raise RuntimeError("OPENAI_API_KEY is not set")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
            )
        except OpenAIError as error:
            raise RuntimeError(f"OpenAI request failed: {error}") from error

        content = response.choices[0].message.content

        if not content:
            raise RuntimeError("OpenAI response did not include message content")

        return content.strip()
