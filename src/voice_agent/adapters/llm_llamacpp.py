from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import ValidationError

from voice_agent.prompts import TOOL_CALL_SYSTEM_PROMPT
from voice_agent.schemas import ToolCall


class LLMServerUnavailable(RuntimeError):
    pass


class LLMResponseError(ValueError):
    pass


class LlamaCppAdapter:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.Client(timeout=timeout_seconds)

    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        payload = {
            "model": self._model,
            "temperature": 0.0,
            "top_p": 0.9,
            "max_tokens": 256,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": TOOL_CALL_SYSTEM_PROMPT},
                {"role": "user", "content": self._format_user_message(user_text, tool_specs)},
            ],
        }

        try:
            response = self._client.post(f"{self._base_url}/v1/chat/completions", json=payload)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise LLMServerUnavailable(f"LLM server unavailable at {self._base_url}") from exc

        content = self._extract_content(response.json())
        return parse_tool_call_json(content)

    @staticmethod
    def _format_user_message(user_text: str, tool_specs: str) -> str:
        return f"工具列表 JSON：\n{tool_specs}\n\n用户输入：{user_text}"

    @staticmethod
    def _extract_content(data: dict[str, Any]) -> str:
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMResponseError("LLM response did not contain choices[0].message.content") from exc
        if not isinstance(content, str):
            raise LLMResponseError("LLM message content must be a string")
        return content


def parse_tool_call_json(content: str) -> ToolCall:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMResponseError("LLM response was not valid JSON") from exc

    if not isinstance(data, dict):
        raise LLMResponseError("LLM response JSON must be an object")

    try:
        return ToolCall.model_validate(data)
    except ValidationError as exc:
        raise LLMResponseError(f"LLM response failed ToolCall validation: {exc}") from exc
