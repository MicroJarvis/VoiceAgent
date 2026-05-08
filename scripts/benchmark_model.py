#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from voice_agent.adapters.llm_llamacpp import LlamaCppAdapter
from voice_agent.adapters.llm_rule_based import RuleBasedAdapter
from voice_agent.config import load_config
from voice_agent.orchestrator import AgentOrchestrator
from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


@dataclass(frozen=True)
class BenchmarkSummary:
    total: int
    tool_correct: int
    args_correct: int
    expected_execution_correct: int
    unsafe_gate_correct: int
    actual_executed: int
    executed_ok: int
    median_turn_latency_ms: float
    median_executor_latency_ms: float
    median_executed_executor_latency_ms: float
    median_blocked_executor_latency_ms: float
    output_path: str

    @property
    def tool_accuracy(self) -> float:
        return self.tool_correct / self.total if self.total else 0.0

    @property
    def args_accuracy(self) -> float:
        return self.args_correct / self.total if self.total else 0.0

    @property
    def execution_accuracy(self) -> float:
        return self.expected_execution_correct / self.total if self.total else 0.0

    @property
    def unsafe_gate_accuracy(self) -> float:
        return self.unsafe_gate_correct / self.total if self.total else 0.0


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark command-selection accuracy and latency.")
    parser.add_argument("--config", default="configs/mac.yaml")
    parser.add_argument("--cases", default="tests/fixtures/command_eval.yaml")
    parser.add_argument("--output-dir", default="runs")
    parser.add_argument("--adapter", choices=["llamacpp", "rule-based"], default=None)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute low-risk tools while benchmarking. High-risk tools still need explicit confirms.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    registry = ToolRegistry.from_yaml(config.tools.registry_path)
    executor = ToolExecutor(registry)
    adapter_name = args.adapter or config.llm.provider
    llm = (
        RuleBasedAdapter()
        if adapter_name == "rule-based"
        else LlamaCppAdapter(
            base_url=config.llm.base_url,
            model=config.llm.model,
            timeout_seconds=config.llm.timeout_seconds,
        )
    )
    orchestrator = AgentOrchestrator(llm=llm, registry=registry, executor=executor)

    cases = load_cases(args.cases)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"benchmark-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.jsonl"

    records: list[dict[str, Any]] = []
    for index, case in enumerate(cases, start=1):
        started = time.perf_counter()
        confirmed = bool(case.get("confirmed", False))
        if not args.execute:
            confirmed = False
        try:
            result = orchestrator.handle_text(str(case["input"]), confirmed=confirmed)
            latency_ms = (time.perf_counter() - started) * 1000
            expected_args = case.get("expected_args", {})
            expected_should_execute = bool(case.get("should_execute", False)) and args.execute
            unsafe_case = not bool(case.get("should_execute", True))
            record = {
                "index": index,
                "input": case["input"],
                "expected_tool": case["expected_tool"],
                "actual_tool": result.tool_call.tool,
                "tool_correct": result.tool_call.tool == case["expected_tool"],
                "expected_args": expected_args,
                "actual_args": result.tool_call.args,
                "args_correct": result.tool_call.args == expected_args,
                "expected_should_execute": expected_should_execute,
                "actual_executed": result.tool_result.executed,
                "execution_correct": result.tool_result.executed == expected_should_execute,
                "unsafe_gate_correct": (not result.tool_result.executed) if unsafe_case else True,
                "requires_confirmation": result.tool_call.requires_confirmation,
                "tool_ok": result.tool_result.ok,
                "tool_exit_code": result.tool_result.exit_code,
                "tool_stdout": result.tool_result.stdout,
                "tool_stderr": result.tool_result.stderr,
                "tool_elapsed_ms": result.tool_result.elapsed_ms,
                "latency_ms": latency_ms,
                "error": "",
            }
        except Exception as exc:
            latency_ms = (time.perf_counter() - started) * 1000
            record = {
                "index": index,
                "input": case.get("input"),
                "expected_tool": case.get("expected_tool"),
                "actual_tool": None,
                "tool_correct": False,
                "expected_args": case.get("expected_args", {}),
                "actual_args": None,
                "args_correct": False,
                "expected_should_execute": False,
                "actual_executed": False,
                "execution_correct": False,
                "unsafe_gate_correct": False,
                "requires_confirmation": False,
                "tool_ok": False,
                "tool_exit_code": None,
                "tool_stdout": "",
                "tool_stderr": "",
                "tool_elapsed_ms": None,
                "latency_ms": latency_ms,
                "error": str(exc),
            }
        records.append(record)

    with output_path.open("w", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    summary = summarize(records, str(output_path))
    print(json.dumps(asdict(summary) | {
        "tool_accuracy": summary.tool_accuracy,
        "args_accuracy": summary.args_accuracy,
        "execution_accuracy": summary.execution_accuracy,
        "unsafe_gate_accuracy": summary.unsafe_gate_accuracy,
    }, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if summary.unsafe_gate_accuracy == 1.0 else 1


def load_cases(path: str | Path) -> list[dict[str, Any]]:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    cases = data.get("cases", [])
    if not isinstance(cases, list):
        raise ValueError("cases file must contain a list under 'cases'")
    return cases


def summarize(records: list[dict[str, Any]], output_path: str) -> BenchmarkSummary:
    turn_latencies = [float(record["latency_ms"]) for record in records]
    executor_latencies = [
        float(record["tool_elapsed_ms"])
        for record in records
        if record.get("tool_elapsed_ms") is not None
    ]
    executed_executor_latencies = [
        float(record["tool_elapsed_ms"])
        for record in records
        if record["actual_executed"] and record.get("tool_elapsed_ms") is not None
    ]
    blocked_executor_latencies = [
        float(record["tool_elapsed_ms"])
        for record in records
        if not record["actual_executed"] and record.get("tool_elapsed_ms") is not None
    ]
    return BenchmarkSummary(
        total=len(records),
        tool_correct=sum(1 for record in records if record["tool_correct"]),
        args_correct=sum(1 for record in records if record["args_correct"]),
        expected_execution_correct=sum(1 for record in records if record["execution_correct"]),
        unsafe_gate_correct=sum(1 for record in records if record["unsafe_gate_correct"]),
        actual_executed=sum(1 for record in records if record["actual_executed"]),
        executed_ok=sum(1 for record in records if record["actual_executed"] and record["tool_ok"]),
        median_turn_latency_ms=statistics.median(turn_latencies) if turn_latencies else 0.0,
        median_executor_latency_ms=(
            statistics.median(executor_latencies) if executor_latencies else 0.0
        ),
        median_executed_executor_latency_ms=(
            statistics.median(executed_executor_latencies) if executed_executor_latencies else 0.0
        ),
        median_blocked_executor_latency_ms=(
            statistics.median(blocked_executor_latencies) if blocked_executor_latencies else 0.0
        ),
        output_path=output_path,
    )


if __name__ == "__main__":
    raise SystemExit(main())
