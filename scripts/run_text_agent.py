#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from voice_agent.adapters.llm_llamacpp import LLMServerUnavailable, LlamaCppAdapter
from voice_agent.adapters.llm_rule_based import RuleBasedAdapter
from voice_agent.config import load_config
from voice_agent.orchestrator import AgentOrchestrator
from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the offline text command agent.")
    parser.add_argument("--config", default="configs/mac.yaml")
    parser.add_argument(
        "--adapter",
        choices=["llamacpp", "rule-based"],
        default=None,
        help="Override the configured LLM provider.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    registry = ToolRegistry.from_yaml(config.tools.registry_path)
    executor = ToolExecutor(registry)
    adapter_name = args.adapter or config.llm.provider
    if adapter_name == "rule-based":
        llm = RuleBasedAdapter()
    else:
        llm = LlamaCppAdapter(
            base_url=config.llm.base_url,
            model=config.llm.model,
            timeout_seconds=config.llm.timeout_seconds,
        )
    orchestrator = AgentOrchestrator(llm=llm, registry=registry, executor=executor)

    print("VoiceAgent text mode. Type Ctrl-D or 'exit' to quit.")
    while True:
        try:
            user_text = input("you> ").strip()
        except EOFError:
            print()
            return 0
        if user_text in {"exit", "quit"}:
            return 0
        if not user_text:
            continue

        confirmed = user_text.startswith("确认 ")
        if confirmed:
            user_text = user_text.removeprefix("确认 ").strip()
        try:
            result = orchestrator.handle_text(user_text, confirmed=confirmed)
        except LLMServerUnavailable as exc:
            print(str(exc))
            return 2

        print("tool_call>", result.tool_call.model_dump_json(ensure_ascii=False))
        print(
            "tool_result>",
            json.dumps(result.tool_result.model_dump(), ensure_ascii=False, sort_keys=True),
        )
        print(f"agent> {result.response_text}")


if __name__ == "__main__":
    raise SystemExit(main())
