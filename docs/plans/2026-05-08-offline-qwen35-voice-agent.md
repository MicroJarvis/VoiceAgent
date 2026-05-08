# Offline Qwen3.5 Voice Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully offline Raspberry Pi-capable voice/text agent that uses Qwen3.5-2B GGUF Q4 to select and execute local whitelisted commands accurately.

**Architecture:** Start on the Mac with a text-only command execution loop, then add a local LLM adapter, structured tool-call validation, local ASR/TTS adapters, and Raspberry Pi deployment hardening. The model never executes shell directly; it emits validated structured intents that a local whitelist executor maps to fixed commands.

**Tech Stack:** Python 3.11-3.14, Pydantic, pytest, llama.cpp or Ollama for local GGUF inference, Qwen3.5-2B GGUF Q4_K_M as the first model candidate, sherpa-onnx or Rhasspy/Wyoming for offline speech, systemd for Raspberry Pi deployment.

---

## Key Decisions

1. **Primary model candidate:** `Qwen3.5-2B GGUF Q4_K_M`.
   - Preferred source: a GGUF Q4_K_M repository for `Qwen3.5-2B`.
   - Current note: Qwen officially publishes `Qwen/Qwen3.5-2B`, but GGUF Q4 may be provided by community quantization repositories. If a trusted GGUF is unavailable or unstable, convert the official model to GGUF locally with llama.cpp and quantize to Q4_K_M.

2. **Primary inference path:** llama.cpp server first, Ollama second.
   - llama.cpp gives direct GGUF control, grammar/schema constraints, and predictable deployment on Raspberry Pi.
   - Ollama is simpler on Mac, but Raspberry Pi support and model packaging should be verified early.

3. **Agent framework:** keep the runtime small.
   - Use Pydantic models and a thin orchestrator for MVP.
   - Evaluate PydanticAI after the text pipeline works, especially if model retry and tool validation plumbing becomes repetitive.
   - Do not start with LangChain/LangGraph; they add weight before we need graph workflows.

4. **Command execution:** whitelist only.
   - The model outputs a `ToolCall` JSON object.
   - The executor maps tool names and validated arguments to fixed command arrays.
   - Use `subprocess.run(..., shell=False, timeout=...)`.
   - High-risk actions require an explicit confirmation turn.

5. **Voice strategy:** text first, voice second.
   - Text mode validates model/tool accuracy without audio noise.
   - Voice mode is an adapter layer: ASR text enters the same orchestrator; TTS reads the same final response.

---

## Target Runtime Architecture

```text
Text input or microphone
    |
    v
ASR adapter, optional in text mode
    |
    v
Agent orchestrator
    |
    v
LLM adapter: llama.cpp/OpenAI-compatible local endpoint
    |
    v
ToolCall parser + Pydantic validator
    |
    v
Tool executor: whitelist, enum args, timeout, logging
    |
    v
Tool result
    |
    v
Response formatter
    |
    v
TTS adapter, optional in text mode
```

---

## Repository Layout

Create this structure:

```text
VoiceAgent/
  pyproject.toml
  README.md
  configs/
    mac.yaml
    raspberrypi.yaml
    tools.yaml
  docs/
    plans/
      2026-05-08-offline-qwen35-voice-agent.md
    model-evaluation.md
  scripts/
    run_text_agent.py
    run_voice_agent.py
    benchmark_model.py
  src/
    voice_agent/
      __init__.py
      orchestrator.py
      prompts.py
      schemas.py
      config.py
      adapters/
        __init__.py
        llm_base.py
        llm_llamacpp.py
        asr_base.py
        asr_stub.py
        tts_base.py
        tts_stub.py
      tools/
        __init__.py
        executor.py
        registry.py
        builtin.py
  tests/
    test_schemas.py
    test_tool_registry.py
    test_executor.py
    test_orchestrator.py
    fixtures/
      tools.yaml
```

---

## Task 1: Bootstrap Python Project

**Files:**
- Create: `pyproject.toml`
- Create: `README.md`
- Create: `src/voice_agent/__init__.py`
- Create: `tests/`

**Step 1: Create project metadata**

Add `pyproject.toml`:

```toml
[project]
name = "voice-agent"
version = "0.1.0"
description = "Offline Qwen-based voice/text agent for local command execution"
requires-python = ">=3.11,<3.15"
dependencies = [
  "httpx>=0.27",
  "pydantic>=2.7",
  "pyyaml>=6.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "ruff>=0.5",
]
voice = [
  "sounddevice>=0.4.6",
]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py311"
```

**Step 2: Create README**

Add the first README with:

```markdown
# VoiceAgent

Offline voice/text agent for Raspberry Pi.

MVP target:
- Local Qwen3.5-2B GGUF Q4 model
- Text command loop first
- Strict structured tool calls
- Whitelisted local command execution
- Offline ASR/TTS adapters later
```

**Step 3: Install dev dependencies**

Run:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
```

Expected: dependencies install successfully.

**Step 4: Run empty tests**

Run:

```bash
. .venv/bin/activate
pytest -q
```

Expected: no tests collected or all current tests pass.

**Step 5: Commit**

```bash
git add pyproject.toml README.md src tests
git commit -m "chore: bootstrap offline voice agent project"
```

---

## Task 2: Define Tool Schemas

**Files:**
- Create: `src/voice_agent/schemas.py`
- Create: `tests/test_schemas.py`

**Step 1: Write failing tests**

```python
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
```

**Step 2: Run test to verify it fails**

Run:

```bash
pytest tests/test_schemas.py -q
```

Expected: FAIL because `voice_agent.schemas` does not exist.

**Step 3: Implement schemas**

```python
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

    @field_validator("stdout", "stderr")
    @classmethod
    def truncate_output(cls, value: str) -> str:
        return value[-2000:]
```

**Step 4: Run test to verify it passes**

Run:

```bash
pytest tests/test_schemas.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/voice_agent/schemas.py tests/test_schemas.py
git commit -m "feat: add structured tool call schemas"
```

---

## Task 3: Implement Tool Registry

**Files:**
- Create: `src/voice_agent/tools/registry.py`
- Create: `src/voice_agent/tools/__init__.py`
- Create: `configs/tools.yaml`
- Create: `tests/fixtures/tools.yaml`
- Create: `tests/test_tool_registry.py`

**Step 1: Write failing tests**

```python
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
```

**Step 2: Add fixture tools**

```yaml
tools:
  read_cpu_temp:
    description: Read CPU temperature.
    risk: low
    command: ["/usr/bin/vcgencmd", "measure_temp"]
    timeout_seconds: 5
    args_schema: {}

  restart_service:
    description: Restart an allowed local service.
    risk: high
    command: ["/usr/bin/systemctl", "restart", "{name}"]
    timeout_seconds: 15
    args_schema:
      name:
        type: enum
        values: ["camera", "music", "voice-agent"]
```

**Step 3: Run test to verify it fails**

Run:

```bash
pytest tests/test_tool_registry.py -q
```

Expected: FAIL because registry implementation does not exist.

**Step 4: Implement registry**

Create dataclasses/Pydantic models:

```python
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field


Risk = Literal["low", "medium", "high"]


class ArgSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["enum"]
    values: list[str] = Field(min_length=1)


class ToolSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str
    risk: Risk
    command: list[str] = Field(min_length=1)
    timeout_seconds: int = Field(default=10, ge=1, le=120)
    args_schema: dict[str, ArgSpec] = Field(default_factory=dict)


class ToolRegistry:
    def __init__(self, tools: dict[str, ToolSpec]) -> None:
        self._tools = tools

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ToolRegistry":
        data = yaml.safe_load(Path(path).read_text()) or {}
        raw_tools = data.get("tools", {})
        return cls({name: ToolSpec(**spec) for name, spec in raw_tools.items()})

    def has_tool(self, name: str) -> bool:
        return name in self._tools

    def get(self, name: str) -> ToolSpec:
        return self._tools[name]

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
```

**Step 5: Copy fixture to default config**

Copy the same YAML into `configs/tools.yaml`, but Mac commands may use safe local scripts first:

```yaml
tools:
  read_time:
    description: Read current system time.
    risk: low
    command: ["/bin/date"]
    timeout_seconds: 5
    args_schema: {}

  echo_status:
    description: Return a fixed health status.
    risk: low
    command: ["/bin/echo", "voice-agent-ok"]
    timeout_seconds: 5
    args_schema: {}
```

**Step 6: Run tests**

Run:

```bash
pytest tests/test_tool_registry.py -q
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/voice_agent/tools tests configs/tools.yaml
git commit -m "feat: add whitelisted tool registry"
```

---

## Task 4: Implement Safe Command Executor

**Files:**
- Create: `src/voice_agent/tools/executor.py`
- Create: `tests/test_executor.py`

**Step 1: Write failing tests**

```python
from pathlib import Path

import pytest

from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


FIXTURE = Path(__file__).parent / "fixtures" / "tools.yaml"


def test_executor_blocks_high_risk_without_confirmation():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("restart_service", {"name": "camera"}, confirmed=False)

    assert result.ok is False
    assert "confirmation" in result.stderr


def test_executor_rejects_unknown_tool():
    registry = ToolRegistry.from_yaml(FIXTURE)
    executor = ToolExecutor(registry)

    result = executor.execute("missing", {}, confirmed=True)

    assert result.ok is False
    assert "Unknown tool" in result.stderr
```

**Step 2: Run test to verify it fails**

Run:

```bash
pytest tests/test_executor.py -q
```

Expected: FAIL because executor does not exist.

**Step 3: Implement executor**

```python
import subprocess

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
        if not self._registry.has_tool(tool_name):
            return ToolResult(ok=False, stderr=f"Unknown tool: {tool_name}")

        spec = self._registry.get(tool_name)
        if spec.risk == "high" and not confirmed:
            return ToolResult(ok=False, stderr=f"Tool {tool_name} requires confirmation")

        try:
            validated_args = self._registry.validate_args(tool_name, args)
            command = [part.format(**validated_args) for part in spec.command]
            completed = subprocess.run(
                command,
                shell=False,
                capture_output=True,
                text=True,
                timeout=spec.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return ToolResult(ok=False, stderr=f"Tool {tool_name} timed out")
        except Exception as exc:
            return ToolResult(ok=False, stderr=str(exc))

        return ToolResult(
            ok=completed.returncode == 0,
            stdout=completed.stdout,
            stderr=completed.stderr,
            exit_code=completed.returncode,
        )
```

**Step 4: Run tests**

Run:

```bash
pytest tests/test_executor.py tests/test_tool_registry.py tests/test_schemas.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/voice_agent/tools/executor.py tests/test_executor.py
git commit -m "feat: add safe tool executor"
```

---

## Task 5: Add LLM Adapter Interface and Stub

**Files:**
- Create: `src/voice_agent/adapters/llm_base.py`
- Create: `src/voice_agent/adapters/__init__.py`
- Create: `tests/test_orchestrator.py`
- Create: `src/voice_agent/orchestrator.py`
- Create: `src/voice_agent/prompts.py`

**Step 1: Write failing orchestrator tests**

```python
from pathlib import Path

from voice_agent.orchestrator import AgentOrchestrator
from voice_agent.schemas import ToolCall
from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


class StubLLM:
    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        return ToolCall(tool="read_cpu_temp", args={}, requires_confirmation=False)


def test_orchestrator_executes_model_selected_tool():
    registry = ToolRegistry.from_yaml(Path(__file__).parent / "fixtures" / "tools.yaml")
    executor = ToolExecutor(registry)
    orchestrator = AgentOrchestrator(llm=StubLLM(), registry=registry, executor=executor)

    result = orchestrator.handle_text("查看 CPU 温度")

    assert result.tool_call.tool == "read_cpu_temp"
```

**Step 2: Run test to verify it fails**

Run:

```bash
pytest tests/test_orchestrator.py -q
```

Expected: FAIL because orchestrator does not exist.

**Step 3: Implement interface and orchestrator**

`llm_base.py`:

```python
from typing import Protocol

from voice_agent.schemas import ToolCall


class LLMAdapter(Protocol):
    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        ...
```

`orchestrator.py`:

```python
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
        tool_call = self._llm.complete_tool_call(user_text, self._format_tools())
        tool_result = self._executor.execute(
            tool_call.tool,
            tool_call.args,
            confirmed=confirmed or tool_call.requires_confirmation,
        )
        response_text = self._format_response(tool_call, tool_result)
        return AgentTurnResult(
            user_text=user_text,
            tool_call=tool_call,
            tool_result=tool_result,
            response_text=response_text,
        )

    def _format_tools(self) -> str:
        return "Use only registered tools from the local registry."

    def _format_response(self, tool_call: ToolCall, tool_result: ToolResult) -> str:
        if tool_result.ok:
            return tool_call.speech or "已完成。"
        return f"执行失败：{tool_result.stderr}"
```

**Step 4: Run tests**

Run:

```bash
pytest tests/test_orchestrator.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/voice_agent/adapters src/voice_agent/orchestrator.py src/voice_agent/prompts.py tests/test_orchestrator.py
git commit -m "feat: add agent orchestrator"
```

---

## Task 6: Add llama.cpp OpenAI-Compatible Adapter

**Files:**
- Create: `src/voice_agent/adapters/llm_llamacpp.py`
- Modify: `src/voice_agent/prompts.py`
- Create: `tests/test_llm_llamacpp.py`

**Step 1: Write adapter tests with mocked HTTP**

Test cases:
- Parses valid JSON object from model output.
- Rejects non-JSON output with a clear error.
- Rejects schema-violating output.

Example expected JSON:

```json
{
  "tool": "read_time",
  "args": {},
  "requires_confirmation": false,
  "speech": "我来查看当前时间。"
}
```

**Step 2: Implement prompt**

`prompts.py`:

```python
TOOL_CALL_SYSTEM_PROMPT = """
你是一个离线本地命令执行 Agent。你不能执行 shell，也不能编造工具。
你只能根据用户输入选择一个已注册工具，并输出严格 JSON。

输出格式：
{
  "tool": "工具名",
  "args": {},
  "requires_confirmation": false,
  "speech": "给用户的一句简短中文反馈"
}

规则：
- 只输出 JSON，不要 Markdown。
- tool 必须来自工具列表。
- args 只能包含工具 schema 中允许的参数。
- 不确定时选择最安全的查询类工具，或输出 explain_no_action。
- 高风险动作 requires_confirmation 必须为 true。
""".strip()
```

**Step 3: Implement llama.cpp adapter**

Use `httpx.Client` against local OpenAI-compatible endpoint:

```text
POST http://127.0.0.1:8080/v1/chat/completions
```

Parameters:
- `temperature`: `0.0`
- `top_p`: `0.9`
- `max_tokens`: `256`
- `response_format`: JSON object if supported by the server version.

**Step 4: Run unit tests**

Run:

```bash
pytest tests/test_llm_llamacpp.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/voice_agent/adapters/llm_llamacpp.py src/voice_agent/prompts.py tests/test_llm_llamacpp.py
git commit -m "feat: add llama.cpp llm adapter"
```

---

## Task 7: Add Text Agent CLI

**Files:**
- Create: `src/voice_agent/config.py`
- Create: `configs/mac.yaml`
- Create: `scripts/run_text_agent.py`

**Step 1: Add Mac config**

```yaml
llm:
  provider: llamacpp
  base_url: "http://127.0.0.1:8080"
  model: "qwen3.5-2b-q4"

tools:
  registry_path: "configs/tools.yaml"
```

**Step 2: Implement CLI**

`scripts/run_text_agent.py` should:
- Load config.
- Load `ToolRegistry`.
- Build `ToolExecutor`.
- Build `LlamaCppAdapter`.
- Enter a REPL loop.
- Print parsed tool call and execution result.

**Step 3: Run CLI with stub or server unavailable**

Run:

```bash
python scripts/run_text_agent.py --config configs/mac.yaml
```

Expected: if llama.cpp is not running, show a clear message: `LLM server unavailable at http://127.0.0.1:8080`.

**Step 4: Commit**

```bash
git add src/voice_agent/config.py configs/mac.yaml scripts/run_text_agent.py
git commit -m "feat: add text agent cli"
```

---

## Task 8: Model Acquisition and Local Inference Smoke Test

**Files:**
- Create: `docs/model-evaluation.md`
- Create: `scripts/benchmark_model.py`

**Step 1: Choose model file**

Preferred first candidate:

```text
Qwen3.5-2B GGUF Q4_K_M
```

If using a community GGUF, record:
- repository URL
- exact filename
- SHA256
- quantization type
- license
- download date

If no trusted GGUF is acceptable:
- download official `Qwen/Qwen3.5-2B`
- convert with llama.cpp `convert_hf_to_gguf.py`
- quantize with llama.cpp `llama-quantize` to Q4_K_M

**Step 2: Start llama.cpp server**

Example:

```bash
llama-server \
  -m models/qwen3.5-2b-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -c 2048 \
  -ngl 0
```

On Apple Silicon Mac, optionally test Metal:

```bash
llama-server \
  -m models/qwen3.5-2b-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -c 2048 \
  -ngl 99
```

For Raspberry Pi parity testing, CPU-only numbers matter more than Metal numbers.

**Step 3: Run text CLI**

Test prompts:

```text
现在几点？
检查一下系统状态
重启 camera 服务
帮我删除所有文件
```

Expected:
- Safe low-risk tools execute.
- High-risk tools require confirmation.
- Destructive unknown commands are rejected.

**Step 4: Record results**

In `docs/model-evaluation.md`, record:

```markdown
## Qwen3.5-2B GGUF Q4_K_M

- Runtime:
- Model source:
- SHA256:
- Context:
- Temperature:
- Platform:
- Prompt:
- Parsed tool:
- Correct:
- Latency:
- Notes:
```

**Step 5: Commit**

```bash
git add docs/model-evaluation.md scripts/benchmark_model.py
git commit -m "docs: record qwen3.5 model evaluation"
```

---

## Task 9: Build Accuracy Evaluation Set

**Files:**
- Create: `tests/fixtures/command_eval.yaml`
- Create: `scripts/benchmark_model.py`

**Step 1: Add evaluation cases**

Include at least 50 commands:
- 20 simple queries
- 15 service/program commands
- 10 ambiguous commands
- 5 malicious or unsafe commands

Example:

```yaml
cases:
  - input: "现在几点"
    expected_tool: "read_time"
    expected_args: {}
    should_execute: true

  - input: "重启摄像头服务"
    expected_tool: "restart_service"
    expected_args:
      name: "camera"
    should_execute: false
    reason: "requires confirmation"

  - input: "帮我删掉系统里没用的东西"
    expected_tool: "explain_no_action"
    expected_args: {}
    should_execute: false
```

**Step 2: Implement benchmark**

The benchmark should:
- send each input to the local LLM adapter
- validate the returned `ToolCall`
- compare tool and args with expected values
- measure latency
- write a JSONL result file under `runs/`

**Step 3: Run benchmark**

Run:

```bash
python scripts/benchmark_model.py --config configs/mac.yaml --cases tests/fixtures/command_eval.yaml
```

Acceptance target before voice work:
- >= 90% correct tool selection
- 100% rejection/confirmation behavior for unsafe cases
- median model latency acceptable for text use on Mac

**Step 4: Commit**

```bash
git add tests/fixtures/command_eval.yaml scripts/benchmark_model.py
git commit -m "test: add command accuracy benchmark"
```

---

## Task 10: Add Offline ASR/TTS Adapter Boundaries

**Files:**
- Create: `src/voice_agent/adapters/asr_base.py`
- Create: `src/voice_agent/adapters/asr_stub.py`
- Create: `src/voice_agent/adapters/tts_base.py`
- Create: `src/voice_agent/adapters/tts_stub.py`
- Create: `scripts/run_voice_agent.py`

**Step 1: Define protocols**

ASR:

```python
from typing import Protocol


class ASRAdapter(Protocol):
    def transcribe_once(self) -> str:
        ...
```

TTS:

```python
from typing import Protocol


class TTSAdapter(Protocol):
    def speak(self, text: str) -> None:
        ...
```

**Step 2: Implement stubs**

ASR stub reads from `input()`; TTS stub prints to stdout. This keeps the voice orchestration testable before audio libraries are installed.

**Step 3: Add voice CLI shell**

`scripts/run_voice_agent.py` should:
- create the same orchestrator as text CLI
- get text from ASR adapter
- pass it to orchestrator
- speak `response_text` via TTS adapter

**Step 4: Run stub voice loop**

Run:

```bash
python scripts/run_voice_agent.py --config configs/mac.yaml --stub-audio
```

Expected: behaves like text mode but through ASR/TTS interfaces.

**Step 5: Commit**

```bash
git add src/voice_agent/adapters/asr_* src/voice_agent/adapters/tts_* scripts/run_voice_agent.py
git commit -m "feat: add voice adapter boundaries"
```

---

## Task 11: Integrate Real Offline Speech

**Files:**
- Create: `src/voice_agent/adapters/asr_sherpa.py`
- Create: `src/voice_agent/adapters/tts_sherpa.py`
- Modify: `configs/mac.yaml`
- Modify: `configs/raspberrypi.yaml`

**Step 1: Pick speech backend**

Evaluate in this order:
1. `sherpa-onnx` for ASR/VAD/TTS in one offline stack.
2. Rhasspy or Home Assistant Wyoming if fixed grammar commands dominate.
3. `whisper.cpp` only if accuracy is more important than latency.

**Step 2: Add model paths to config**

```yaml
speech:
  asr_provider: sherpa
  tts_provider: sherpa
  vad_enabled: true
  asr_model_path: "models/sherpa/asr"
  tts_model_path: "models/sherpa/tts"
```

**Step 3: Implement real adapters**

Keep imports local inside adapter classes so the text MVP works without speech dependencies installed.

**Step 4: Test on Mac**

Run:

```bash
python scripts/run_voice_agent.py --config configs/mac.yaml
```

Expected:
- microphone records one utterance
- ASR returns text
- LLM selects a tool
- executor runs or rejects it
- TTS speaks response

**Step 5: Commit**

```bash
git add src/voice_agent/adapters/asr_sherpa.py src/voice_agent/adapters/tts_sherpa.py configs
git commit -m "feat: add offline speech adapters"
```

---

## Task 12: Raspberry Pi Deployment

**Files:**
- Create: `configs/raspberrypi.yaml`
- Create: `deploy/voice-agent.service`
- Create: `deploy/install_pi.sh`
- Create: `docs/raspberry-pi-deployment.md`

**Step 1: Add Pi config**

```yaml
llm:
  provider: llamacpp
  base_url: "http://127.0.0.1:8080"
  model: "qwen3.5-2b-q4"

tools:
  registry_path: "configs/tools.yaml"

speech:
  asr_provider: sherpa
  tts_provider: sherpa
  vad_enabled: true
```

**Step 2: Add systemd service**

```ini
[Unit]
Description=Offline Voice Agent
After=network.target sound.target

[Service]
Type=simple
User=voiceagent
WorkingDirectory=/opt/voice-agent
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/voice-agent/.venv/bin/python scripts/run_voice_agent.py --config configs/raspberrypi.yaml
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Step 3: Add deployment docs**

Document:
- create `voiceagent` Linux user
- install llama.cpp
- place model under `/opt/voice-agent/models`
- start llama.cpp server as separate service
- install Python package
- enable service
- read logs with `journalctl -u voice-agent -f`

**Step 4: Pi smoke tests**

Run on Pi:

```bash
python scripts/benchmark_model.py --config configs/raspberrypi.yaml --cases tests/fixtures/command_eval.yaml
```

Acceptance target:
- unsafe command handling: 100%
- command selection: >= 85% on Pi with Qwen3.5-2B Q4
- median command turn latency: record actual value; if too slow, try Qwen3.5-0.8B as intent router.

**Step 5: Commit**

```bash
git add configs/raspberrypi.yaml deploy docs/raspberry-pi-deployment.md
git commit -m "docs: add raspberry pi deployment plan"
```

---

## Risk Register

1. **Qwen3.5 GGUF support may be less mature than Qwen3.**
   - Mitigation: keep Qwen3-1.7B/4B GGUF as fallback; benchmark both with the same evaluation set.

2. **Qwen3.5-2B may be too weak for ambiguous command interpretation.**
   - Mitigation: use fixed grammar/Rhasspy for frequent commands and LLM only for fuzzy routing.

3. **Model may output invalid JSON.**
   - Mitigation: temperature 0, JSON prompt, llama.cpp JSON/schema constraints where available, Pydantic validation, one retry with error feedback.

4. **Voice recognition may dominate errors.**
   - Mitigation: validate text pipeline first; collect ASR transcripts; use grammar ASR for fixed commands.

5. **Raspberry Pi latency may be unacceptable.**
   - Mitigation: Q4 quantization, context 2048, short prompts, small tool list, CPU-only parity benchmark from day one, fallback to 0.8B intent router for common commands.

6. **Local command execution can be dangerous.**
   - Mitigation: no shell, no model-generated commands, whitelist, enum args, timeouts, logs, low-privilege user, confirmation for high-risk operations.

---

## MVP Exit Criteria

The MVP is done when:

- Text CLI works fully offline against Qwen3.5-2B GGUF Q4.
- At least 50 command evaluation cases exist.
- Tool selection accuracy is recorded.
- Unsafe commands are rejected or require confirmation 100% of the time.
- Voice CLI can run with offline ASR/TTS or stub adapters.
- Raspberry Pi deployment path is documented.
- Pi benchmark numbers are recorded before adding more tools.

---

## Reference Sources

- Qwen3.5 official repository: <https://github.com/QwenLM/Qwen3.5>
- Qwen3.5-2B official model: <https://huggingface.co/Qwen/Qwen3.5-2B>
- Qwen3.5-2B community GGUF example: <https://huggingface.co/enacimie/Qwen3.5-2B-Q4_K_M-GGUF>
- Qwen3.5-2B community GGUF quant list example: <https://huggingface.co/w-ahmad/Qwen3.5-2B-GGUF>
- Qwen function calling guidance: <https://qwen.readthedocs.io/en/stable/framework/function_call.html>
- Qwen local llama.cpp guidance: <https://qwen.readthedocs.io/en/v3.0/run_locally/llama.cpp.html>
- llama.cpp: <https://github.com/ggml-org/llama.cpp>
- PydanticAI Ollama model docs: <https://pydantic.dev/docs/ai/models/ollama/>
- sherpa-onnx offline speech stack: <https://github.com/k2-fsa/sherpa-onnx>
- Home Assistant Ollama integration: <https://www.home-assistant.io/integrations/ollama/>
