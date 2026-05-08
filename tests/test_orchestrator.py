from pathlib import Path

from voice_agent.orchestrator import AgentOrchestrator
from voice_agent.schemas import ToolCall
from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


class StubLLM:
    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        return ToolCall(tool="read_cpu_temp", args={}, requires_confirmation=False)


class HighRiskStubLLM:
    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        return ToolCall(
            tool="restart_service",
            args={"name": "camera"},
            requires_confirmation=True,
        )


def test_orchestrator_executes_model_selected_tool():
    registry = ToolRegistry.from_yaml(Path(__file__).parent / "fixtures" / "tools.yaml")
    executor = ToolExecutor(registry)
    orchestrator = AgentOrchestrator(llm=StubLLM(), registry=registry, executor=executor)

    result = orchestrator.handle_text("查看 CPU 温度")

    assert result.tool_call.tool == "read_cpu_temp"
    assert result.tool_result.ok is True


def test_orchestrator_does_not_treat_model_confirmation_flag_as_user_confirmation():
    registry = ToolRegistry.from_yaml(Path(__file__).parent / "fixtures" / "tools.yaml")
    executor = ToolExecutor(registry)
    orchestrator = AgentOrchestrator(llm=HighRiskStubLLM(), registry=registry, executor=executor)

    result = orchestrator.handle_text("重启摄像头")

    assert result.tool_call.requires_confirmation is True
    assert result.tool_result.ok is False
    assert result.tool_result.executed is False
    assert "confirmation" in result.tool_result.stderr
