from __future__ import annotations

from voice_agent.schemas import ToolCall


class RuleBasedAdapter:
    """Deterministic offline baseline for executor and benchmark development."""

    def complete_tool_call(self, user_text: str, tool_specs: str) -> ToolCall:
        del tool_specs
        text = user_text.lower()

        if any(term in text for term in ["删除所有", "删掉系统", "rm -rf", "格式化", "清空硬盘"]):
            return ToolCall(
                tool="explain_no_action",
                args={},
                requires_confirmation=False,
                speech="这个请求不安全，我不会执行本地命令。",
            )

        service = _detect_service(text)
        if service is not None:
            if any(term in text for term in ["重启", "restart", "重新启动"]):
                return ToolCall(
                    tool="restart_service",
                    args={"name": service},
                    requires_confirmation=True,
                    speech=f"需要确认后才能重启 {service} 服务。",
                )
            if any(term in text for term in ["启动", "start", "打开"]):
                return ToolCall(
                    tool="start_service",
                    args={"name": service},
                    requires_confirmation=True,
                    speech=f"需要确认后才能启动 {service} 服务。",
                )
            if any(term in text for term in ["停止", "stop", "关闭"]):
                return ToolCall(
                    tool="stop_service",
                    args={"name": service},
                    requires_confirmation=True,
                    speech=f"需要确认后才能停止 {service} 服务。",
                )
            if any(term in text for term in ["状态", "status", "是否运行"]):
                return ToolCall(
                    tool="service_status",
                    args={"name": service},
                    requires_confirmation=False,
                    speech=f"我来查看 {service} 服务状态。",
                )

        if any(term in text for term in ["运行多久", "uptime", "开机"]):
            return ToolCall(tool="read_uptime", args={}, speech="我来查看系统运行时间。")
        if any(term in text for term in ["磁盘", "硬盘", "空间", "df"]):
            return ToolCall(tool="read_disk_usage", args={}, speech="我来查看磁盘空间。")
        if any(term in text for term in ["内存", "memory", "压力"]):
            return ToolCall(tool="read_memory", args={}, speech="我来查看内存状态。")
        if any(term in text for term in ["列出", "列表", "目录", "文件"]):
            return ToolCall(tool="list_home", args={}, speech="我来列出当前目录。")
        if any(term in text for term in ["健康", "状态", "status", "自检"]):
            return ToolCall(tool="echo_status", args={}, speech="我来检查系统状态。")
        if any(term in text for term in ["几点", "时间", "date", "time", "现在"]):
            return ToolCall(tool="read_time", args={}, speech="我来查看当前时间。")

        return ToolCall(
            tool="explain_no_action",
            args={},
            requires_confirmation=False,
            speech="我没有找到安全且明确的本地工具。",
        )


def _detect_service(text: str) -> str | None:
    aliases = {
        "camera": ["camera", "摄像头", "相机"],
        "music": ["music", "音乐", "播放器"],
        "voice-agent": ["voice-agent", "voice agent", "语音助手", "助手服务"],
    }
    for service, terms in aliases.items():
        if any(term in text for term in terms):
            return service
    return None
