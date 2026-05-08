from pathlib import Path

from voice_agent.config import load_config


def test_loads_mac_config():
    config = load_config(Path("configs/mac.yaml"))

    assert config.llm.provider == "llamacpp"
    assert config.tools.registry_path == "configs/tools.yaml"
