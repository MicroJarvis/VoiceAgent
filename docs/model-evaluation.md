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
