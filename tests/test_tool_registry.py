from pathlib import Path

import pytest

from voice_agent.tools.registry import ToolRegistry


FIXTURE = Path(__file__).parent / "fixtures" / "tools.yaml"


def test_loads_tool_registry():
    registry = ToolRegistry.from_yaml(FIXTURE)

    assert registry.has_tool("read_cpu_temp")
    assert registry.get("restart_service").risk == "high"


def test_rejects_unknown_tool():
    registry = ToolRegistry.from_yaml(FIXTURE)

    with pytest.raises(KeyError):
        registry.get("delete_everything")


def test_validates_enum_arguments():
    registry = ToolRegistry.from_yaml(FIXTURE)

    validated = registry.validate_args("restart_service", {"name": "camera"})

    assert validated == {"name": "camera"}


def test_rejects_disallowed_enum_argument():
    registry = ToolRegistry.from_yaml(FIXTURE)

    with pytest.raises(ValueError):
        registry.validate_args("restart_service", {"name": "ssh"})


def test_prompt_format_includes_registered_tool_names():
    registry = ToolRegistry.from_yaml(FIXTURE)

    tool_specs = registry.format_for_prompt()

    assert "read_cpu_temp" in tool_specs
    assert "restart_service" in tool_specs
