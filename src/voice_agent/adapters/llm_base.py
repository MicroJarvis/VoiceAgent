from typing import Protocol

from voice_agent.schemas import ToolCall


class LLMAdapter(Protocol):
    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        ...
