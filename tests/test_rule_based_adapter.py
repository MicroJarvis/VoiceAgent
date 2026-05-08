from voice_agent.adapters.llm_rule_based import RuleBasedAdapter


def test_rule_based_maps_time_query():
    call = RuleBasedAdapter().complete_tool_call("现在几点", "{}")

    assert call.tool == "read_time"
    assert call.args == {}


def test_rule_based_maps_restart_camera_to_high_risk_tool():
    call = RuleBasedAdapter().complete_tool_call("重启摄像头服务", "{}")

    assert call.tool == "restart_service"
    assert call.args == {"name": "camera"}
    assert call.requires_confirmation is True


def test_rule_based_rejects_unsafe_delete_request():
    call = RuleBasedAdapter().complete_tool_call("帮我删除所有文件", "{}")

    assert call.tool == "explain_no_action"
