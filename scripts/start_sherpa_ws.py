#!/usr/bin/env python3
"""Local sherpa-onnx streaming ASR WebSocket server.

The browser sends 16 kHz mono float32 PCM chunks as binary WebSocket messages
and sends the text message "Done" when recording stops.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
from pathlib import Path
from typing import Optional

import numpy as np
import sherpa_onnx
import websockets


SAMPLE_RATE = 16000


def find_one(model_dir: Path, candidates: list[str], patterns: list[str]) -> Path:
    for name in candidates:
        path = model_dir / name
        if path.is_file():
            return path

    for pattern in patterns:
        matches = sorted(model_dir.glob(pattern))
        if matches:
            return matches[0]

    raise FileNotFoundError(
        f"Cannot find {'/'.join(patterns)} in {model_dir}. Checked: {', '.join(candidates)}"
    )


def existing_file(path: str) -> Optional[Path]:
    if not path:
        return None

    resolved = Path(path).expanduser().resolve()
    if resolved.is_file():
        return resolved

    raise FileNotFoundError(f"{resolved} does not exist")


def normalize_hotword_line(line: str) -> str:
    text = line.strip()
    if not text or text.startswith("#"):
        return ""

    if " " in text:
        return text

    if text.isascii():
        return " ".join(text)

    return " ".join(text)


def load_tokens(tokens: Path) -> set[str]:
    vocabulary = set()
    for line in tokens.read_text().splitlines():
        parts = line.split()
        if parts:
            vocabulary.add(parts[0])
    return vocabulary


def prepare_hotwords_file(
    source: Optional[Path],
    output: Path,
    *,
    tokens: Path,
) -> Optional[Path]:
    if source is None:
        return None

    vocabulary = load_tokens(tokens)
    lines = [
        normalized
        for normalized in (normalize_hotword_line(line) for line in source.read_text().splitlines())
        if normalized and all(token in vocabulary for token in normalized.split())
    ]
    if not lines:
        return None

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n")
    return output


def build_recognizer(args: argparse.Namespace) -> sherpa_onnx.OnlineRecognizer:
    model_dir = Path(args.model_dir).expanduser().resolve()
    tokens = find_one(model_dir, ["tokens.txt"], "tokens.txt")
    encoder = find_one(
        model_dir,
        [
            "encoder-epoch-99-avg-1.onnx",
            "encoder-epoch-99-avg-1.int8.onnx",
            "encoder.onnx",
        ],
        ["encoder-epoch-*-avg-*.onnx", "encoder*.onnx"],
    )
    decoder = find_one(
        model_dir,
        ["decoder-epoch-99-avg-1.onnx", "decoder.onnx"],
        ["decoder-epoch-*-avg-*.onnx", "decoder*.onnx"],
    )
    joiner = find_one(
        model_dir,
        [
            "joiner-epoch-99-avg-1.onnx",
            "joiner-epoch-99-avg-1.int8.onnx",
            "joiner.onnx",
        ],
        ["joiner-epoch-*-avg-*.onnx", "joiner*.onnx"],
    )
    hotwords_file = existing_file(args.hotwords_file)
    prepared_hotwords_file = prepare_hotwords_file(
        hotwords_file,
        Path(args.hotwords_runtime_file).expanduser().resolve(),
        tokens=tokens,
    )
    decoding_method = args.decoding_method
    if prepared_hotwords_file and decoding_method != "modified_beam_search":
        logging.info(
            "Switching decoding method to modified_beam_search because hotwords are enabled"
        )
        decoding_method = "modified_beam_search"

    logging.info("Loading sherpa-onnx model from %s", model_dir)
    logging.info("encoder=%s", encoder.name)
    logging.info("decoder=%s", decoder.name)
    logging.info("joiner=%s", joiner.name)
    logging.info("tokens=%s", tokens.name)
    if prepared_hotwords_file:
        logging.info(
            "hotwords=%s score=%s",
            prepared_hotwords_file,
            args.hotwords_score,
        )

    return sherpa_onnx.OnlineRecognizer.from_transducer(
        tokens=str(tokens),
        encoder=str(encoder),
        decoder=str(decoder),
        joiner=str(joiner),
        num_threads=args.num_threads,
        sample_rate=SAMPLE_RATE,
        feature_dim=args.feature_dim,
        decoding_method=decoding_method,
        max_active_paths=args.max_active_paths,
        hotwords_file=str(prepared_hotwords_file or ""),
        hotwords_score=args.hotwords_score,
        enable_endpoint_detection=args.enable_endpoint_detection,
        rule1_min_trailing_silence=args.rule1_min_trailing_silence,
        rule2_min_trailing_silence=args.rule2_min_trailing_silence,
        rule3_min_utterance_length=args.rule3_min_utterance_length,
        provider=args.provider,
        model_type=args.model_type,
    )


async def decode_ready(recognizer: sherpa_onnx.OnlineRecognizer, stream) -> None:
    loop = asyncio.get_running_loop()
    while recognizer.is_ready(stream):
        await loop.run_in_executor(None, recognizer.decode_stream, stream)


def result_payload(
    recognizer: sherpa_onnx.OnlineRecognizer,
    stream,
    *,
    is_final: bool,
) -> str:
    result = recognizer.get_result_all(stream)
    return json.dumps(
        {
            "text": result.text.strip(),
            "tokens": list(result.tokens),
            "timestamps": list(result.timestamps),
            "start_time": result.start_time,
            "is_final": is_final,
        },
        ensure_ascii=False,
    )


async def handle_client(websocket, recognizer: sherpa_onnx.OnlineRecognizer) -> None:
    stream = recognizer.create_stream()
    peer = websocket.remote_address
    bytes_received = 0
    messages_sent = 0
    logging.info("Client connected: %s", peer)

    try:
        async for message in websocket:
            if isinstance(message, str):
                if message.strip().lower() == "done":
                    stream.input_finished()
                    await decode_ready(recognizer, stream)
                    await websocket.send(
                        result_payload(recognizer, stream, is_final=True)
                    )
                    await websocket.send("Done!")
                    logging.info(
                        "Client finished: %s, bytes=%s, results=%s",
                        peer,
                        bytes_received,
                        messages_sent,
                    )
                    return

                await websocket.send(
                    json.dumps(
                        {"error": f"Unsupported text message: {message[:80]}"},
                        ensure_ascii=False,
                    )
                )
                continue

            if len(message) % np.dtype(np.float32).itemsize:
                await websocket.send(
                    json.dumps(
                        {"error": "Binary audio must be float32 PCM bytes."},
                        ensure_ascii=False,
                    )
                )
                continue

            samples = np.frombuffer(message, dtype=np.float32)
            if samples.size == 0:
                continue

            bytes_received += len(message)
            stream.accept_waveform(SAMPLE_RATE, samples)
            await decode_ready(recognizer, stream)
            text = recognizer.get_result(stream)
            await websocket.send(result_payload(recognizer, stream, is_final=False))
            if text:
                messages_sent += 1

            if recognizer.is_endpoint(stream):
                recognizer.reset(stream)

    except websockets.exceptions.ConnectionClosed:
        logging.info("Client disconnected: %s", peer)


async def run(args: argparse.Namespace) -> None:
    recognizer = build_recognizer(args)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass

    async def handler(websocket) -> None:
        await handle_client(websocket, recognizer)

    async with websockets.serve(
        handler,
        args.host,
        args.port,
        max_size=None,
        ping_interval=20,
        ping_timeout=20,
    ):
        logging.info("sherpa-onnx WebSocket listening on ws://%s:%s", args.host, args.port)
        await stop.wait()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-dir",
        default="models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20",
        help="Directory containing encoder/decoder/joiner ONNX files and tokens.txt.",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=6006)
    parser.add_argument("--num-threads", type=int, default=2)
    parser.add_argument("--feature-dim", type=int, default=80)
    parser.add_argument("--provider", default="cpu", choices=["cpu", "coreml", "cuda"])
    parser.add_argument("--model-type", default="zipformer")
    parser.add_argument(
        "--decoding-method",
        default="greedy_search",
        choices=["greedy_search", "modified_beam_search"],
    )
    parser.add_argument("--max-active-paths", type=int, default=4)
    parser.add_argument(
        "--hotwords-file",
        default="config/dental_hotwords.txt",
        help="Optional dental hotwords file. Chinese words can be written normally or space-separated.",
    )
    parser.add_argument(
        "--hotwords-runtime-file",
        default="runs/dental_hotwords.sherpa.txt",
        help="Generated hotwords file in sherpa token format.",
    )
    parser.add_argument("--hotwords-score", type=float, default=2.0)
    parser.add_argument("--enable-endpoint-detection", action="store_true")
    parser.add_argument("--rule1-min-trailing-silence", type=float, default=2.4)
    parser.add_argument("--rule2-min-trailing-silence", type=float, default=1.2)
    parser.add_argument("--rule3-min-utterance-length", type=float, default=20.0)
    parser.add_argument("--log-level", default="INFO")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
