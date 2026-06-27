import json
import os
import urllib.error
import urllib.request


class OpenAiChatClient:
    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.model = os.environ.get("DESKMATE_OPENAI_MODEL", model)

    def is_available(self) -> bool:
        return bool(self.api_key)

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.4,
        }

        request = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            message = error.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"OpenAI request failed: {message}") from error

        return data["choices"][0]["message"]["content"].strip()
