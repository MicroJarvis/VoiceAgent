# 口腔诊疗记录台

这是一个本地运行的口腔医疗 Voice Agent MVP。它可以在浏览器中录制医生和患者的对话，使用 sherpa-onnx WebSocket 生成录音中的实时草稿，结束后调用 Responses 风格接口完成医患角色校对、证据链追踪和结构化报告草稿生成；本机 Whisper 保留为没有实时草稿时的回退转写。

## 功能

- 录制诊室音频并回放
- 使用 sherpa-onnx WebSocket 在录音中生成实时草稿
- 点击结束后自动用实时草稿做 AI 角色校对、病历整理和报告草稿生成
- 没有实时草稿时回退到本机 Whisper 完整转写
- 调用可配置的整理模型标注医生/患者角色
- 医生手动修正每一句对话
- 医生审核关口：转写/牙位、病史风险、方案知情同意、最终报告四步确认
- 顶部流程状态会根据授权、录音、整理、审核和输出条件实时变化
- 录音面板显示麦克风、实时转写和整理接口健康状态，并提供语音信号强度条
- 结构化口腔记录：病史、过敏史、用药史、检查、影像、诊断、知情同意、复诊医嘱
- 牙位快捷 chip 和风险速记模板可快速补充主诉、检查、过敏史、用药史和知情同意
- 对话片段会本地高亮牙位、左右侧和高风险关键词，便于医生优先核对
- 牙周/检查指标可从对话中本地摘录，便于快速补充探诊深度、出血和松动度
- 生成带证据链和开放问题的结构化口腔诊疗报告草稿
- 病历草稿、患者说明和转诊信以文档标签分开编辑，避免派生文书覆盖原始病历草稿
- 显示本地审计日志，记录录音、转写、角色标注、报告生成、复制和打印等关键动作
- 对手术、麻醉、处方、根管、种植、拔牙等高风险信息给出审核提示
- 报告必须最终审核后才能复制、打印
- 本机浏览器保存会话
- 本地 Whisper 命令、转写模型、整理 API Key、整理 Base URL、整理模型均可在界面设置
- API Key 默认不保存到浏览器本地存储

## 运行

```bash
npm start
```

打开：

```text
http://localhost:3000
```

## 实时转写设置

首次使用需要安装 Python 依赖并下载 sherpa 模型；当前项目默认使用 sherpa-onnx 中英双语 Zipformer int8 流式模型，本地统计约 89M 参数，适合中文夹英文术语的诊室对话：

```bash
.venv/bin/pip install sherpa-onnx numpy websockets click onnx
hf download csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20 \
  encoder-epoch-99-avg-1.int8.onnx \
  decoder-epoch-99-avg-1.onnx \
  joiner-epoch-99-avg-1.int8.onnx \
  tokens.txt \
  --local-dir models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20
```

启动脚本默认会加载 `config/dental_hotwords.txt` 里的牙科热词，并在需要时自动切换到 `modified_beam_search`。

启动 sherpa-onnx WebSocket：

```bash
.venv/bin/python scripts/start_sherpa_ws.py --host 127.0.0.1 --port 6006
```

界面默认连接：

```text
Sherpa 实时 WS：ws://localhost:6006
```

浏览器会向 sherpa-onnx WebSocket 服务发送 16 kHz 单声道 `float32` PCM 音频块，停止录音时发送 `Done`。如果服务监听在别的端口，请把界面里的地址改成你的实际服务地址。

如果没有启动 sherpa-onnx，或取消勾选“启用 sherpa-onnx 实时草稿”，录音仍会保存；点击结束后会回退到本机 Whisper 完整转写，再继续 AI 校对和报告生成。

## 本地 Whisper 回退设置

本机 Whisper 只作为实时草稿不可用时的回退。你的机器当前需要能执行：

```text
whisper
```

界面默认值：

```text
本地 Whisper 命令：whisper
转写模型：large-v3-turbo
```

如果命令不在 PATH，可以填完整路径，例如：

```text
/opt/homebrew/bin/whisper
```

模型可以填 `tiny`、`base`、`small`、`medium`、`large-v3-turbo`、`large` 等本机 Whisper 支持的模型。模型越大越准，也越慢。当前默认使用你本机已缓存的 `large-v3-turbo`。

## 整理接口设置

报告整理使用 Responses 风格接口。后端会在你填写的整理 Base URL 后拼接 `/v1/responses`：

```text
整理 Base URL：https://api.openai.com
整理模型：gpt-4o-mini
```

也可以填写其他兼容服务的 Base URL 和模型名。整理服务需要支持：

- `POST /v1/responses`

## 使用流程

1. 填写患者、医生、就诊日期、主诉速记。
2. 补充全身病史、过敏史、用药史、牙科既往史、检查、影像、诊断、知情同意和复诊医嘱；无特殊也应写明。
3. 确认本地 Whisper 命令和转写模型。
4. 填写整理 API Key、整理 Base URL 和整理模型。
5. 勾选患者录音/AI 辅助整理授权，并确认符合诊所隐私和数据留存要求。
6. 确认 sherpa-onnx WebSocket 服务已启动，并勾选“启用 sherpa-onnx 实时草稿”。
7. 点击“开始”录音；系统会把实时草稿滚动写入对话记录。
8. 点击“结束”后系统会自动用实时草稿做 AI 校对角色并生成报告草稿；如果没有实时稿，会回退到本机 Whisper 完整转写。
9. 医生修正对话内容、说话人、牙位和左右侧。
10. 优先处理对话片段里的牙位、左右侧和高风险关键词提示。
11. 可用牙位快捷和风险速记模板补充临床字段；如果对话涉及牙周检查，点击“从对话摘录”并核对牙周/检查指标。
12. 检查报告中的 `[AI]` 建议、证据链、审核提示和待补充项。
13. 勾选最终报告审核后复制、打印，或派生患者说明/转诊信；界面会显示当前不能输出的具体原因。

## 对标 Overjet Voice 的当前定位

公开资料中的 Overjet Voice 重点能力包括 ambient clinical notes、hands-free perio charting、letters/referrals、长期音频归档、audit trail、PMS sync、HIPAA/security 和 DSO analytics。

当前本地版本优先强化了以下差异化能力：

- 本机 Whisper 转写，录音不需要上传到云端转写服务
- 报告生成前强制医生审核关口，避免“转写错即出报告”
- 结构化病史、风险、检查、诊断、知情同意、复诊字段在同一界面完成
- AI 治疗建议必须标注 `[AI]`，并要求 evidenceTrace 说明依据
- 本地快速摘录牙周/检查指标，减少手动查找对话片段
- 最终审核后可派生患者说明和转诊信草稿
- 本地审计日志对医生审核过程更透明
- API Key 不写入浏览器本地存储

仍未实现、不能宣称等同企业级竞品的能力：

- PMS 双向同步
- 企业级登录权限、审计日志和集中管理
- 长期加密音频归档
- 完整六点法牙周 charting 和专用语音录入 UI
- DSO analytics 和多诊所质控报表

## 医疗使用边界

当前版本生成的是报告草稿，不是最终诊断。诊断、治疗计划、风险告知、用药和复诊安排必须由医生审核确认后才能用于正式病历或患者沟通。

如用于真实患者资料，诊所仍需自行确认数据处理协议、访问控制、加密、审计、留存和删除流程是否满足所在地区法规与诊所制度。
