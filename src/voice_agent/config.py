from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field


class LLMConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str = "llamacpp"
    base_url: str = "http://127.0.0.1:8080"
    model: str = "qwen3.5-2b-q4"
    timeout_seconds: float = Field(default=30.0, gt=0)


class ToolsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registry_path: str = "configs/tools.yaml"


class SpeechConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asr_provider: str = "stub"
    tts_provider: str = "stub"
    vad_enabled: bool = False


class AppConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    llm: LLMConfig = Field(default_factory=LLMConfig)
    tools: ToolsConfig = Field(default_factory=ToolsConfig)
    speech: SpeechConfig = Field(default_factory=SpeechConfig)


def load_config(path: str | Path) -> AppConfig:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    return AppConfig(**data)
