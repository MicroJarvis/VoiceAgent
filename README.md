# VoiceAgent

Offline voice/text agent for Raspberry Pi.

MVP target:
- Local Qwen3.5-2B GGUF Q4 model
- Text command loop first
- Strict structured tool calls
- Whitelisted local command execution
- Offline ASR/TTS adapters later

## Current Developer Flow

Install and run tests:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest -q
```

Run a deterministic offline command benchmark without a local LLM server:

```bash
python scripts/benchmark_model.py \
  --config configs/mac.yaml \
  --cases tests/fixtures/command_eval.yaml \
  --adapter rule-based \
  --execute
```

Run the text agent against a llama.cpp OpenAI-compatible server:

```bash
python scripts/run_text_agent.py --config configs/mac.yaml
```
