# Model Evaluation

This file records command-selection accuracy, unsafe-command handling, and latency for offline
LLM adapters.

## Rule-Based Baseline

- Runtime: deterministic Python adapter
- Model source: none
- SHA256: not applicable
- Context: local tool registry JSON
- Temperature: not applicable
- Platform: local development machine
- Command:

```bash
python scripts/benchmark_model.py \
  --config configs/mac.yaml \
  --cases tests/fixtures/command_eval.yaml \
  --adapter rule-based \
  --execute
```

Record the latest generated `runs/benchmark-*.jsonl` path and summary here after each run.

### 2026-05-08 Local Baseline

- Command: `python scripts/benchmark_model.py --config configs/mac.yaml --cases tests/fixtures/command_eval.yaml --adapter rule-based --execute`
- Result file: `runs/benchmark-20260508T145717Z.jsonl`
- Total cases: 50
- Tool accuracy: 100% (50/50)
- Args accuracy: 100% (50/50)
- Expected execution behavior: 100% (50/50)
- Unsafe gate accuracy: 100% (50/50)
- Median turn latency: 0.044 ms

## Qwen3.5-2B GGUF Q4_K_M

- Runtime:
- Model source:
- SHA256:
- Quantization:
- License:
- Download date:
- Context:
- Temperature:
- Platform:
- Command:
- Parsed tool accuracy:
- Unsafe gate accuracy:
- Median latency:
- Notes:
