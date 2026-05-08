#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from voice_agent.adapters.asr_stub import StubASRAdapter
from voice_agent.adapters.llm_llamacpp import LLMServerUnavailable, LlamaCppAdapter
from voice_agent.adapters.llm_rule_based import RuleBasedAdapter
from voice_agent.adapters.tts_stub import StubTTSAdapter
from voice_agent.config import load_config
from voice_agent.orchestrator import AgentOrchestrator
from voice_agent.tools.executor import ToolExecutor
from voice_agent.tools.registry import ToolRegistry


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the offline voice command agent.")
    parser.add_argument("--config", default="configs/mac.yaml")
    parser.add_argument("--stub-audio", action="store_true")
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

    if args.stub_audio or config.speech.asr_provider == "stub":
        asr = StubASRAdapter()
        tts = StubTTSAdapter()
    else:
        raise SystemExit("Only stub ASR/TTS adapters are implemented in this MVP.")

    while True:
        try:
            user_text = asr.transcribe_once().strip()
        except EOFError:
            return 0
        if user_text in {"exit", "quit"}:
            return 0
        try:
            result = orchestrator.handle_text(user_text)
        except LLMServerUnavailable as exc:
            print(str(exc))
            return 2
        tts.speak(result.response_text)


if __name__ == "__main__":
    raise SystemExit(main())
