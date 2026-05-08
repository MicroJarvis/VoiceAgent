from dataclasses import dataclass

from voice_agent.adapters.llm_base import LLMAdapter
from voice_agent.schemas import ToolCall, ToolResult
from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


@dataclass(frozen=True)
class AgentTurnResult:
    user_text: str
    tool_call: ToolCall
    tool_result: ToolResult
    response_text: str


class AgentOrchestrator:
    def __init__(
        self,
        *,
        llm: LLMAdapter,
        registry: ToolRegistry,
        executor: ToolExecutor,
    ) -> None:
        self._llm = llm
        self._registry = registry
        self._executor = executor

    def handle_text(self, user_text: str, *, confirmed: bool = False) -> AgentTurnResult:
        tool_call = self._llm.complete_tool_call(user_text, self._registry.format_for_prompt())
        tool_result = self._executor.execute(
            tool_call.tool,
            tool_call.args,
            confirmed=confirmed,
        )
        response_text = self._format_response(tool_call, tool_result)
        return AgentTurnResult(
            user_text=user_text,
            tool_call=tool_call,
            tool_result=tool_result,
            response_text=response_text,
        )

    def _format_response(self, tool_call: ToolCall, tool_result: ToolResult) -> str:
        if tool_result.ok:
            return tool_call.speech or "已完成。"
        return f"执行失败：{tool_result.stderr}"
