import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const appPort = 3100;
const mockPort = 3101;
const baseUrl = `http://127.0.0.1:${mockPort}`;
const mockBinDir = join(tmpdir(), "dental-voice-agent-test-bin");
const mockWhisper = join(mockBinDir, "mock-whisper.mjs");

const mockServer = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/v1/responses") {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    assert(parsed.model === "mock-model", "responses request should include model");
    assert(!("instructions" in parsed), "responses request should not use instructions");
    assert(!("text" in parsed), "responses request should not use text.format");
    const request = parsed.input === "请只回复 pong" ? null : extractJsonInput(parsed.input);
    const response =
      parsed.input === "请只回复 pong"
        ? { message: "pong" }
        :
      request.task === "split_and_label_dental_dialogue"
        ? {
            segments: [
              { speaker: "doctor", text: "哪里不舒服？" },
              { speaker: "patient", text: "右下后牙疼了三天。" }
            ]
          }
        : {
            reportTitle: "口腔健康诊疗报告草稿",
            chiefComplaintSummary: "右下后牙疼痛三天",
            visitAnalysis: "患者诉右下后牙疼痛三天，需进一步口内检查明确病因。",
            treatmentPlan: [
              { item: "建议完善口腔检查并必要时拍片。", source: "ai", evidenceSegmentIds: [] }
            ]
          };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      output_text: JSON.stringify(response)
    }));
    return;
  }

  if (req.url?.includes("chat/completions")) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "chat completions should not be called" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

await mkdir(mockBinDir, { recursive: true });
await writeFile(mockWhisper, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
const args = process.argv.slice(2);
const audioPath = args[0];
const outputDir = args[args.indexOf("--output_dir") + 1];
const stem = basename(audioPath).slice(0, -extname(audioPath).length);
writeFileSync(join(outputDir, stem + ".json"), JSON.stringify({
  text: "患者说右下后牙疼了三天。",
  language: "zh",
  segments: [{ start: 0, end: 2, text: "患者说右下后牙疼了三天。" }]
}));
`);
await chmod(mockWhisper, 0o755);
await listen(mockServer, mockPort);
const app = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: String(appPort) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth(`http://127.0.0.1:${appPort}/api/health`);

  const health = await fetchJson(`http://127.0.0.1:${appPort}/api/health`);
  assert(health.ok === true, "health check should return ok");

  const settings = {
    apiKey: "test-key",
    baseUrl,
    whisperCommand: mockWhisper,
    transcriptionModel: "base",
    reportModel: "mock-model"
  };

  const transcribed = await postJson(`http://127.0.0.1:${appPort}/api/transcribe`, {
    settings,
    audioBase64: Buffer.from("fake audio").toString("base64"),
    mimeType: "audio/webm",
    fileName: "recording.webm"
  });
  assert(transcribed.text === "患者说右下后牙疼了三天。", "transcribe endpoint should use local whisper output");

  const tested = await postJson(`http://127.0.0.1:${appPort}/api/test-responses`, {
    settings
  });
  assert(tested.ok === true, "test responses endpoint should return ok");
  assert(tested.endpoint.endsWith("/v1/responses"), "test endpoint should use /v1/responses");

  const segmented = await postJson(`http://127.0.0.1:${appPort}/api/segment`, {
    settings,
    transcript: "医生：哪里不舒服？患者：右下后牙疼了三天。"
  });
  assert(segmented.segments.length === 2, "segment endpoint should return two segments");
  assert(segmented.segments[0].speaker === "doctor", "first segment should be doctor");

  const report = await postJson(`http://127.0.0.1:${appPort}/api/report`, {
    settings,
    encounter: { patientName: "张三", doctorName: "李医生" },
    segments: [
      { id: "s1", speaker: "patient", text: "右下后牙疼了三天。" }
    ]
  });
  assert(report.report.chiefComplaintSummary === "右下后牙疼痛三天", "report should include chief complaint summary");
  assert(report.report.treatmentPlan[0].source === "ai", "report should include ai treatment plan source");
} finally {
  app.kill();
  await close(mockServer);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function waitForHealth(url) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not become healthy");
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractJsonInput(input) {
  const text = String(input);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}
