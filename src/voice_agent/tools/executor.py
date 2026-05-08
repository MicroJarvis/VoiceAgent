from __future__ import annotations

import subprocess
import time

from voice_agent.schemas import ToolResult
from voice_agent.tools.registry import ToolRegistry


class ToolExecutor:
    def __init__(self, registry: ToolRegistry) -> None:
        self._registry = registry

    def execute(
        self,
        tool_name: str,
        args: dict[str, object],
        *,
        confirmed: bool = False,
    ) -> ToolResult:
        started = time.perf_counter()

        if not self._registry.has_tool(tool_name):
            return self._result(started, ok=False, stderr=f"Unknown tool: {tool_name}")

        spec = self._registry.get(tool_name)
        if spec.risk == "high" and not confirmed:
            return self._result(
                started,
                ok=False,
                stderr=f"Tool {tool_name} requires confirmation",
            )

        try:
            validated_args = self._registry.validate_args(tool_name, args)
        except Exception as exc:
            return self._result(started, ok=False, stderr=str(exc))

        if spec.execution == "noop":
            return self._result(
                started,
                ok=True,
                stdout=spec.description,
                executed=False,
                exit_code=0,
            )

        command = [part.format(**validated_args) for part in spec.command]
        try:
            completed = subprocess.run(
                command,
                shell=False,
                capture_output=True,
                text=True,
                timeout=spec.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return self._result(
                started,
                ok=False,
                stderr=f"Tool {tool_name} timed out",
                executed=True,
            )
        except Exception as exc:
            return self._result(started, ok=False, stderr=str(exc))

        return self._result(
            started,
            ok=completed.returncode == 0,
            stdout=completed.stdout,
            stderr=completed.stderr,
            exit_code=completed.returncode,
            executed=True,
        )

    @staticmethod
    def _result(started: float, **kwargs: object) -> ToolResult:
        return ToolResult(elapsed_ms=(time.perf_counter() - started) * 1000, **kwargs)
