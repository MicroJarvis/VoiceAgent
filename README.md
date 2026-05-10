# 口腔诊疗记录台

这是一个本地运行的口腔医疗 Voice Agent MVP。它可以在浏览器中录制医生和患者的对话，使用本机 Whisper 完成音频转写，再调用 Responses 风格接口完成医患角色整理和报告草稿生成。

## 功能

- 录制诊室音频并回放
- 使用本机 Whisper 命令生成对话文本，不依赖 OpenAI/Groq 云端转写
- 调用可配置的整理模型标注医生/患者角色
- 医生手动修正每一句对话
- 生成结构化口腔诊疗报告草稿
- 报告复制、打印
- 本机浏览器保存会话
- 本地 Whisper 命令、转写模型、整理 API Key、整理 Base URL、整理模型均可在界面设置

## 运行

```bash
npm start
```

打开：

```text
http://localhost:3000
```

## 本地转写设置

默认转写服务使用本机 `whisper` 命令。你的机器当前需要能执行：

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

1. 填写患者、医生、就诊日期。
2. 确认本地 Whisper 命令和转写模型。
3. 填写整理 API Key、整理 Base URL 和整理模型。
4. 勾选患者录音和 AI 辅助整理授权。
5. 点击“开始”录音。
6. 点击“结束”后点击“转写录音”。
7. 根据需要点击“AI 标注角色”。
8. 医生修正对话内容。
9. 点击“生成报告”。
10. 医生审核后复制或打印报告。

## 医疗使用边界

当前版本生成的是报告草稿，不是最终诊断。诊断、治疗计划、风险告知、用药和复诊安排必须由医生审核确认后才能用于正式病历或患者沟通。
