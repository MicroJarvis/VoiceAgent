const state = {
  mediaRecorder: null,
  chunks: [],
  audioBlob: null,
  audioMimeType: "audio/webm",
  recordingStartedAt: 0,
  elapsedBeforePause: 0,
  timerId: null,
  segments: [],
  report: null,
  reportText: ""
};

const els = {
  statusText: document.querySelector("#statusText"),
  saveCaseBtn: document.querySelector("#saveCaseBtn"),
  loadCaseBtn: document.querySelector("#loadCaseBtn"),
  patientName: document.querySelector("#patientName"),
  doctorName: document.querySelector("#doctorName"),
  visitDate: document.querySelector("#visitDate"),
  chiefNote: document.querySelector("#chiefNote"),
  apiKey: document.querySelector("#apiKey"),
  baseUrl: document.querySelector("#baseUrl"),
  whisperCommand: document.querySelector("#whisperCommand"),
  transcriptionModel: document.querySelector("#transcriptionModel"),
  reportModel: document.querySelector("#reportModel"),
  testResponsesBtn: document.querySelector("#testResponsesBtn"),
  consent: document.querySelector("#consent"),
  rememberSettings: document.querySelector("#rememberSettings"),
  timer: document.querySelector("#timer"),
  startBtn: document.querySelector("#startBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  transcribeBtn: document.querySelector("#transcribeBtn"),
  recordingMeta: document.querySelector("#recordingMeta"),
  apiTestResult: document.querySelector("#apiTestResult"),
  audioPreview: document.querySelector("#audioPreview"),
  manualSpeaker: document.querySelector("#manualSpeaker"),
  manualText: document.querySelector("#manualText"),
  addSegmentBtn: document.querySelector("#addSegmentBtn"),
  segmentBtn: document.querySelector("#segmentBtn"),
  segments: document.querySelector("#segments"),
  segmentTemplate: document.querySelector("#segmentTemplate"),
  generateReportBtn: document.querySelector("#generateReportBtn"),
  copyReportBtn: document.querySelector("#copyReportBtn"),
  printBtn: document.querySelector("#printBtn"),
  reportEditor: document.querySelector("#reportEditor")
};

init();

function init() {
  els.visitDate.valueAsDate = new Date();
  loadSettings();
  bindEvents();
  renderSegments();
}

function bindEvents() {
  els.startBtn.addEventListener("click", startRecording);
  els.pauseBtn.addEventListener("click", togglePause);
  els.stopBtn.addEventListener("click", stopRecording);
  els.transcribeBtn.addEventListener("click", transcribeRecording);
  els.addSegmentBtn.addEventListener("click", addManualSegment);
  els.segmentBtn.addEventListener("click", aiSegmentTranscript);
  els.generateReportBtn.addEventListener("click", generateReport);
  els.testResponsesBtn.addEventListener("click", testResponsesEndpoint);
  els.copyReportBtn.addEventListener("click", copyReport);
  els.printBtn.addEventListener("click", () => window.print());
  els.saveCaseBtn.addEventListener("click", saveCase);
  els.loadCaseBtn.addEventListener("click", loadCase);
  els.reportEditor.addEventListener("input", () => {
    state.reportText = els.reportEditor.value;
  });
  els.rememberSettings.addEventListener("change", saveSettings);
  [els.whisperCommand, els.apiKey, els.baseUrl, els.transcriptionModel, els.reportModel].forEach((input) => {
    input.addEventListener("change", saveSettings);
  });
}

async function startRecording() {
  if (!els.consent.checked) {
    setStatus("请先确认授权", "error");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("浏览器不支持录音", "error");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    state.chunks = [];
    state.audioBlob = null;
    state.audioMimeType = mimeType || "audio/webm";
    state.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        state.chunks.push(event.data);
      }
    });

    state.mediaRecorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      state.audioBlob = new Blob(state.chunks, { type: state.audioMimeType });
      els.audioPreview.src = URL.createObjectURL(state.audioBlob);
      els.audioPreview.hidden = false;
      els.transcribeBtn.disabled = false;
      setRecorderNote(`录音已生成，大小 ${formatBytes(state.audioBlob.size)}，可以开始转写。`);
      runAutomaticWorkflow();
    });

    state.mediaRecorder.start(1000);
    state.recordingStartedAt = Date.now();
    state.elapsedBeforePause = 0;
    startTimer();
    els.startBtn.disabled = true;
    els.pauseBtn.disabled = false;
    els.stopBtn.disabled = false;
    els.transcribeBtn.disabled = true;
    setStatus("录音中", "busy");
  } catch (error) {
    setStatus(error.message || "无法开始录音", "error");
  }
}

function togglePause() {
  if (!state.mediaRecorder) return;

  if (state.mediaRecorder.state === "recording") {
    state.mediaRecorder.pause();
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
    clearInterval(state.timerId);
    els.pauseBtn.textContent = "继续";
    setStatus("已暂停");
    return;
  }

  if (state.mediaRecorder.state === "paused") {
    state.mediaRecorder.resume();
    state.recordingStartedAt = Date.now();
    startTimer();
    els.pauseBtn.textContent = "暂停";
    setStatus("录音中", "busy");
  }
}

function stopRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") return;
  if (state.mediaRecorder.state === "recording") {
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
  }
  state.mediaRecorder.stop();
  clearInterval(state.timerId);
  els.startBtn.disabled = false;
  els.pauseBtn.disabled = true;
  els.stopBtn.disabled = true;
  els.pauseBtn.textContent = "暂停";
  setTimer(state.elapsedBeforePause);
  setStatus("录音完成");
}

async function transcribeRecording() {
  if (!state.audioBlob) {
    setStatus("没有录音文件", "error");
    setRecorderNote("没有可转写的录音，请先完成录音。", "error");
    return;
  }

  let settings;
  try {
    settings = readTranscriptionSettings();
  } catch (error) {
    setStatus(error.message, "error");
    setRecorderNote(error.message, "error");
    return;
  }

  try {
    els.transcribeBtn.disabled = true;
    setStatus("准备音频", "busy");
    setRecorderNote(`正在准备 ${formatBytes(state.audioBlob.size)} 的录音文件...`, "busy");
    const audioBase64 = await blobToBase64(state.audioBlob);
    setStatus("上传转写中", "busy");
    setRecorderNote("录音已准备完成，正在本机运行 Whisper 转写。首次运行可能会下载/加载模型，耗时更久。", "busy");
    const result = await postJson("/api/transcribe", {
      settings,
      audioBase64,
      mimeType: state.audioMimeType,
      fileName: fileNameForMime(state.audioMimeType),
      prompt: "口腔门诊医患对话，包含牙位、疼痛、龋齿、牙周、根管、拔牙、种植、正畸、过敏史、用药史等术语。"
    });

    if (Array.isArray(result.segments) && result.segments.length) {
      state.segments = result.segments;
    } else if (result.text) {
      state.segments = [{
        id: createId(),
        speaker: "unknown",
        text: result.text,
        start: "",
        end: ""
      }];
    }
    renderSegments();
    setStatus("转写完成");
    setRecorderNote(`转写完成，共生成 ${state.segments.length} 条初始文本片段。`);
    return true;
  } catch (error) {
    setStatus(error.message, "error");
    setRecorderNote(error.message, "error");
    return false;
  } finally {
    els.transcribeBtn.disabled = false;
  }
}

async function runAutomaticWorkflow() {
  setReportPlaceholder("录音结束，正在自动转写并生成报告...");
  const transcribed = await transcribeRecording();
  if (!transcribed) return;
  await generateReport({ automatic: true });
}

async function aiSegmentTranscript() {
  if (!state.segments.length && els.manualText.value.trim()) {
    addManualSegment();
  }
  if (!state.segments.length) {
    setStatus("没有对话内容", "error");
    return;
  }

  try {
    setStatus("整理对话中", "busy");
    const result = await postJson("/api/segment", {
      settings: readChatSettings(),
      segments: state.segments
    });
    if (Array.isArray(result.segments) && result.segments.length) {
      state.segments = result.segments;
      renderSegments();
      setStatus("对话已整理");
    } else {
      setStatus("未返回有效分段", "error");
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function generateReport(options = {}) {
  if (!state.segments.some((segment) => segment.text.trim())) {
    setStatus("没有对话内容", "error");
    return;
  }

  try {
    setStatus("生成报告中", "busy");
    if (options.automatic) {
      setRecorderNote("转写完成，正在自动生成报告草稿。", "busy");
    }
    const result = await postJson("/api/report", {
      settings: readChatSettings(),
      encounter: readEncounter(),
      segments: state.segments
    });
    state.report = result.report;
    renderReport(state.report);
    setStatus("报告已生成");
    if (options.automatic) {
      setRecorderNote("自动转写和报告生成已完成。");
    }
    return true;
  } catch (error) {
    setStatus(error.message, "error");
    setRecorderNote(error.message, "error");
    return false;
  }
}

async function testResponsesEndpoint() {
  try {
    els.testResponsesBtn.disabled = true;
    setStatus("测试接口中", "busy");
    showApiTestResult("正在请求整理接口...");
    const result = await postJson("/api/test-responses", {
      settings: readChatSettings()
    });
    showApiTestResult(JSON.stringify(result, null, 2));
    setStatus("接口测试通过");
  } catch (error) {
    showApiTestResult(error.message);
    setStatus(error.message, "error");
  } finally {
    els.testResponsesBtn.disabled = false;
  }
}

function addManualSegment() {
  const text = els.manualText.value.trim();
  if (!text) {
    setStatus("请输入对话内容", "error");
    return;
  }
  state.segments.push({
    id: createId(),
    speaker: els.manualSpeaker.value,
    text,
    start: "",
    end: ""
  });
  els.manualText.value = "";
  renderSegments();
  setStatus("已新增");
}

function renderSegments() {
  els.segments.innerHTML = "";
  if (!state.segments.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "等待录音转写或手动补充";
    els.segments.append(empty);
    return;
  }

  state.segments.forEach((segment, index) => {
    const node = els.segmentTemplate.content.firstElementChild.cloneNode(true);
    const speaker = node.querySelector(".segment-speaker");
    const text = node.querySelector(".segment-text");
    const deleteBtn = node.querySelector(".segment-delete");

    speaker.value = segment.speaker || "unknown";
    text.value = segment.text || "";

    speaker.addEventListener("change", () => {
      state.segments[index].speaker = speaker.value;
    });
    text.addEventListener("input", () => {
      state.segments[index].text = text.value;
    });
    deleteBtn.addEventListener("click", () => {
      state.segments.splice(index, 1);
      renderSegments();
    });

    els.segments.append(node);
  });
}

function renderReport(report) {
  state.reportText = formatReportText(report);
  els.reportEditor.value = state.reportText;
}

function reportHeader() {
  const encounter = readEncounter();
  return [
    encounter.patientName && `患者：${encounter.patientName}`,
    encounter.doctorName && `医生：${encounter.doctorName}`,
    encounter.visitDate && `日期：${encounter.visitDate}`
  ].filter(Boolean).join("  ");
}

async function copyReport() {
  const text = els.reportEditor.value.trim();
  if (!text) {
    setStatus("没有可复制的报告", "error");
    return;
  }
  await navigator.clipboard.writeText(text);
  setStatus("已复制");
}

function setReportPlaceholder(text) {
  els.reportEditor.value = text;
  state.reportText = text;
}

function saveCase() {
  localStorage.setItem("dentalVoiceAgent.case", JSON.stringify({
    encounter: readEncounter(),
    segments: state.segments,
    report: state.report,
    reportText: els.reportEditor.value,
    savedAt: new Date().toISOString()
  }));
  saveSettings();
  setStatus("会话已保存");
}

function loadCase() {
  const raw = localStorage.getItem("dentalVoiceAgent.case");
  if (!raw) {
    setStatus("没有保存的会话", "error");
    return;
  }
  try {
    const saved = JSON.parse(raw);
    writeEncounter(saved.encounter || {});
    state.segments = Array.isArray(saved.segments) ? saved.segments : [];
    state.report = saved.report || null;
    state.reportText = saved.reportText || "";
    renderSegments();
    if (state.report) {
      renderReport(state.report);
      if (state.reportText) {
        els.reportEditor.value = state.reportText;
      }
    } else if (state.reportText) {
      els.reportEditor.value = state.reportText;
    }
    setStatus("会话已读取");
  } catch {
    setStatus("会话数据不可用", "error");
  }
}

function readTranscriptionSettings() {
  const settings = {
    transcriptionEngine: "local-whisper",
    whisperCommand: els.whisperCommand.value.trim(),
    transcriptionModel: els.transcriptionModel.value.trim(),
    language: "zh"
  };
  if (!settings.whisperCommand || !settings.transcriptionModel) {
    throw new Error("请填写本地 Whisper 命令和转写模型");
  }
  saveSettings();
  return settings;
}

function readChatSettings() {
  const settings = {
    ...readTranscriptionSettings(),
    apiKey: els.apiKey.value.trim(),
    baseUrl: els.baseUrl.value.trim(),
    reportModel: els.reportModel.value.trim()
  };
  if (!settings.apiKey || !settings.baseUrl || !settings.reportModel) {
    throw new Error("请填写整理 API Key、整理 Base URL 和整理模型");
  }
  saveSettings();
  return settings;
}

function saveSettings() {
  const shouldRemember = els.rememberSettings.checked;
  const settings = {
    remember: shouldRemember,
    apiKey: shouldRemember ? els.apiKey.value : "",
    baseUrl: els.baseUrl.value,
    whisperCommand: els.whisperCommand.value,
    transcriptionModel: els.transcriptionModel.value,
    reportModel: els.reportModel.value
  };
  localStorage.setItem("dentalVoiceAgent.settings", JSON.stringify(settings));
}

function loadSettings() {
  const raw = localStorage.getItem("dentalVoiceAgent.settings");
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    els.rememberSettings.checked = Boolean(settings.remember);
    els.apiKey.value = settings.apiKey || "";
    els.baseUrl.value = settings.baseUrl || "https://api.openai.com/v1";
    els.whisperCommand.value = settings.whisperCommand || "whisper";
    els.transcriptionModel.value =
      !settings.transcriptionModel ||
      settings.transcriptionModel === "base" ||
      settings.transcriptionModel === "gpt-4o-transcribe" ||
      settings.transcriptionModel === "whisper-large-v3-turbo"
        ? "large-v3-turbo"
        : settings.transcriptionModel;
    els.reportModel.value = settings.reportModel || "gpt-4o-mini";
  } catch {
    localStorage.removeItem("dentalVoiceAgent.settings");
  }
}

function readEncounter() {
  return {
    patientName: els.patientName.value.trim(),
    doctorName: els.doctorName.value.trim(),
    visitDate: els.visitDate.value,
    chiefNote: els.chiefNote.value.trim(),
    consentConfirmed: els.consent.checked
  };
}

function formatReportText(report = {}) {
  if (report.text) {
    return String(report.text).trim();
  }

  const lines = [
    report.reportTitle || "口腔健康诊疗报告草稿",
    reportHeader(),
    "",
    sectionText("主诉情况", report.chiefComplaintSummary || plainField(report.chiefComplaint)),
    sectionText("接诊分析", report.visitAnalysis || buildLegacyAnalysis(report)),
    sectionText("治疗方案", formatTreatmentPlan(report.treatmentPlan)),
    "",
    "医生确认："
  ];

  return lines.filter((line) => line !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildLegacyAnalysis(report) {
  return [
    plainField(report.presentIllness),
    plainList(report.oralExam, (item) => `${item.toothOrArea || "未标明部位"}：${item.finding || ""}`),
    plainField(report.imagingFindings),
    plainList(report.assessment, (item) => item.diagnosisOrProblem || "")
  ].filter(Boolean).join("\n");
}

function formatTreatmentPlan(items) {
  if (!Array.isArray(items) || !items.length) {
    return "[AI] 建议医生结合接诊分析进一步完善检查、明确诊断，并与患者确认治疗方案。";
  }
  return items
    .map((item) => {
      const raw = typeof item === "string" ? item : item.item || "";
      const text = String(raw).trim();
      if (!text) return "";
      const source = typeof item === "object" ? String(item.source || "").toLowerCase() : "";
      if (source === "ai" && !text.startsWith("[AI]")) {
        return `[AI] ${text}`;
      }
      return text;
    })
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function sectionText(title, content) {
  const value = String(content || "").trim();
  return value ? `${title}：\n${value}\n` : null;
}

function plainField(field) {
  if (!field) return "";
  return typeof field === "string" ? field : field.value || "";
}

function plainList(items, mapper) {
  if (!Array.isArray(items)) return "";
  return items
    .map(mapper)
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function writeEncounter(encounter) {
  els.patientName.value = encounter.patientName || "";
  els.doctorName.value = encounter.doctorName || "";
  els.visitDate.value = encounter.visitDate || new Date().toISOString().slice(0, 10);
  els.chiefNote.value = encounter.chiefNote || "";
  els.consent.checked = Boolean(encounter.consentConfirmed);
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `请求失败：${response.status}`);
  }
  return data;
}

function setStatus(text, type = "") {
  els.statusText.textContent = text;
  els.statusText.className = `status ${type}`.trim();
}

function setRecorderNote(text, type = "") {
  els.recordingMeta.textContent = text;
  els.recordingMeta.className = `helper-text ${type}`.trim();
}

function showApiTestResult(text) {
  els.apiTestResult.hidden = false;
  els.apiTestResult.textContent = text;
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    setTimer(state.elapsedBeforePause + Date.now() - state.recordingStartedAt);
  }, 250);
}

function setTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  els.timer.textContent = `${minutes}:${seconds}`;
}

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function fileNameForMime(mimeType) {
  if (mimeType.includes("mp4")) return "recording.mp4";
  if (mimeType.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:.*?;base64,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function createId() {
  return `s${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
