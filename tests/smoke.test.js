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
            historyAndRisk: {
              medicalHistory: request.encounter.medicalHistory,
              allergies: request.encounter.allergies,
              medications: request.encounter.medications,
              dentalHistory: request.encounter.dentalHistory,
              riskNotes: "无明确高危病史。"
            },
            oralExam: request.encounter.examFindings,
            perioChart: request.encounter.perioChart,
            imagingFindings: request.encounter.imagingFindings,
            diagnoses: [
              { name: "右下后牙疼痛待查", status: "needs_exam", evidenceSegmentIds: ["s1"] }
            ],
            visitAnalysis: "患者诉右下后牙疼痛三天，需进一步口内检查明确病因。",
            treatmentPlan: [
              { item: "[AI] 建议完善口腔检查并必要时拍片。", source: "ai", evidenceSegmentIds: ["s1"] }
            ],
            informedConsent: request.encounter.treatmentConsent,
            followUp: request.encounter.followUp,
            clinicalAlerts: [
              { severity: "warning", message: "治疗前需确认影像和诊断。", evidenceSegmentIds: ["s1"] }
            ],
            openItems: ["医生确认最终诊断。"],
            evidenceTrace: [
              { claim: "右下后牙疼痛三天", source: "transcript", segmentId: "s1" },
              { claim: "检查所见来自医生手动填写", source: "encounter.examFindings", segmentId: "" }
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

  const html = await fetchText(`http://127.0.0.1:${appPort}/`);
  assert(html.includes("id=\"transcriptReviewed\""), "page should include transcript review gate");
  assert(html.includes("id=\"extractPerioBtn\""), "page should include perio extraction control");
  assert(html.includes("id=\"patientSummaryBtn\""), "page should include patient summary control");
  assert(html.includes("id=\"referralLetterBtn\""), "page should include referral letter control");
  assert(html.includes("id=\"auditPanel\""), "page should include audit panel");
  assert(html.includes("id=\"sherpaWsUrl\""), "page should include sherpa websocket setting");
  assert(html.includes("id=\"streamingEnabled\""), "page should include streaming toggle");
  assert(html.includes("id=\"testSherpaBtn\""), "page should include sherpa websocket test button");
  assert(html.includes("id=\"workflowStageBadge\""), "page should include workflow stage badge");
  assert(html.includes("id=\"recordingStateBadge\""), "page should include recording state badge");
  assert(html.includes("id=\"micLevelBar\""), "page should include microphone level meter");
  assert(html.includes("id=\"outputGateHint\""), "page should include output gate hint");
  assert(html.includes("data-document-mode=\"patient\""), "page should include patient summary document tab");
  assert(html.includes("data-tooth-token=\"右下后牙\""), "page should include tooth shortcut chips");
  assert(html.includes("data-field-template=\"allergies\""), "page should include clinical risk templates");
  assert(html.includes("id=\"odontogram\""), "page should include odontogram panel");
  assert(html.includes("id=\"upperArch\""), "page should include upper jaw tooth row");
  assert(html.includes("id=\"lowerArch\""), "page should include lower jaw tooth row");
  assert(html.includes("id=\"toothFindingSummary\""), "page should include tooth finding summary");

  const appJs = await fetchText(`http://127.0.0.1:${appPort}/app.js`);
  assert(appJs.includes("apiKey: \"\""), "frontend should not persist API keys in settings");
  assert(appJs.includes("new WebSocket(wsUrl)"), "frontend should connect to sherpa websocket");
  assert(appJs.includes("const sherpaTargetSampleRate = 16000"), "frontend should stream 16 kHz audio to sherpa");
  assert(appJs.includes("socket.send(\"Done\")"), "frontend should signal sherpa stream completion");
  assert(appJs.includes("applySherpaDraftForFinalization"), "frontend should use sherpa draft for automatic finalization");
  assert(appJs.includes("extractSherpaText"), "frontend should extract text from varied sherpa payloads");
  assert(appJs.includes("sherpaMessagesReceived"), "frontend should expose sherpa message diagnostics");
  assert(appJs.includes("computeWorkflowStage"), "frontend should drive workflow steps from state");
  assert(appJs.includes("renderOutputGateHint"), "frontend should explain blocked output actions");
  assert(appJs.includes("extractToothMentions"), "frontend should highlight dental locations in transcript");
  assert(appJs.includes("extractRiskMentions"), "frontend should highlight clinical risk terms in transcript");
  assert(appJs.includes("renderOdontogram"), "frontend should render a dental tooth chart");
  assert(appJs.includes("upperTeeth"), "frontend should model upper jaw teeth");
  assert(appJs.includes("lowerTeeth"), "frontend should model lower jaw teeth");
  assert(appJs.includes("extractDentalFindings"), "frontend should extract tooth findings from clinical text");
  assert(appJs.includes("spokenToothToFdi"), "frontend should map spoken tooth locations to FDI tooth numbers");

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

  const blocked = await postJsonExpectError(`http://127.0.0.1:${appPort}/api/report`, {
    settings,
    encounter: { patientName: "张三", doctorName: "李医生" },
    segments: [
      { id: "s1", speaker: "patient", text: "右下后牙疼了三天。" }
    ]
  });
  assert(blocked.status === 400, "report endpoint should block missing review gates");
  assert(blocked.body.error.includes("医生审核关口"), "blocked report should explain review gate");

  const autoDraft = await postJson(`http://127.0.0.1:${appPort}/api/report`, {
    settings,
    encounter: {
      patientName: "张三",
      doctorName: "李医生",
      medicalHistory: "无特殊",
      allergies: "无",
      medications: "无",
      examFindings: "右下后牙需进一步检查",
      imagingFindings: "未拍片",
      treatmentConsent: "已告知草稿需医生复核。",
      followUp: "疼痛加重随诊。"
    },
    review: { autoDraft: true },
    segments: [
      { id: "s1", speaker: "patient", text: "右下后牙疼了三天。" }
    ]
  });
  assert(autoDraft.report.chiefComplaintSummary === "右下后牙疼痛三天", "auto draft report should bypass pre-generation gates");

  const report = await postJson(`http://127.0.0.1:${appPort}/api/report`, {
    settings,
    encounter: {
      patientName: "张三",
      patientId: "P001",
      doctorName: "李医生",
      medicalHistory: "无特殊",
      allergies: "无",
      medications: "无",
      dentalHistory: "无特殊",
      examFindings: "右下后牙需进一步检查",
      perioChart: "全口探诊深度 2-3mm，BOP-。",
      imagingFindings: "未拍片",
      diagnoses: "右下后牙疼痛待查",
      treatmentConsent: "已告知需检查后确定方案。",
      followUp: "疼痛加重随诊。"
    },
    review: {
      transcriptReviewed: true,
      historyReviewed: true,
      planReviewed: true
    },
    segments: [
      { id: "s1", speaker: "patient", text: "右下后牙疼了三天。" }
    ]
  });
  assert(report.report.chiefComplaintSummary === "右下后牙疼痛三天", "report should include chief complaint summary");
  assert(report.report.treatmentPlan[0].source === "ai", "report should include ai treatment plan source");
  assert(report.report.historyAndRisk.allergies === "无", "report should include structured allergy history");
  assert(report.report.perioChart.includes("2-3mm"), "report should include perio chart summary");
  assert(report.report.evidenceTrace.length === 2, "report should include evidence trace");
  assert(report.report.clinicalAlerts.length === 1, "report should include clinical alerts");
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

async function fetchText(url) {
  const response = await fetch(url);
  return response.text();
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

async function postJsonExpectError(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
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
