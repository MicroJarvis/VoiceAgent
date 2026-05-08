import pytest

from voice_agent.adapters.llm_llamacpp import LLMResponseError, parse_tool_call_json


def test_parse_valid_tool_call_json():
    call = parse_tool_call_json(
        '{"tool":"read_time","args":{},"requires_confirmation":false,"speech":"我来查看当前时间。"}'
    )

    assert call.tool == "read_time"
    assert call.args == {}


def test_rejects_non_json_output():
    with pytest.raises(LLMResponseError, match="not valid JSON"):
        parse_tool_call_json("```json\n{}\n```")


def test_rejects_schema_violating_output():
    with pytest.raises(LLMResponseError, match="ToolCall validation"):
        parse_tool_call_json('{"tool":"","args":{}}')
