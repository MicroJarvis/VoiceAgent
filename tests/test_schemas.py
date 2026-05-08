import pytest
from pydantic import ValidationError

from voice_agent.schemas import ToolCall, ToolResult


def test_tool_call_accepts_known_shape():
    call = ToolCall(tool="read_cpu_temp", args={}, requires_confirmation=False)

    assert call.tool == "read_cpu_temp"
    assert call.args == {}
    assert call.requires_confirmation is False


def test_tool_call_rejects_empty_tool_name():
    with pytest.raises(ValidationError):
        ToolCall(tool="", args={})


def test_tool_result_truncates_long_output():
    result = ToolResult(ok=True, stdout="x" * 3000, stderr="")

    assert len(result.stdout) == 2000


def test_tool_result_tracks_execution_metrics():
    result = ToolResult(ok=True, executed=True, elapsed_ms=1.25)

    assert result.executed is True
    assert result.elapsed_ms == 1.25
