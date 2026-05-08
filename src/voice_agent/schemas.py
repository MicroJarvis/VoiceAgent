from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ToolCall(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: str = Field(min_length=1, max_length=80)
    args: dict[str, Any] = Field(default_factory=dict)
    requires_confirmation: bool = False
    speech: str | None = Field(default=None, max_length=300)


class ToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    executed: bool = False
    elapsed_ms: float | None = Field(default=None, ge=0)

    @field_validator("stdout", "stderr")
    @classmethod
    def truncate_output(cls, value: str) -> str:
        return value[-2000:]
