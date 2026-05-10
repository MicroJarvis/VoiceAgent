import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { basename, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      console.log(`[${new Date().toISOString()}] POST /api/transcribe`);
      const body = await readJsonBody(req, 85 * 1024 * 1024);
      const result = await transcribeAudio(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/segment") {
      console.log(`[${new Date().toISOString()}] POST /api/segment`);
      const body = await readJsonBody(req);
      const result = await segmentTranscript(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/report") {
      console.log(`[${new Date().toISOString()}] POST /api/report`);
      const body = await readJsonBody(req);
      const result = await generateReport(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/test-responses") {
      console.log(`[${new Date().toISOString()}] POST /api/test-responses`);
      const body = await readJsonBody(req);
      const result = await testResponsesEndpoint(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const status = Number(error.status || 500);
    return sendJson(res, status, {
      error: error.publicMessage || error.message || "Unexpected server error"
    });
  }
}).listen(port, host, () => {
  console.log(`Dental Voice Agent is running at http://${host}:${port}`);
});

async function serveStatic(pathname, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, limit = 12 * 1024 * 1024) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.status = 400;
    throw error;
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${name} is required`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

function normalizeBaseUrl(baseUrl) {
  let raw = requireString(baseUrl, "baseUrl").replace(/\/+$/, "");
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("baseUrl must start with http:// or https://");
    error.status = 400;
    throw error;
  }

  raw = raw.replace(/\/(?:v1\/)?(?:chat\/completions|responses|audio\/transcriptions)$/i, "");
  raw = raw.replace(/\/v1$/i, "");

  return raw;
}

function apiUrl(baseUrl, path) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function readSettings(settings = {}, purpose = "chat") {
  const normalized = {
    transcriptionEngine: "local-whisper",
    whisperCommand: (settings.whisperCommand || settings.transcriptionCommand || "whisper").trim(),
    transcriptionModel: (settings.transcriptionModel || "large-v3-turbo").trim(),
    language: (settings.language || "zh").trim()
  };

  if (purpose === "transcription") {
    return normalized;
  }

  return {
    ...normalized,
    apiKey: requireString(settings.apiKey, "apiKey"),
    baseUrl: normalizeBaseUrl(settings.baseUrl || "https://api.openai.com/v1"),
    reportModel: (settings.reportModel || "gpt-4o-mini").trim()
  };
}

async function transcribeAudio(body) {
  const settings = readSettings(body.settings, "transcription");
  const audioBase64 = requireString(body.audioBase64, "audioBase64").replace(/^data:.*?;base64,/, "");
  const audioBuffer = Buffer.from(audioBase64, "base64");
  if (!audioBuffer.length) {
    const error = new Error("audioBase64 is empty");
    error.status = 400;
    throw error;
  }

  const mimeType = body.mimeType || "audio/webm";
  const fileName = body.fileName || extensionForMime(mimeType);
  const payload = await transcribeWithLocalWhisper({
    audioBuffer,
    fileName,
    settings
  });
  const text = payload.text || "";
  return {
    text,
    raw: payload,
    segments: splitTextIntoSegments(text)
  };
}

async function transcribeWithLocalWhisper({ audioBuffer, fileName, settings }) {
  const workDir = await mkdtemp(join(tmpdir(), "dental-voice-agent-"));
  const safeFileName = basename(fileName || "recording.webm").replace(/[^\w.-]/g, "_");
  const audioPath = join(workDir, safeFileName || "recording.webm");

  try {
    await writeFile(audioPath, audioBuffer);
    const args = [
      audioPath,
      "--model",
      settings.transcriptionModel,
      "--language",
      settings.language || "zh",
      "--task",
      "transcribe",
      "--output_format",
      "json",
      "--output_dir",
      workDir,
      "--verbose",
      "False"
    ];

    console.log(`[${new Date().toISOString()}] local whisper ${settings.whisperCommand} ${args.join(" ")}`);
    const result = await runCommand(settings.whisperCommand, args, { timeoutMs: 20 * 60 * 1000 });
    const jsonPath = join(workDir, `${safeFileName.slice(0, -extname(safeFileName).length) || safeFileName}.json`);
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    return {
      text: String(json.text || "").trim(),
      language: json.language || settings.language,
      duration: json.duration,
      segments: Array.isArray(json.segments) ? json.segments : [],
      command: `${settings.whisperCommand} ${args.map(shellQuote).join(" ")}`,
      stdout: result.stdout.trim()
    };
  } catch (error) {
    error.publicMessage = localWhisperErrorMessage(error);
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function runCommand(command, args, { timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`Local transcription timed out after ${Math.round(timeoutMs / 1000)} seconds`);
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      error.stderr = stderr;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        const error = new Error(`Local whisper exited with code ${code}`);
        error.stderr = stderr;
        error.stdout = stdout;
        reject(error);
      }
    });
  });
}

function localWhisperErrorMessage(error) {
  const detail = [error.message, error.stderr, error.stdout]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (error.code === "ENOENT") {
    return "找不到本地 whisper 命令。请先安装 openai-whisper，或在页面里把本地 Whisper 命令改成正确路径，例如 /opt/homebrew/bin/whisper。";
  }
  return `本地音频转写失败：${detail || "未知错误"}`;
}

function shellQuote(value) {
  const text = String(value);
  return /^[\w./:@=-]+$/.test(text) ? text : JSON.stringify(text);
}

async function segmentTranscript(body) {
  const settings = readSettings(body.settings, "chat");
  const transcript = normalizeTranscriptInput(body.transcript, body.segments);
  const content = await callResponsesJson(
    settings,
    "你是口腔诊疗对话整理助手。你的任务是把转写文本整理成按时间排序的医患对话片段，并尽量判断说话人。只能基于原文，不得补充不存在的信息。输出必须是 JSON。",
    JSON.stringify({
        task: "split_and_label_dental_dialogue",
        speaker_values: ["doctor", "patient", "unknown"],
        output_shape: {
          segments: [
            {
              speaker: "doctor | patient | unknown",
              text: "原文片段，保持语义，不要改写成报告语言"
            }
          ]
        },
        transcript
    })
  );

  const segments = Array.isArray(content.segments)
    ? content.segments
        .map((segment, index) => ({
          id: `s${Date.now()}-${index + 1}`,
          speaker: normalizeSpeaker(segment.speaker),
          text: String(segment.text || "").trim(),
          start: "",
          end: ""
        }))
        .filter((segment) => segment.text)
    : [];

  return { segments, raw: content };
}

async function generateReport(body) {
  const settings = readSettings(body.settings, "chat");
  const encounter = body.encounter || {};
  const segments = Array.isArray(body.segments) ? body.segments : [];
  if (!segments.some((segment) => String(segment.text || "").trim())) {
    const error = new Error("At least one transcript segment is required");
    error.status = 400;
    throw error;
  }

  const transcript = segments.map((segment, index) => ({
    id: segment.id || `s${index + 1}`,
    speaker: normalizeSpeaker(segment.speaker),
    start: segment.start || "",
    end: segment.end || "",
    text: String(segment.text || "").trim()
  }));

  const content = await callResponsesJson(
    settings,
    "你是口腔医疗场景的 AI 病历书记员。请把医患对话整理成报告草稿，报告必须只包含三个部分：主诉情况、接诊分析、治疗方案。主诉情况和接诊分析必须严格基于对话原文。治疗方案优先整理医生明确提到的方案；如果医生没有提及治疗方案，或方案明显缺失，可以根据接诊分析补充 AI 建议，但每条 AI 补充建议必须在句首加 [AI]。输出必须是中文 JSON。",
    JSON.stringify({
        task: "create_three_part_dental_report_draft",
        safety_rules: [
          "主诉情况：只整理患者主诉、症状、持续时间、诱因、部位等已出现信息",
          "接诊分析：整理医生问诊、检查、判断和问题分析；不能编造未出现的检查或影像结果",
          "治疗方案：医生明确说过的治疗方案不要加 [AI]",
          "治疗方案：根据接诊分析补充的建议必须句首加 [AI]",
          "如果无法确定某内容来自医生还是 AI，按 AI 补充处理并加 [AI]",
          "不要输出三个部分之外的正文段落"
        ],
        encounter,
        transcript,
        output_shape: {
          reportTitle: "口腔健康诊疗报告草稿",
          chiefComplaintSummary: "",
          visitAnalysis: "",
          treatmentPlan: [
            {
              item: "",
              source: "doctor | ai",
              evidenceSegmentIds: []
            }
          ]
        }
    })
  );

  return { report: content };
}

async function testResponsesEndpoint(body) {
  const settings = readSettings(body.settings, "chat");
  const payload = {
    model: settings.reportModel,
    input: "请只回复 pong"
  };
  const endpoint = apiUrl(settings.baseUrl, "/v1/responses");
  console.log(`[${new Date().toISOString()}] test responses ${settings.reportModel} -> ${endpoint}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const remotePayload = await readRemotePayload(response);
  if (!response.ok) {
    console.error(`[${new Date().toISOString()}] upstream test error ${response.status} ${endpoint}`, remotePayload);
    throw remoteError(response, remotePayload, endpoint);
  }
  return {
    ok: true,
    endpoint,
    status: response.status,
    text: extractResponseText(remotePayload),
    raw: remotePayload
  };
}

async function callResponsesJson(settings, instructions, input) {
  const payload = {
    model: settings.reportModel,
    input: `${instructions}\n\n请严格只返回 JSON，不要使用 Markdown，不要添加解释文字。\n\n${input}`
  };

  const endpoint = apiUrl(settings.baseUrl, "/v1/responses");
  console.log(`[${new Date().toISOString()}] remote responses ${settings.reportModel} -> ${endpoint}`);
  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let remotePayload = await readRemotePayload(response);

  if (!response.ok) {
    console.error(`[${new Date().toISOString()}] upstream error ${response.status} ${endpoint}`, remotePayload);
    throw remoteError(response, remotePayload, endpoint);
  }

  const text = extractResponseText(remotePayload);
  try {
    return JSON.parse(extractJsonText(text));
  } catch {
    return { text };
  }
}

function extractJsonText(text) {
  const value = String(text || "").trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const firstObject = value.indexOf("{");
  const lastObject = value.lastIndexOf("}");
  if (firstObject !== -1 && lastObject > firstObject) {
    return value.slice(firstObject, lastObject + 1);
  }
  const firstArray = value.indexOf("[");
  const lastArray = value.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    return value.slice(firstArray, lastArray + 1);
  }
  return value;
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (Array.isArray(payload.output)) {
    return payload.output
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .map((content) => content.text || content.output_text || "")
      .filter(Boolean)
      .join("\n");
  }
  return payload.choices?.[0]?.message?.content || "";
}

async function readRemotePayload(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function remoteError(response, payload, endpoint) {
  const message =
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    payload?.text ||
    `Remote API request failed with status ${response.status}`;
  const endpointText = endpoint ? ` Endpoint: ${endpoint}` : "";
  const statusText = response.status ? `HTTP ${response.status}: ` : "";
  const error = new Error(message);
  error.status = response.status || 502;
  error.publicMessage = `${statusText}${message}${endpointText}`;
  return error;
}

function normalizeTranscriptInput(transcript, segments) {
  if (typeof transcript === "string" && transcript.trim()) {
    return transcript.trim();
  }
  if (Array.isArray(segments)) {
    return segments
      .map((segment) => `${normalizeSpeaker(segment.speaker)}: ${String(segment.text || "").trim()}`)
      .filter((line) => line.trim())
      .join("\n");
  }
  const error = new Error("transcript or segments is required");
  error.status = 400;
  throw error;
}

function splitTextIntoSegments(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;])\s+|(?<=\.)\s+/)
    .map((part, index) => ({
      id: `s${Date.now()}-${index + 1}`,
      speaker: "unknown",
      text: part.trim(),
      start: "",
      end: ""
    }))
    .filter((segment) => segment.text);
}

function normalizeSpeaker(speaker) {
  const value = String(speaker || "unknown").toLowerCase();
  if (["doctor", "医生", "dentist"].includes(value)) {
    return "doctor";
  }
  if (["patient", "患者"].includes(value)) {
    return "patient";
  }
  return "unknown";
}

function extensionForMime(mimeType) {
  if (mimeType.includes("mp4")) return "recording.mp4";
  if (mimeType.includes("mpeg")) return "recording.mp3";
  if (mimeType.includes("wav")) return "recording.wav";
  if (mimeType.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}
