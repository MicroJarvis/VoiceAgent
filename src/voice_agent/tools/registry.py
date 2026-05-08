from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


Risk = Literal["low", "medium", "high"]
ExecutionKind = Literal["command", "noop"]


class ArgSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["enum"]
    values: list[str] = Field(min_length=1)


class ToolSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str
    risk: Risk
    command: list[str] = Field(default_factory=list)
    timeout_seconds: int = Field(default=10, ge=1, le=120)
    args_schema: dict[str, ArgSpec] = Field(default_factory=dict)
    execution: ExecutionKind = "command"

    @model_validator(mode="after")
    def command_tools_have_command(self) -> "ToolSpec":
        if self.execution == "command" and not self.command:
            raise ValueError("command execution tools must define at least one command part")
        if self.execution == "noop" and self.command:
            raise ValueError("noop tools must not define command parts")
        return self


class ToolRegistry:
    def __init__(self, tools: dict[str, ToolSpec]) -> None:
        self._tools = tools

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ToolRegistry":
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
        raw_tools = data.get("tools", {})
        if not isinstance(raw_tools, dict):
            raise ValueError("tools.yaml must contain a mapping under 'tools'")
        return cls({name: ToolSpec(**spec) for name, spec in raw_tools.items()})

    def has_tool(self, name: str) -> bool:
        return name in self._tools

    def get(self, name: str) -> ToolSpec:
        try:
            return self._tools[name]
        except KeyError as exc:
            raise KeyError(f"Unknown tool: {name}") from exc

    def tool_names(self) -> list[str]:
        return sorted(self._tools)

    def validate_args(self, tool_name: str, args: dict[str, object]) -> dict[str, str]:
        spec = self.get(tool_name)
        allowed_names = set(spec.args_schema)
        unknown_names = set(args) - allowed_names
        if unknown_names:
            raise ValueError(f"Unknown arguments for {tool_name}: {sorted(unknown_names)}")

        validated: dict[str, str] = {}
        for arg_name, arg_spec in spec.args_schema.items():
            if arg_name not in args:
                raise ValueError(f"Missing argument for {tool_name}: {arg_name}")
            value = args[arg_name]
            if not isinstance(value, str):
                raise ValueError(f"Argument {arg_name} must be a string")
            if value not in arg_spec.values:
                raise ValueError(f"Argument {arg_name} has disallowed value: {value}")
            validated[arg_name] = value
        return validated

    def format_for_prompt(self) -> str:
        prompt_tools = {}
        for name, spec in sorted(self._tools.items()):
            prompt_tools[name] = {
                "description": spec.description,
                "risk": spec.risk,
                "execution": spec.execution,
                "args_schema": {
                    arg_name: {"type": arg_spec.type, "values": arg_spec.values}
                    for arg_name, arg_spec in spec.args_schema.items()
                },
            }
        return json.dumps(prompt_tools, ensure_ascii=False, sort_keys=True)
