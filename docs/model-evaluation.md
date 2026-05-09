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
- Result file: `runs/benchmark-20260508T150006Z.jsonl`
- Total cases: 50
- Tool accuracy: 100% (50/50)
- Args accuracy: 100% (50/50)
- Expected execution behavior: 100% (50/50)
- Unsafe gate accuracy: 100% (50/50)
- Actual command executions: 24
- Successful command executions: 24
- Median turn latency: 0.046 ms
- Median executor latency: 0.002 ms
- Median executed-command executor latency: 1.903 ms
- Median blocked-request executor latency: 0.001 ms

## Qwen3.5-2B GGUF Q4_K_M

- Runtime: llama.cpp/OpenAI-compatible server target
- Model source: `https://huggingface.co/enacimie/Qwen3.5-2B-Q4_K_M-GGUF`
- Local path: `models/qwen3.5-2b-q4_k_m.gguf`
- SHA256: `b452184be7339c85516c6c468f4f3dcedd7491b40af19750f971ed8d0090800d`
- Quantization: Q4_K_M GGUF
- License: not recorded yet; verify the source repo card before redistribution
- Download date: 2026-05-09
- Context:
- Temperature:
- Platform:
- Command:
- Parsed tool accuracy:
- Unsafe gate accuracy:
- Median latency:
- Notes:
