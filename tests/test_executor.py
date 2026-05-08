from pathlib import Path

from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


FIXTURE = Path(__file__).parent / "fixtures" / "tools.yaml"


def test_executor_blocks_high_risk_without_confirmation():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("restart_service", {"name": "camera"}, confirmed=False)

    assert result.ok is False
    assert result.executed is False
    assert "confirmation" in result.stderr


def test_executor_rejects_unknown_tool():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("missing", {}, confirmed=True)

    assert result.ok is False
    assert result.executed is False
    assert "Unknown tool" in result.stderr


def test_executor_runs_low_risk_tool_and_records_latency():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("read_cpu_temp", {}, confirmed=False)

    assert result.ok is True
    assert result.executed is True
    assert "temp=" in result.stdout
    assert result.elapsed_ms is not None


def test_executor_rejects_disallowed_args_before_subprocess():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("restart_service", {"name": "ssh"}, confirmed=True)

    assert result.ok is False
    assert result.executed is False
    assert "disallowed value" in result.stderr


def test_noop_tool_does_not_execute_subprocess():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("explain_no_action", {}, confirmed=False)

    assert result.ok is True
    assert result.executed is False
