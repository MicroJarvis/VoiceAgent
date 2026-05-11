const state = {
  mediaRecorder: null,
  chunks: [],
  audioBlob: null,
  audioMimeType: "audio/webm",
  recordingStartedAt: 0,
  elapsedBeforePause: 0,
  timerId: null,
  mediaStream: null,
  audioContext: null,
  audioSource: null,
  audioProcessor: null,
  audioSink: null,
  sherpaSocket: null,
  sherpaConnected: false,
  sherpaFinalizing: false,
  sherpaSessionId: 0,
  sherpaBaseTranscript: "",
  sherpaTranscript: "",
  sherpaSegments: [],
  sherpaStartedAt: 0,
  sherpaChunksSent: 0,
  sherpaMessagesReceived: 0,
  sherpaLastRawMessage: "",
  finalizingRecording: false,
  segments: [],
  clinicalAlerts: [],
  evidence: [],
  auditLog: [],
  report: null,
  reportText: "",
  toothFindings: [],
  documentMode: "report",
  patientSummaryText: "",
  referralLetterText: "",
  workflowStage: "needs-consent",
  recordingState: "idle",
  micLevel: 0,
  lastTranscribedAt: "",
  lastGeneratedAt: ""
};

const sherpaTargetSampleRate = 16000;
const upperTeeth = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const lowerTeeth = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
const allTeeth = [...upperTeeth, ...lowerTeeth];
const regionToTeeth = {
  右上前牙: ["13", "12", "11"],
  右上后牙: ["18", "17", "16", "15", "14"],
  左上前牙: ["21", "22", "23"],
  左上后牙: ["24", "25", "26", "27", "28"],
  右下前牙: ["43", "42", "41"],
  右下后牙: ["48", "47", "46", "45", "44"],
  左下前牙: ["31", "32", "33"],
  左下后牙: ["34", "35", "36", "37", "38"]
};

const els = {
  statusText: document.querySelector("#statusText"),
  saveCaseBtn: document.querySelector("#saveCaseBtn"),
  loadCaseBtn: document.querySelector("#loadCaseBtn"),
  encounterSummaryText: document.querySelector("#encounterSummaryText"),
  workflowStageBadge: document.querySelector("#workflowStageBadge"),
  workflowStepPatient: document.querySelector("#workflowStepPatient"),
  workflowStepRecord: document.querySelector("#workflowStepRecord"),
  workflowStepReview: document.querySelector("#workflowStepReview"),
  workflowConnectorRecord: document.querySelector("#workflowConnectorRecord"),
  workflowConnectorReview: document.querySelector("#workflowConnectorReview"),
  patientName: document.querySelector("#patientName"),
  patientId: document.querySelector("#patientId"),
  doctorName: document.querySelector("#doctorName"),
  visitDate: document.querySelector("#visitDate"),
  chiefNote: document.querySelector("#chiefNote"),
  medicalHistory: document.querySelector("#medicalHistory"),
  allergies: document.querySelector("#allergies"),
  medications: document.querySelector("#medications"),
  dentalHistory: document.querySelector("#dentalHistory"),
  examFindings: document.querySelector("#examFindings"),
  imagingFindings: document.querySelector("#imagingFindings"),
  diagnoses: document.querySelector("#diagnoses"),
  treatmentConsent: document.querySelector("#treatmentConsent"),
  followUp: document.querySelector("#followUp"),
  apiKey: document.querySelector("#apiKey"),
  baseUrl: document.querySelector("#baseUrl"),
  whisperCommand: document.querySelector("#whisperCommand"),
  transcriptionModel: document.querySelector("#transcriptionModel"),
  sherpaWsUrl: document.querySelector("#sherpaWsUrl"),
  reportModel: document.querySelector("#reportModel"),
  testResponsesBtn: document.querySelector("#testResponsesBtn"),
  testSherpaBtn: document.querySelector("#testSherpaBtn"),
  consent: document.querySelector("#consent"),
  privacyConfirmed: document.querySelector("#privacyConfirmed"),
  streamingEnabled: document.querySelector("#streamingEnabled"),
  rememberSettings: document.querySelector("#rememberSettings"),
  timer: document.querySelector("#timer"),
  recordingStateBadge: document.querySelector("#recordingStateBadge"),
  micState: document.querySelector("#micState"),
  sherpaState: document.querySelector("#sherpaState"),
  modelState: document.querySelector("#modelState"),
  micLevelBar: document.querySelector("#micLevelBar"),
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
  extractPerioBtn: document.querySelector("#extractPerioBtn"),
  perioChart: document.querySelector("#perioChart"),
  upperArch: document.querySelector("#upperArch"),
  lowerArch: document.querySelector("#lowerArch"),
  toothFindingSummary: document.querySelector("#toothFindingSummary"),
  generateReportBtn: document.querySelector("#generateReportBtn"),
  patientSummaryBtn: document.querySelector("#patientSummaryBtn"),
  referralLetterBtn: document.querySelector("#referralLetterBtn"),
  copyReportBtn: document.querySelector("#copyReportBtn"),
  printBtn: document.querySelector("#printBtn"),
  reportStageBadge: document.querySelector("#reportStageBadge"),
  reportDocTab: document.querySelector("#reportDocTab"),
  patientDocTab: document.querySelector("#patientDocTab"),
  referralDocTab: document.querySelector("#referralDocTab"),
  outputGateHint: document.querySelector("#outputGateHint"),
  transcriptReviewed: document.querySelector("#transcriptReviewed"),
  historyReviewed: document.querySelector("#historyReviewed"),
  planReviewed: document.querySelector("#planReviewed"),
  finalReviewed: document.querySelector("#finalReviewed"),
  riskPanel: document.querySelector("#riskPanel"),
  reportEditor: document.querySelector("#reportEditor"),
  evidencePanel: document.querySelector("#evidencePanel"),
  auditPanel: document.querySelector("#auditPanel"),
  setupPanel: document.querySelector(".setup-panel"),
  collapseToggle: document.querySelector(".collapse-toggle"),
  toothButtons: document.querySelectorAll("[data-tooth-token]"),
  templateButtons: document.querySelectorAll("[data-field-template]")
};

const clinicalInputs = [
  "patientName",
  "patientId",
  "doctorName",
  "visitDate",
  "chiefNote",
  "medicalHistory",
  "allergies",
  "medications",
  "dentalHistory",
  "examFindings",
  "imagingFindings",
  "diagnoses",
  "treatmentConsent",
  "followUp",
  "perioChart"
];

const reviewInputs = [
  "transcriptReviewed",
  "historyReviewed",
  "planReviewed",
  "finalReviewed"
];

init();

function init() {
  els.visitDate.valueAsDate = new Date();
  loadSettings();
  bindEvents();
  renderOdontogram();
  renderSegments();
  renderClinicalAlerts();
  updateToothFindings();
  renderEvidence();
  renderAuditLog();
  renderWorkflowState();
  renderDocumentMode();
  updateActionStates();
}

function bindEvents() {
  els.collapseToggle.addEventListener("click", toggleSetupPanel);
  els.startBtn.addEventListener("click", startRecording);
  els.pauseBtn.addEventListener("click", togglePause);
  els.stopBtn.addEventListener("click", stopRecording);
  els.transcribeBtn.addEventListener("click", transcribeRecording);
  els.addSegmentBtn.addEventListener("click", addManualSegment);
  els.segmentBtn.addEventListener("click", aiSegmentTranscript);
  els.extractPerioBtn.addEventListener("click", extractPerioChart);
  els.generateReportBtn.addEventListener("click", generateReport);
  els.patientSummaryBtn.addEventListener("click", () => buildDocumentDraft("patient"));
  els.referralLetterBtn.addEventListener("click", () => buildDocumentDraft("referral"));
  [els.reportDocTab, els.patientDocTab, els.referralDocTab].forEach((tab) => {
    tab.addEventListener("click", () => setDocumentMode(tab.dataset.documentMode));
  });
  els.testResponsesBtn.addEventListener("click", testResponsesEndpoint);
  els.testSherpaBtn.addEventListener("click", testSherpaConnection);
  els.copyReportBtn.addEventListener("click", copyReport);
  els.printBtn.addEventListener("click", printReport);
  els.saveCaseBtn.addEventListener("click", saveCase);
  els.loadCaseBtn.addEventListener("click", loadCase);
  els.reportEditor.addEventListener("input", () => {
    syncCurrentDocumentText();
    els.finalReviewed.checked = false;
    updateActionStates();
    renderWorkflowState();
  });
  els.rememberSettings.addEventListener("change", saveSettings);
  [els.whisperCommand, els.sherpaWsUrl, els.baseUrl, els.transcriptionModel, els.reportModel].forEach((input) => {
    input.addEventListener("change", () => {
      saveSettings();
      renderWorkflowState();
      updateActionStates();
    });
  });
  els.apiKey.addEventListener("change", () => {
    if (els.rememberSettings.checked) {
      setStatus("API Key 不会保存到本机浏览器", "busy");
    }
    renderWorkflowState();
    updateActionStates();
  });
  [els.consent, els.privacyConfirmed, els.streamingEnabled].forEach((input) => {
    input.addEventListener("change", () => {
      updateActionStates();
      renderWorkflowState();
    });
  });
  els.streamingEnabled.addEventListener("change", saveSettings);
  clinicalInputs.forEach((key) => {
    els[key].addEventListener("input", () => {
      invalidateReview(["historyReviewed", "planReviewed", "finalReviewed"]);
      renderClinicalAlerts();
      updateToothFindings();
      renderWorkflowState();
    });
  });
  reviewInputs.forEach((key) => {
    els[key].addEventListener("change", () => {
      addAuditEvent(`审核更新：${reviewLabel(key)}=${els[key].checked ? "是" : "否"}`);
      updateActionStates();
      renderWorkflowState();
    });
  });
  els.toothButtons.forEach((button) => {
    button.addEventListener("click", () => insertToothToken(button.dataset.toothToken));
  });
  els.templateButtons.forEach((button) => {
    button.addEventListener("click", () => applyFieldTemplate(button.dataset.fieldTemplate, button.dataset.templateText));
  });
}

function toggleSetupPanel() {
  const collapsed = els.setupPanel.classList.toggle("collapsed");
  els.collapseToggle.textContent = collapsed ? "展开设置" : "收起设置";
  els.collapseToggle.setAttribute("aria-expanded", String(!collapsed));
}

async function startRecording() {
  if (!els.consent.checked) {
    setStatus("请先确认录音授权", "error");
    renderWorkflowState();
    return;
  }

  if (!els.privacyConfirmed.checked) {
    setStatus("请先确认隐私要求", "error");
    renderWorkflowState();
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
    state.mediaStream = stream;
    state.recordingState = "recording";
    updateMicLevel(0);
    resetSherpaState();
    state.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        state.chunks.push(event.data);
      }
    });

    state.mediaRecorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
      state.audioBlob = new Blob(state.chunks, { type: state.audioMimeType });
      els.audioPreview.src = URL.createObjectURL(state.audioBlob);
      els.audioPreview.hidden = false;
      els.transcribeBtn.disabled = false;
      setRecorderNote(`录音已生成，大小 ${formatBytes(state.audioBlob.size)}，正在做最终转写、校对并生成报告草稿。`, "busy");
      setReportPlaceholder("录音已完成。正在最终转写、AI 校对并生成报告草稿...");
      updateActionStates();
      finalizeRecordingWorkflow();
    });

    state.mediaRecorder.start(1000);
    state.recordingStartedAt = Date.now();
    state.elapsedBeforePause = 0;
    startTimer();
    startSherpaStreaming(stream);
    els.startBtn.disabled = true;
    els.pauseBtn.disabled = false;
    els.stopBtn.disabled = false;
    els.transcribeBtn.disabled = true;
    invalidateReview();
    addAuditEvent("开始录音");
    setStatus(els.streamingEnabled.checked ? "录音中，实时转写" : "录音中", "busy");
    renderWorkflowState();
    setRecorderNote(
      els.streamingEnabled.checked
        ? "正在连接 sherpa-onnx 实时转写；结束后会用实时稿校对并生成报告草稿。"
        : "实时转写未启用；结束后将回退到本地 Whisper 完整转写。",
      "busy"
    );
  } catch (error) {
    state.recordingState = "error";
    setStatus(error.message || "无法开始录音", "error");
    renderWorkflowState();
  }
}

function togglePause() {
  if (!state.mediaRecorder) return;

  if (state.mediaRecorder.state === "recording") {
    state.mediaRecorder.pause();
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
    clearInterval(state.timerId);
    stopSherpaStreaming({ finish: true, commitTranscript: true });
    state.recordingState = "paused";
    updateMicLevel(0);
    els.pauseBtn.textContent = "继续";
    setStatus("已暂停");
    renderWorkflowState();
    return;
  }

  if (state.mediaRecorder.state === "paused") {
    state.mediaRecorder.resume();
    state.recordingStartedAt = Date.now();
    startTimer();
    if (els.streamingEnabled.checked) {
      startSherpaStreaming(state.mediaStream);
    }
    state.recordingState = "recording";
    els.pauseBtn.textContent = "暂停";
    setStatus(els.streamingEnabled.checked ? "录音中，实时转写" : "录音中", "busy");
    renderWorkflowState();
  }
}

function stopRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") return;
  if (state.mediaRecorder.state === "recording") {
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
  }
  stopSherpaStreaming({ finish: true });
  state.mediaRecorder.stop();
  clearInterval(state.timerId);
  state.recordingState = "processing";
  updateMicLevel(0);
  els.startBtn.disabled = false;
  els.pauseBtn.disabled = true;
  els.stopBtn.disabled = true;
  els.pauseBtn.textContent = "暂停";
  setTimer(state.elapsedBeforePause);
  setStatus("录音完成");
  addAuditEvent("结束录音");
  updateActionStates();
  renderWorkflowState();
}

function resetSherpaState() {
  state.audioContext = null;
  state.audioSource = null;
  state.audioProcessor = null;
  state.audioSink = null;
  state.sherpaSocket = null;
  state.sherpaConnected = false;
  state.sherpaFinalizing = false;
  state.sherpaSessionId += 1;
  state.sherpaBaseTranscript = "";
  state.sherpaTranscript = "";
  state.sherpaSegments = [];
  state.sherpaStartedAt = 0;
  state.sherpaChunksSent = 0;
  state.sherpaMessagesReceived = 0;
  state.sherpaLastRawMessage = "";
}

async function startSherpaStreaming(stream) {
  stopSherpaStreaming();
  if (!els.streamingEnabled.checked) return;

  if (!stream) {
    setRecorderNote("无法读取麦克风音频流，实时草稿已暂停。", "error");
    return;
  }

  const wsUrl = els.sherpaWsUrl.value.trim();
  if (!wsUrl) {
    setRecorderNote("未填写 sherpa WebSocket 地址，已回退到结束后本地转写。", "busy");
    return;
  }

  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audioContext.state === "suspended") {
      await state.audioContext.resume();
    }
    state.sherpaSessionId += 1;
    state.sherpaFinalizing = false;
    state.sherpaSocket = createSherpaSocket(wsUrl);
    state.audioSource = state.audioContext.createMediaStreamSource(stream);
    state.audioProcessor = createAudioWorkletNode(state.audioContext);
    state.audioSink = state.audioContext.createGain();
    state.audioSink.gain.value = 0;
    state.audioSource.connect(state.audioProcessor);
    state.audioProcessor.connect(state.audioSink);
    state.audioSink.connect(state.audioContext.destination);
    state.sherpaStartedAt = Date.now();
    addAuditEvent(`连接 sherpa 实时转写：${wsUrl}`);
    setRecorderNote(`正在连接 sherpa-onnx：${wsUrl}`, "busy");
    renderWorkflowState();
  } catch (error) {
    setRecorderNote(`sherpa 实时转写连接失败，已回退到结束后本地转写：${error.message}`, "error");
    stopSherpaStreaming();
    renderWorkflowState();
  }
}

function stopSherpaStreaming(options = {}) {
  const socket = state.sherpaSocket;
  if (options.commitTranscript) {
    state.sherpaBaseTranscript = state.sherpaTranscript;
  }
  if (options.finish && socket && socket.readyState === WebSocket.OPEN) {
    try {
      state.sherpaFinalizing = true;
      socket.sherpaFinalizing = true;
      socket.send("Done");
    } catch {}
  }
  try {
    state.audioProcessor?.disconnect();
  } catch {}
  try {
    state.audioSource?.disconnect();
  } catch {}
  try {
    state.audioSink?.disconnect();
  } catch {}
  if (socket && (!options.finish || socket.readyState === WebSocket.CONNECTING)) {
    try {
      socket.close();
    } catch {}
  }
  try {
    state.audioContext?.close();
  } catch {}
  state.audioContext = null;
  state.audioSource = null;
  state.audioProcessor = null;
  state.audioSink = null;
  state.sherpaSocket = null;
  state.sherpaConnected = false;
  updateMicLevel(0);
  renderWorkflowState();
}

async function transcribeRecording(options = {}) {
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
    setStatus(options.final ? "最终转写中" : "准备音频", "busy");
    setRecorderNote(`正在准备 ${formatBytes(state.audioBlob.size)} 的录音文件...`, "busy");
    const result = await transcribeBlob(state.audioBlob, settings, "final");
    state.segments = mergeFinalAndSherpaSegments(segmentsFromTranscriptionResult(result));
    state.lastTranscribedAt = new Date().toISOString();
    invalidateReview(["transcriptReviewed", "finalReviewed"]);
    renderSegments();
    renderClinicalAlerts();
    updateToothFindings();
    addAuditEvent(`完成本地转写：${state.segments.length} 条片段`);
    setStatus("转写完成");
    setRecorderNote(`转写完成，共生成 ${state.segments.length} 条初始文本片段。请核对文本、说话人和牙位后勾选医生审核关口。`);
    updateActionStates();
    return true;
  } catch (error) {
    if (options.final && state.sherpaSegments.length) {
      state.segments = state.sherpaSegments.map((segment) => ({ ...segment }));
      state.lastTranscribedAt = new Date().toISOString();
      invalidateReview(["transcriptReviewed", "finalReviewed"]);
      renderSegments();
      renderClinicalAlerts();
      updateToothFindings();
      addAuditEvent("本地 Whisper 最终转写失败，保留 sherpa 实时草稿");
      setStatus("已保留实时草稿", "error");
      setRecorderNote(`最终 Whisper 转写失败，已保留实时草稿，请修正设置后可手动重试：${error.message}`, "error");
      updateActionStates();
      return true;
    }
    setStatus(error.message, "error");
    setRecorderNote(error.message, "error");
    return false;
  } finally {
    els.transcribeBtn.disabled = false;
    updateActionStates();
  }
}

async function transcribeBlob(blob, settings, label) {
  setStatus(label === "final" ? "本机最终转写中" : "本机滚动转写中", "busy");
  const audioBase64 = await blobToBase64(blob);
  return postJson("/api/transcribe", {
    settings,
    audioBase64,
    mimeType: state.audioMimeType,
    fileName: fileNameForMime(state.audioMimeType, label),
    prompt: "口腔门诊医患对话，包含牙位、疼痛、龋齿、牙周、根管、拔牙、种植、正畸、过敏史、用药史等术语。"
  });
}

function segmentsFromTranscriptionResult(result) {
  if (Array.isArray(result.segments) && result.segments.length) {
    return result.segments;
  }
  if (result.text) {
    return [{
      id: createId(),
      speaker: "unknown",
      text: result.text,
      start: "",
      end: ""
    }];
  }
  return [];
}

function mergeFinalAndSherpaSegments(finalSegments) {
  const normalizedFinal = normalizeSegments(finalSegments);
  if (normalizedFinal.length) {
    return normalizedFinal;
  }
  return state.sherpaSegments.map((segment) => ({ ...segment }));
}

function normalizeSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      id: segment.id || createId(),
      speaker: segment.speaker || "unknown",
      text: String(segment.text || "").trim(),
      start: Number.isFinite(segment.start) ? segment.start : segment.start || "",
      end: Number.isFinite(segment.end) ? segment.end : segment.end || ""
    }))
    .filter((segment) => segment.text);
}

function createSherpaSocket(wsUrl) {
  const socket = new WebSocket(wsUrl);
  socket.binaryType = "arraybuffer";
  socket.sherpaSessionId = state.sherpaSessionId;
  socket.sherpaFinalizing = false;

  socket.addEventListener("open", () => {
    if (socket.sherpaSessionId !== state.sherpaSessionId) return;
    state.sherpaConnected = true;
    setStatus("录音中，实时转写已连接", "busy");
    setRecorderNote(`sherpa-onnx 已连接，正在发送 16kHz 音频流。若下方仍无文字，请确认模型服务正在返回识别结果。`, "busy");
    renderWorkflowState();
  });

  socket.addEventListener("message", (event) => {
    if (socket.sherpaSessionId !== state.sherpaSessionId) return;
    handleSherpaMessage(event.data);
  });

  socket.addEventListener("error", () => {
    if (socket.sherpaSessionId !== state.sherpaSessionId) return;
    if (state.sherpaStartedAt) {
      setRecorderNote(`sherpa 实时转写连接异常：请确认 ${els.sherpaWsUrl.value.trim()} 正在监听。录音仍会保存，结束后将使用本地 Whisper。`, "error");
    }
    renderWorkflowState();
  });

  socket.addEventListener("close", () => {
    if (socket.sherpaSessionId !== state.sherpaSessionId) return;
    state.sherpaConnected = false;
    if (socket.sherpaFinalizing || state.sherpaFinalizing) {
      state.sherpaFinalizing = false;
      return;
    }
    if (state.mediaRecorder?.state === "recording") {
      setRecorderNote(`sherpa 实时转写已断开。已发送 ${state.sherpaChunksSent} 个音频块，收到 ${state.sherpaMessagesReceived} 条消息。`, "error");
    }
    renderWorkflowState();
  });

  return socket;
}

function createAudioWorkletNode(audioContext) {
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  let carry = new Float32Array(0);

  processor.onaudioprocess = (event) => {
    const socket = state.sherpaSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const input = event.inputBuffer.getChannelData(0);
    updateMicLevel(rmsLevel(input));
    const resampled = downsampleFloat32(input, audioContext.sampleRate, sherpaTargetSampleRate);
    if (!resampled.length) return;

    const combined = new Float32Array(carry.length + resampled.length);
    combined.set(carry);
    combined.set(resampled, carry.length);

    const chunkSize = 1600;
    let offset = 0;
    while (offset + chunkSize <= combined.length) {
      socket.send(combined.slice(offset, offset + chunkSize).buffer);
      state.sherpaChunksSent += 1;
      offset += chunkSize;
    }
    carry = combined.slice(offset);
  };

  return processor;
}

function downsampleFloat32(input, inputRate, outputRate) {
  if (!input.length) return new Float32Array(0);
  if (!Number.isFinite(inputRate) || inputRate <= 0 || inputRate === outputRate) {
    return new Float32Array(input);
  }
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
      count += 1;
    }
    output[i] = count ? sum / count : input[start] || 0;
  }
  return output;
}

function rmsLevel(input) {
  if (!input?.length) return 0;
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    sum += input[i] * input[i];
  }
  return Math.min(1, Math.sqrt(sum / input.length) * 7);
}

function updateMicLevel(level) {
  state.micLevel = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  if (els.micLevelBar) {
    els.micLevelBar.style.width = `${Math.round(state.micLevel * 100)}%`;
  }
}

function handleSherpaMessage(data) {
  state.sherpaMessagesReceived += 1;
  state.sherpaLastRawMessage = stringifySherpaMessage(data);
  const payload = parseSherpaPayload(data);
  if (!payload) return;
  if (payload.done) {
    state.sherpaFinalizing = false;
    return;
  }

  const text = normalizeSherpaText(payload.text);
  if (!text) {
    setRecorderNote(`已收到 sherpa 消息，但没有解析到文本字段。最近消息：${state.sherpaLastRawMessage}`, "busy");
    return;
  }

  state.sherpaTranscript = joinSherpaText(state.sherpaBaseTranscript, text);
  const segment = {
    id: "sherpa-live",
    speaker: "unknown",
    text: state.sherpaTranscript,
    start: "",
    end: ""
  };
  state.sherpaSegments = [segment];
  state.segments = [segment];
  invalidateReview(["transcriptReviewed", "finalReviewed"]);
  renderSegments();
  renderClinicalAlerts();
  updateToothFindings();
  updateActionStates();
  setRecorderNote(`实时草稿已更新：已发送 ${state.sherpaChunksSent} 个音频块，收到 ${state.sherpaMessagesReceived} 条识别消息。`, "busy");
}

function parseSherpaPayload(data) {
  if (data === "Done!") {
    return { done: true };
  }
  if (typeof data !== "string") {
    return null;
  }
  const trimmed = data.trim();
  if (!trimmed || trimmed === "Done!") {
    return { done: true };
  }
  try {
    const parsed = JSON.parse(trimmed);
    return {
      text: extractSherpaText(parsed),
      raw: parsed
    };
  } catch {
    return { text: trimmed };
  }
}

function extractSherpaText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }

  const preferredKeys = [
    "text",
    "result",
    "transcript",
    "partial",
    "final",
    "sentence",
    "utterance",
    "hypothesis",
    "nbest",
    "tokens",
    "segment",
    "segments"
  ];

  for (const key of preferredKeys) {
    if (!(key in value)) continue;
    const extracted = extractSherpaText(value[key]);
    if (extracted) return extracted;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractSherpaText(item))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function stringifySherpaMessage(data) {
  if (typeof data === "string") {
    return data.length > 240 ? `${data.slice(0, 240)}...` : data;
  }
  if (data instanceof ArrayBuffer) {
    return `[binary ${data.byteLength} bytes]`;
  }
  return Object.prototype.toString.call(data);
}

function normalizeSherpaText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s*([，。！？；：、])\s*/g, "$1")
    .trim();
}

function joinSherpaText(previous, next) {
  const head = normalizeSherpaText(previous);
  const tail = normalizeSherpaText(next);
  if (!head) return tail;
  if (!tail) return head;
  if (tail.startsWith(head)) return tail;
  if (head.endsWith(tail)) return head;
  return `${head} ${tail}`.trim();
}

async function aiSegmentTranscript(options = {}) {
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
      if (!options.automatic) {
        invalidateReview(["transcriptReviewed", "finalReviewed"]);
      } else {
        els.transcriptReviewed.checked = false;
        els.finalReviewed.checked = false;
      }
      renderSegments();
      renderClinicalAlerts();
      updateToothFindings();
      addAuditEvent(options.automatic ? "结束后自动 AI 校对转写稿" : "AI 标注对话角色");
      setStatus(options.automatic ? "转写已自动校对" : "对话已整理，请复核");
      updateActionStates();
      return true;
    } else {
      setStatus("未返回有效分段", "error");
      return false;
    }
  } catch (error) {
    setStatus(error.message, "error");
    if (!options.automatic) {
      throw error;
    }
    return false;
  }
}

async function finalizeRecordingWorkflow() {
  state.finalizingRecording = true;
  try {
    await waitForSherpaFinal(1200);
    freezeSherpaDraft();
    const prepared = hasSherpaDraft() ? applySherpaDraftForFinalization() : await transcribeRecording({ final: true });
    if (!prepared) {
      setRecorderNote("没有可用转写稿，请检查 sherpa WebSocket 或 Whisper 设置后手动点击“转写录音”。", "error");
      return false;
    }

    await autoProofreadTranscript();
    await generateReport({ automatic: true, skipGate: true, autoDraft: true });
    return true;
  } finally {
    state.finalizingRecording = false;
  }
}

function hasSherpaDraft() {
  return state.sherpaSegments.some((segment) => String(segment.text || "").trim());
}

function freezeSherpaDraft() {
  state.sherpaSessionId += 1;
  state.sherpaConnected = false;
  state.sherpaFinalizing = false;
}

function applySherpaDraftForFinalization() {
  state.segments = state.sherpaSegments.map((segment) => ({ ...segment }));
  state.lastTranscribedAt = new Date().toISOString();
  invalidateReview(["transcriptReviewed", "finalReviewed"]);
  renderSegments();
  renderClinicalAlerts();
  updateToothFindings();
  addAuditEvent("使用 sherpa 实时草稿作为结束后校对输入");
  setStatus("实时草稿待校对", "busy");
  setRecorderNote("录音结束，正在用 sherpa 实时草稿做 AI 角色校对并生成报告草稿。", "busy");
  updateActionStates();
  return true;
}

function waitForSherpaFinal(timeoutMs) {
  if (!state.sherpaFinalizing) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (!state.sherpaFinalizing || Date.now() - startedAt >= timeoutMs) {
        state.sherpaFinalizing = false;
        clearInterval(timer);
        resolve();
      }
    }, 80);
  });
}

async function autoProofreadTranscript() {
  try {
    await aiSegmentTranscript({ automatic: true });
    addAuditEvent("结束后自动校对转写稿");
    return true;
  } catch (error) {
    setRecorderNote(`AI 校对失败，请手动检查转写：${error.message}`, "error");
    return false;
  }
}

async function generateReport(options = {}) {
  state.documentMode = "report";
  if (!state.segments.some((segment) => segment.text.trim())) {
    setStatus("没有对话内容", "error");
    return;
  }

  const gate = options.skipGate ? "" : reportGateMessage();
  if (gate) {
    setStatus(gate, "error");
    setRecorderNote(gate, "error");
    return false;
  }

  try {
    setStatus("生成报告中", "busy");
    const result = await postJson("/api/report", {
      settings: readChatSettings(),
      encounter: readEncounter(),
      review: options.autoDraft ? { ...readReviewState(), autoDraft: true } : readReviewState(),
      segments: state.segments
    });
    state.report = result.report;
    state.clinicalAlerts = Array.isArray(result.report?.clinicalAlerts) ? result.report.clinicalAlerts : [];
    state.evidence = Array.isArray(result.report?.evidenceTrace) ? result.report.evidenceTrace : [];
    state.lastGeneratedAt = new Date().toISOString();
    els.finalReviewed.checked = false;
    renderReport(state.report);
    renderClinicalAlerts();
    renderEvidence();
    addAuditEvent("生成结构化报告草稿");
    setStatus(options.automatic ? "自动草稿已生成" : "报告已生成");
    setRecorderNote("报告草稿已生成。请医生复核后勾选最终报告确认，再复制或打印。");
    updateActionStates();
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

function testSherpaConnection() {
  const wsUrl = els.sherpaWsUrl.value.trim();
  if (!wsUrl) {
    setStatus("请填写 Sherpa 实时 WS", "error");
    showApiTestResult("Sherpa WebSocket 地址为空。");
    return;
  }

  let socket;
  const timeoutMs = 3500;
  try {
    els.testSherpaBtn.disabled = true;
    setStatus("测试实时连接中", "busy");
    showApiTestResult(`正在连接 ${wsUrl} ...`);
    socket = new WebSocket(wsUrl);
  } catch (error) {
    els.testSherpaBtn.disabled = false;
    setStatus("实时连接失败", "error");
    showApiTestResult(error.message);
    return;
  }

  const timer = setTimeout(() => {
    try {
      socket.close();
    } catch {}
    els.testSherpaBtn.disabled = false;
    setStatus("实时连接超时", "error");
    showApiTestResult(`连接 ${wsUrl} 超时。请确认 sherpa-onnx WebSocket 服务已启动并监听该端口。`);
  }, timeoutMs);

  socket.addEventListener("open", () => {
    clearTimeout(timer);
    els.testSherpaBtn.disabled = false;
    setStatus("实时连接通过");
    showApiTestResult(`Sherpa WebSocket 已连接：${wsUrl}\n录音时页面会发送 16kHz float32 PCM；如果仍无文字，请查看 sherpa 服务端日志是否收到音频并返回文本。`);
    socket.close();
  });

  socket.addEventListener("error", () => {
    clearTimeout(timer);
    els.testSherpaBtn.disabled = false;
    setStatus("实时连接失败", "error");
    showApiTestResult(`无法连接 ${wsUrl}。\n常见原因：sherpa-onnx 服务未启动、端口不是 6006、浏览器页面不是 localhost、或 WebSocket 地址填错。`);
  });
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
  invalidateReview(["transcriptReviewed", "finalReviewed"]);
  renderSegments();
  renderClinicalAlerts();
  updateToothFindings();
  addAuditEvent("手动新增对话片段");
  updateActionStates();
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
    const insights = node.querySelector(".segment-insights");

    speaker.value = segment.speaker || "unknown";
    text.value = segment.text || "";
    renderSegmentInsights(node, insights, segment);

    speaker.addEventListener("change", () => {
      state.segments[index].speaker = speaker.value;
      invalidateReview(["transcriptReviewed", "finalReviewed"]);
      renderClinicalAlerts();
      updateToothFindings();
      addAuditEvent(`修改片段 ${index + 1} 说话人`);
      updateActionStates();
    });
    text.addEventListener("input", () => {
      state.segments[index].text = text.value;
      invalidateReview(["transcriptReviewed", "finalReviewed"]);
      renderClinicalAlerts();
      updateToothFindings();
      updateActionStates();
    });
    text.addEventListener("change", () => {
      addAuditEvent(`修改片段 ${index + 1} 文本`);
    });
    deleteBtn.addEventListener("click", () => {
      state.segments.splice(index, 1);
      invalidateReview(["transcriptReviewed", "finalReviewed"]);
      renderSegments();
      renderClinicalAlerts();
      updateToothFindings();
      addAuditEvent(`删除片段 ${index + 1}`);
      updateActionStates();
    });

    els.segments.append(node);
  });
}

function renderSegmentInsights(node, container, segment) {
  if (!container) return;
  const insights = segmentInsights(segment.text || "");
  node.classList.toggle("has-warning", insights.some((item) => item.type === "warning"));
  node.classList.toggle("has-tooth", insights.some((item) => item.type === "tooth"));
  container.innerHTML = insights
    .map((item) => `<span class="insight-chip ${item.type === "warning" ? "warning" : ""}">${escapeHtml(item.label)}</span>`)
    .join("");
}

function segmentInsights(text) {
  return [
    ...extractToothMentions(text).map((label) => ({ type: "tooth", label: `牙位：${label}` })),
    ...extractRiskMentions(text).map((label) => ({ type: "warning", label }))
  ].slice(0, 8);
}

function extractToothMentions(text) {
  return unique(extractDentalFindings(text).flatMap((finding) => finding.teeth.length ? finding.teeth : [finding.region])).slice(0, 5);
}

function extractRiskMentions(text) {
  const value = String(text || "");
  const patterns = [
    [/过敏|青霉素|头孢|麻药|利多卡因/, "过敏/麻药风险"],
    [/抗凝|阿司匹林|华法林|氯吡格雷|利伐沙班/, "抗凝用药"],
    [/糖尿病|血糖/, "糖尿病"],
    [/高血压|血压/, "高血压"],
    [/妊娠|怀孕|哺乳/, "妊娠/哺乳"],
    [/拔牙|种植|翻瓣|植骨|骨粉|根管|开髓|麻醉|处方|抗生素|止痛药/, "高风险治疗"]
  ];
  return patterns.filter(([pattern]) => pattern.test(value)).map(([, label]) => label);
}

function insertToothToken(token) {
  const target = els.examFindings.value.trim() ? els.examFindings : els.chiefNote;
  const prefix = target.value.trim();
  target.value = [prefix, token].filter(Boolean).join(prefix ? "；" : "");
  target.focus();
  invalidateReview(["historyReviewed", "planReviewed", "finalReviewed"]);
  renderClinicalAlerts();
  updateToothFindings();
  renderWorkflowState();
  addAuditEvent(`插入牙位快捷：${token}`);
}

function applyFieldTemplate(field, text) {
  const input = els[field];
  if (!input || !text) return;
  const existing = input.value.trim();
  input.value = [existing, text].filter(Boolean).join(existing ? "\n" : "");
  input.focus();
  invalidateReview(["historyReviewed", "planReviewed", "finalReviewed"]);
  renderClinicalAlerts();
  updateToothFindings();
  renderWorkflowState();
  addAuditEvent(`插入临床速记：${field}`);
}

function renderOdontogram() {
  renderArch(els.upperArch, upperTeeth, "upper");
  renderArch(els.lowerArch, lowerTeeth, "lower");
}

function renderArch(parent, teeth, arch) {
  parent.innerHTML = "";
  teeth.forEach((toothId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tooth ${arch}`;
    button.dataset.tooth = toothId;
    button.setAttribute("aria-label", `${toothId} 牙`);
    button.innerHTML = [
      `<span class="tooth-number">${toothId}</span>`,
      '<span class="tooth-finding"></span>'
    ].join("");
    button.addEventListener("click", () => insertToothToken(toothId));
    parent.append(button);
  });
}

function updateToothFindings() {
  state.toothFindings = extractDentalFindings(buildDentalFindingSource());
  const byTooth = new Map();
  const scoped = [];
  state.toothFindings.forEach((finding) => {
    if (finding.teeth.length) {
      finding.teeth.forEach((toothId) => {
        byTooth.set(toothId, mergeToothFinding(byTooth.get(toothId), finding));
      });
    } else if (finding.scopeTeeth.length) {
      scoped.push(finding);
      finding.scopeTeeth.forEach((toothId) => {
        byTooth.set(toothId, mergeToothFinding(byTooth.get(toothId), finding));
      });
    }
  });

  document.querySelectorAll(".tooth[data-tooth]").forEach((node) => {
    const toothId = node.dataset.tooth;
    const finding = byTooth.get(toothId);
    const findingLabel = node.querySelector(".tooth-finding");
    node.classList.toggle("active", Boolean(finding?.exact));
    node.classList.toggle("scope", Boolean(finding && !finding.exact));
    node.classList.toggle("has-risk", Boolean(finding?.risk));
    findingLabel.textContent = finding ? compactFindingLabel(finding) : "";
    node.title = finding ? toothTitle(toothId, finding) : `${toothId} 牙`;
  });

  renderToothFindingSummary(scoped);
}

function buildDentalFindingSource() {
  const encounter = readEncounter();
  const transcript = state.segments
    .map((segment) => `${speakerLabel(segment.speaker)}：${segment.text}`)
    .join("\n");
  return [
    encounter.chiefNote,
    encounter.examFindings,
    encounter.perioChart,
    encounter.imagingFindings,
    encounter.diagnoses,
    encounter.treatmentConsent,
    encounter.followUp,
    transcript
  ].filter(Boolean).join("\n");
}

function extractDentalFindings(text) {
  const sentences = splitClinicalSentences(text);
  const findings = [];
  sentences.forEach((sentence) => {
    const teeth = extractExactTeeth(sentence);
    const regions = extractToothRegions(sentence);
    const symptoms = extractDentalSymptoms(sentence);
    const risk = extractRiskMentions(sentence).length > 0;
    teeth.forEach((toothId) => {
      findings.push({
        teeth: [toothId],
        scopeTeeth: [],
        region: "",
        symptoms,
        sourceText: sentence,
        exact: true,
        risk
      });
    });
    if (!teeth.length) {
      regions.forEach((region) => {
        findings.push({
          teeth: [],
          scopeTeeth: regionToTeeth[region] || [],
          region,
          symptoms,
          sourceText: sentence,
          exact: false,
          risk
        });
      });
    }
  });
  return findings.filter((finding) => finding.teeth.length || finding.scopeTeeth.length);
}

function splitClinicalSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;])\s*|[\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractExactTeeth(sentence) {
  const value = normalizeDentalText(sentence);
  const found = [];
  const fdiPattern = /(?<![\dA-Za-z])([1-4][1-8])(?![\dA-Za-z岁年月日号楼室层])/g;
  let fdiMatch;
  while ((fdiMatch = fdiPattern.exec(value))) {
    const toothId = fdiMatch[1];
    if (allTeeth.includes(toothId) && (hasDentalContext(value, fdiMatch.index) || isStandaloneToothMention(value, toothId))) {
      found.push(toothId);
    }
  }

  const spokenPattern = /(右上|左上|右下|左下)(?:第)?([一二三四五六七八1-8])(?:号|颗|的)?(?:牙|磨牙|前磨牙|前牙|后牙|智齿)?/g;
  let match;
  while ((match = spokenPattern.exec(value))) {
    const toothId = spokenToothToFdi(match[1], match[2]);
    if (toothId) found.push(toothId);
  }

  return unique(found);
}

function extractToothRegions(sentence) {
  const value = normalizeDentalText(sentence);
  const found = [];
  const regionPattern = /(右上|左上|右下|左下)(前牙|后牙|磨牙|智齿|牙区|牙)/g;
  let match;
  while ((match = regionPattern.exec(value))) {
    const region = normalizeRegion(match[1], match[2]);
    if (region) found.push(region);
  }
  return unique(found);
}

function hasDentalContext(text, index) {
  const windowText = text.slice(Math.max(0, index - 12), index + 18);
  return /牙|齿|龋|蛀|痛|疼|酸|胀|冠|根管|拔|种植|牙周|探诊|松动|叩|冷热|智齿|近中|远中|颊|舌|腭|唇|BOP|PD|mm|毫米/.test(windowText);
}

function isStandaloneToothMention(text, toothId) {
  return new RegExp(`(^|[，,、；;\\s])${toothId}($|[，,、；;\\s])`).test(text);
}

function extractDentalSymptoms(sentence) {
  const value = normalizeDentalText(sentence);
  const symptoms = [
    [/疼|痛|酸|胀|咬合痛|冷热痛|自发痛|夜间痛/, "疼痛"],
    [/龋|蛀|洞|缺损|崩|裂/, "龋/缺损"],
    [/牙龈|出血|BOP|探诊|牙周|牙袋|袋|附着|龈退缩/, "牙周"],
    [/松动|动度/, "松动"],
    [/肿|脓|瘘|炎|感染/, "炎症"],
    [/根管|开髓|牙髓/, "根管"],
    [/拔牙|拔除/, "拔牙"],
    [/种植|植骨|骨粉/, "种植"],
    [/阻生|智齿/, "智齿"],
    [/修复|冠|嵌体|补牙|充填/, "修复"]
  ];
  const labels = symptoms.filter(([pattern]) => pattern.test(value)).map(([, label]) => label);
  return labels.length ? unique(labels) : ["待确认"];
}

function normalizeDentalText(text) {
  return String(text || "")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim();
}

function spokenToothToFdi(quadrantText, toothText) {
  const quadrant = { 右上: "1", 左上: "2", 左下: "3", 右下: "4" }[quadrantText];
  const index = chineseNumberToDigit(toothText);
  const toothId = quadrant && index ? `${quadrant}${index}` : "";
  return allTeeth.includes(toothId) ? toothId : "";
}

function chineseNumberToDigit(value) {
  return {
    一: "1",
    二: "2",
    三: "3",
    四: "4",
    五: "5",
    六: "6",
    七: "7",
    八: "8",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8"
  }[String(value || "")] || "";
}

function normalizeRegion(quadrant, type) {
  if (type === "前牙") return `${quadrant}前牙`;
  if (type === "后牙" || type === "磨牙" || type === "智齿") return `${quadrant}后牙`;
  if (type === "牙区" || type === "牙") return `${quadrant}后牙`;
  return "";
}

function mergeToothFinding(existing, next) {
  if (!existing) {
    return {
      exact: next.exact,
      risk: next.risk,
      symptoms: [...next.symptoms],
      sources: [next.sourceText],
      region: next.region
    };
  }
  return {
    exact: existing.exact || next.exact,
    risk: existing.risk || next.risk,
    symptoms: unique([...existing.symptoms, ...next.symptoms]),
    sources: unique([...existing.sources, next.sourceText]).slice(0, 4),
    region: existing.region || next.region
  };
}

function compactFindingLabel(finding) {
  return finding.symptoms.filter((label) => label !== "待确认").slice(0, 1)[0] || "待确认";
}

function toothTitle(toothId, finding) {
  return [
    `${toothId} 牙`,
    finding.exact ? "明确提及" : `范围提及：${finding.region || "待确认区域"}`,
    `症状：${finding.symptoms.join("、")}`,
    finding.sources[0] && `依据：${finding.sources[0]}`
  ].filter(Boolean).join("\n");
}

function renderToothFindingSummary(scoped) {
  const exactItems = state.toothFindings
    .filter((finding) => finding.teeth.length)
    .flatMap((finding) => finding.teeth.map((toothId) => `${toothId}：${finding.symptoms.join("、")}`));
  const scopeItems = scoped.map((finding) => `${finding.region}：${finding.symptoms.join("、")}（范围待确认）`);
  const items = unique([...exactItems, ...scopeItems]).slice(0, 8);
  els.toothFindingSummary.textContent = items.length ? items.join("；") : "尚未识别到明确牙位。";
}

function renderReport(report) {
  state.reportText = formatReportText(report);
  state.documentMode = "report";
  renderDocumentMode();
}

function setDocumentMode(mode) {
  syncCurrentDocumentText();
  state.documentMode = ["report", "patient", "referral"].includes(mode) ? mode : "report";
  renderDocumentMode();
  updateActionStates();
  renderWorkflowState();
}

function syncCurrentDocumentText() {
  const text = els.reportEditor.value;
  if (state.documentMode === "patient") {
    state.patientSummaryText = text;
  } else if (state.documentMode === "referral") {
    state.referralLetterText = text;
  } else {
    state.reportText = text;
  }
}

function renderDocumentMode() {
  const mode = state.documentMode || "report";
  const tabs = [els.reportDocTab, els.patientDocTab, els.referralDocTab];
  tabs.forEach((tab) => {
    const active = tab.dataset.documentMode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (mode === "patient") {
    els.reportEditor.value = state.patientSummaryText || "";
    els.reportEditor.placeholder = "患者说明尚未生成。完成最终审核后点击“患者说明”。";
  } else if (mode === "referral") {
    els.reportEditor.value = state.referralLetterText || "";
    els.reportEditor.placeholder = "转诊信尚未生成。完成最终审核后点击“转诊信”。";
  } else {
    els.reportEditor.value = state.reportText || "";
    els.reportEditor.placeholder = "录音结束后会自动生成报告草稿；也可以在医生核对后手动点击「生成报告」。\n\n报告内容仅供参考，最终诊断和治疗方案需由医生确认。";
  }
}

function extractPerioChart() {
  const text = state.segments.map((segment) => segment.text).join("\n");
  if (!text.trim() && !els.examFindings.value.trim()) {
    setStatus("没有可摘录的检查内容", "error");
    return;
  }
  const lines = extractPerioLines(`${els.examFindings.value}\n${text}`);
  if (!lines.length) {
    setStatus("未找到牙周或检查指标", "error");
    return;
  }
  const existing = els.perioChart.value.trim();
  els.perioChart.value = [existing, ...lines].filter(Boolean).join(existing ? "\n" : "");
  invalidateReview(["historyReviewed", "planReviewed", "finalReviewed"]);
  renderClinicalAlerts();
  updateToothFindings();
  addAuditEvent(`摘录牙周/检查指标：${lines.length} 条`);
  setStatus("已摘录检查指标");
}

function buildDocumentDraft(type) {
  const gate = finalReportGateMessage();
  if (gate) {
    setStatus(gate, "error");
    renderWorkflowState();
    return;
  }
  const text = type === "referral" ? formatReferralLetter() : formatPatientSummary();
  if (type === "referral") {
    state.referralLetterText = text;
    setDocumentMode("referral");
  } else {
    state.patientSummaryText = text;
    setDocumentMode("patient");
  }
  addAuditEvent(type === "referral" ? "生成转诊信草稿" : "生成患者说明草稿");
  updateActionStates();
  renderWorkflowState();
  setStatus(type === "referral" ? "转诊信草稿已生成" : "患者说明草稿已生成");
}

function reportHeader() {
  const encounter = readEncounter();
  return [
    encounter.patientName && `患者：${encounter.patientName}`,
    encounter.patientId && `编号：${encounter.patientId}`,
    encounter.doctorName && `医生：${encounter.doctorName}`,
    encounter.visitDate && `日期：${encounter.visitDate}`
  ].filter(Boolean).join("  ");
}

async function copyReport() {
  syncCurrentDocumentText();
  const text = els.reportEditor.value.trim();
  if (!text) {
    setStatus("没有可复制的报告", "error");
    return;
  }
  const gate = finalOutputGateMessage();
  if (gate) {
    setStatus(gate, "error");
    return;
  }
  await navigator.clipboard.writeText(text);
  addAuditEvent("复制最终文档");
  setStatus("已复制");
}

function printReport() {
  syncCurrentDocumentText();
  const gate = finalOutputGateMessage();
  if (gate) {
    setStatus(gate, "error");
    return;
  }
  addAuditEvent("打印最终文档");
  window.print();
}

function setReportPlaceholder(text) {
  els.reportEditor.value = text;
  state.reportText = text;
}

function saveCase() {
  syncCurrentDocumentText();
  localStorage.setItem("dentalVoiceAgent.case", JSON.stringify({
    encounter: readEncounter(),
    review: readReviewState(),
    segments: state.segments,
    clinicalAlerts: state.clinicalAlerts,
    evidence: state.evidence,
    auditLog: state.auditLog,
    report: state.report,
    reportText: state.reportText,
    canonicalReportText: state.reportText,
    documentMode: state.documentMode,
    patientSummaryText: state.patientSummaryText,
    referralLetterText: state.referralLetterText,
    lastTranscribedAt: state.lastTranscribedAt,
    lastGeneratedAt: state.lastGeneratedAt,
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
    writeReviewState(saved.review || {});
    state.segments = Array.isArray(saved.segments) ? saved.segments : [];
    state.clinicalAlerts = Array.isArray(saved.clinicalAlerts) ? saved.clinicalAlerts : [];
    state.evidence = Array.isArray(saved.evidence) ? saved.evidence : [];
    state.auditLog = Array.isArray(saved.auditLog) ? saved.auditLog : [];
    state.report = saved.report || null;
    state.reportText = saved.canonicalReportText || saved.reportText || "";
    state.documentMode = saved.documentMode || "report";
    state.patientSummaryText = saved.patientSummaryText || "";
    state.referralLetterText = saved.referralLetterText || "";
    state.lastTranscribedAt = saved.lastTranscribedAt || "";
    state.lastGeneratedAt = saved.lastGeneratedAt || "";
    renderSegments();
    renderClinicalAlerts();
    updateToothFindings();
    renderEvidence();
    renderAuditLog();
    if (state.report) {
      if (!state.reportText) {
        state.reportText = formatReportText(state.report);
      }
      renderDocumentMode();
    } else if (state.reportText) {
      renderDocumentMode();
    }
    updateActionStates();
    renderWorkflowState();
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
    apiKey: "",
    baseUrl: els.baseUrl.value,
    whisperCommand: els.whisperCommand.value,
    transcriptionModel: els.transcriptionModel.value,
    sherpaWsUrl: els.sherpaWsUrl.value,
    streamingEnabled: els.streamingEnabled.checked,
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
    els.apiKey.value = "";
    els.baseUrl.value = settings.baseUrl || "https://api.openai.com/v1";
    els.whisperCommand.value = settings.whisperCommand || "whisper";
    els.sherpaWsUrl.value = settings.sherpaWsUrl || "ws://localhost:6006";
    els.streamingEnabled.checked = settings.streamingEnabled !== false;
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
    patientId: els.patientId.value.trim(),
    doctorName: els.doctorName.value.trim(),
    visitDate: els.visitDate.value,
    chiefNote: els.chiefNote.value.trim(),
    medicalHistory: els.medicalHistory.value.trim(),
    allergies: els.allergies.value.trim(),
    medications: els.medications.value.trim(),
    dentalHistory: els.dentalHistory.value.trim(),
    examFindings: els.examFindings.value.trim(),
    perioChart: els.perioChart.value.trim(),
    imagingFindings: els.imagingFindings.value.trim(),
    diagnoses: els.diagnoses.value.trim(),
    treatmentConsent: els.treatmentConsent.value.trim(),
    followUp: els.followUp.value.trim(),
    consentConfirmed: els.consent.checked,
    privacyConfirmed: els.privacyConfirmed.checked
  };
}

function readReviewState() {
  return {
    transcriptReviewed: els.transcriptReviewed.checked,
    historyReviewed: els.historyReviewed.checked,
    planReviewed: els.planReviewed.checked,
    finalReviewed: els.finalReviewed.checked,
    reviewedAt: els.finalReviewed.checked ? new Date().toISOString() : ""
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
    "状态：AI 草稿，未签署前不得作为最终病历。",
    "",
    sectionText("主诉情况", report.chiefComplaintSummary || plainField(report.chiefComplaint)),
    sectionText("病史与风险", formatHistoryAndRisk(report)),
    sectionText("口腔检查与影像", formatExamAndImaging(report)),
    sectionText("诊断/问题清单", formatDiagnosisList(report.diagnoses || report.assessment)),
    sectionText("接诊分析", report.visitAnalysis || buildLegacyAnalysis(report)),
    sectionText("治疗方案", formatTreatmentPlan(report.treatmentPlan)),
    sectionText("知情同意", report.informedConsent || ""),
    sectionText("术后医嘱/复诊", report.followUp || ""),
    sectionText("待医生补充/确认", formatOpenItems(report.openItems)),
    "",
    "医生确认：",
    "签署时间："
  ];

  return lines.filter((line) => line !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function formatHistoryAndRisk(report) {
  const value = report.historyAndRisk || {};
  return [
    value.medicalHistory && `全身病史：${value.medicalHistory}`,
    value.allergies && `过敏史：${value.allergies}`,
    value.medications && `用药史：${value.medications}`,
    value.dentalHistory && `牙科既往史：${value.dentalHistory}`,
    value.riskNotes && `风险提示：${value.riskNotes}`
  ].filter(Boolean).join("\n");
}

function formatExamAndImaging(report) {
  return [
    plainField(report.oralExam || report.examFindings),
    plainField(report.perioChart || readEncounter().perioChart),
    plainField(report.imagingFindings)
  ].filter(Boolean).join("\n");
}

function formatDiagnosisList(items) {
  if (typeof items === "string") return items;
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      return item.name || item.diagnosisOrProblem || "";
    })
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
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
      const evidence = typeof item === "object" && Array.isArray(item.evidenceSegmentIds) && item.evidenceSegmentIds.length
        ? `（依据：${item.evidenceSegmentIds.join(", ")}）`
        : "";
      if (source === "ai" && !text.startsWith("[AI]")) {
        return `[AI] ${text}${evidence}`;
      }
      return `${text}${evidence}`;
    })
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function formatOpenItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return "无";
  }
  return items
    .map((item) => String(item || "").trim())
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

function invalidateReview(keys = reviewInputs) {
  keys.forEach((key) => {
    els[key].checked = false;
  });
  updateActionStates();
}

function reportGateMessage() {
  if (!els.consent.checked) return "请先确认患者录音和 AI 辅助整理授权";
  if (!els.privacyConfirmed.checked) return "请先确认隐私和数据留存要求";
  if (!els.transcriptReviewed.checked) return "请先核对转写文本、说话人和牙位";
  if (!els.historyReviewed.checked) return "请先核对病史、过敏史、用药史和禁忌证";
  if (!els.planReviewed.checked) return "请先核对诊断、治疗方案、风险替代方案和复诊医嘱";
  return "";
}

function currentDocumentText() {
  if (state.documentMode === "patient") return state.patientSummaryText;
  if (state.documentMode === "referral") return state.referralLetterText;
  return state.reportText;
}

function finalReportGateMessage() {
  if (!state.reportText.trim()) return "没有可输出的报告";
  if (reportGateMessage()) return reportGateMessage();
  if (!els.finalReviewed.checked) return "请先完成最终报告医生审核";
  return "";
}

function finalOutputGateMessage() {
  if (finalReportGateMessage()) return finalReportGateMessage();
  if (!currentDocumentText().trim()) return "当前文档尚未生成";
  return "";
}

function updateActionStates() {
  syncCurrentDocumentText();
  const hasSegments = state.segments.some((segment) => String(segment.text || "").trim());
  const canGenerate = hasSegments && !reportGateMessage();
  const canDerive = !finalReportGateMessage();
  const canOutput = canDerive && Boolean(currentDocumentText().trim());
  els.generateReportBtn.disabled = !canGenerate;
  els.patientSummaryBtn.disabled = !canDerive;
  els.referralLetterBtn.disabled = !canDerive;
  els.copyReportBtn.disabled = !canOutput;
  els.printBtn.disabled = !canOutput;
  renderWorkflowState();
}

function renderWorkflowState() {
  const stage = computeWorkflowStage();
  state.workflowStage = stage.key;
  renderEncounterSummary();
  renderWorkflowSteps(stage);
  renderRecordingState(stage);
  renderReportStage(stage);
  renderOutputGateHint();
}

function computeWorkflowStage() {
  if (!els.consent.checked || !els.privacyConfirmed.checked) {
    return { key: "needs-consent", label: "待确认授权", tone: "pending", activeStep: "patient" };
  }
  if (state.mediaRecorder?.state === "recording" || state.recordingState === "recording") {
    return { key: "recording", label: "录音中", tone: "active", activeStep: "record" };
  }
  if (state.mediaRecorder?.state === "paused" || state.recordingState === "paused") {
    return { key: "paused", label: "已暂停", tone: "active", activeStep: "record" };
  }
  if (state.finalizingRecording || state.recordingState === "processing") {
    return { key: "processing", label: "整理中", tone: "active", activeStep: "record" };
  }
  const hasSegments = state.segments.some((segment) => String(segment.text || "").trim());
  if (!hasSegments) {
    return { key: "ready-record", label: "可开始录音", tone: "ready", activeStep: "record" };
  }
  if (!els.transcriptReviewed.checked) {
    return { key: "review-transcript", label: "待核对转写", tone: "active", activeStep: "review" };
  }
  if (!els.historyReviewed.checked || !els.planReviewed.checked) {
    return { key: "review-clinical", label: "待临床审核", tone: "active", activeStep: "review" };
  }
  if (!state.reportText.trim()) {
    return { key: "ready-report", label: "可生成报告", tone: "ready", activeStep: "review" };
  }
  if (!els.finalReviewed.checked) {
    return { key: "final-review", label: "待最终审核", tone: "active", activeStep: "review" };
  }
  return { key: "done", label: "可输出", tone: "done", activeStep: "review" };
}

function renderEncounterSummary() {
  const patient = els.patientName.value.trim() || "未命名患者";
  const patientId = els.patientId.value.trim();
  const chief = els.chiefNote.value.trim();
  const date = els.visitDate.value;
  const pieces = [
    patient,
    patientId && `编号 ${patientId}`,
    date,
    chief && `主诉：${chief}`
  ].filter(Boolean);
  els.encounterSummaryText.textContent = pieces.length ? pieces.join(" · ") : "未填写患者信息";
}

function renderWorkflowSteps(stage) {
  const order = ["patient", "record", "review"];
  const activeIndex = order.indexOf(stage.activeStep);
  [
    [els.workflowStepPatient, "patient"],
    [els.workflowStepRecord, "record"],
    [els.workflowStepReview, "review"]
  ].forEach(([node, key]) => {
    const index = order.indexOf(key);
    node.classList.toggle("active", key === stage.activeStep);
    node.classList.toggle("completed", index < activeIndex || stage.key === "done");
  });
  els.workflowConnectorRecord.classList.toggle("completed", activeIndex > 0 || stage.key === "done");
  els.workflowConnectorReview.classList.toggle("completed", activeIndex > 1 || stage.key === "done");
  els.workflowStageBadge.textContent = stage.label;
  els.workflowStageBadge.className = `stage-badge ${stage.tone}`;
}

function renderRecordingState(stage) {
  const stateMeta = recordingStateMeta(stage);
  els.recordingStateBadge.textContent = stateMeta.label;
  els.recordingStateBadge.className = `state-badge ${stateMeta.tone}`;
  els.micState.textContent = state.mediaStream
    ? `麦克风已连接 · 信号 ${Math.round(state.micLevel * 100)}%`
    : els.consent.checked && els.privacyConfirmed.checked
      ? "麦克风待开始"
      : "麦克风待授权";
  if (!els.streamingEnabled.checked) {
    els.sherpaState.textContent = "实时转写已关闭";
  } else if (state.sherpaConnected) {
    els.sherpaState.textContent = `实时转写已连接 · ${state.sherpaMessagesReceived} 条`;
  } else if (state.mediaRecorder?.state === "recording") {
    els.sherpaState.textContent = "实时转写连接中/已断开";
  } else {
    els.sherpaState.textContent = "实时转写待连接";
  }
  els.modelState.textContent = els.apiKey.value.trim()
    ? `整理接口已配置 · ${els.reportModel.value.trim() || "未填模型"}`
    : "整理接口未配置";
}

function recordingStateMeta(stage) {
  if (stage.key === "recording") return { label: "正在录音", tone: "recording" };
  if (stage.key === "paused") return { label: "已暂停", tone: "processing" };
  if (stage.key === "processing") return { label: "正在整理", tone: "processing" };
  if (stage.key === "done") return { label: "已完成", tone: "done" };
  if (stage.key.startsWith("review") || stage.key === "final-review" || stage.key === "ready-report") {
    return { label: "待审核", tone: "ready" };
  }
  if (stage.key === "needs-consent") return { label: "待授权", tone: "idle" };
  return { label: "待录音", tone: "idle" };
}

function renderReportStage(stage) {
  if (!state.reportText.trim()) {
    els.reportStageBadge.textContent = "未生成";
    els.reportStageBadge.className = "stage-badge muted";
    return;
  }
  if (!els.finalReviewed.checked) {
    els.reportStageBadge.textContent = stage.key === "processing" ? "自动草稿中" : "AI 草稿待审";
    els.reportStageBadge.className = "stage-badge active";
    return;
  }
  els.reportStageBadge.textContent = "医生已审核";
  els.reportStageBadge.className = "stage-badge done";
}

function renderOutputGateHint() {
  if (!state.reportText.trim()) {
    els.outputGateHint.textContent = "报告生成后会在这里显示输出条件。";
    els.outputGateHint.className = "gate-hint";
    return;
  }
  const reportGate = finalReportGateMessage();
  if (reportGate) {
    els.outputGateHint.textContent = `暂不能派生或输出：${reportGate}`;
    els.outputGateHint.className = "gate-hint blocked";
    return;
  }
  const gate = finalOutputGateMessage();
  if (gate) {
    els.outputGateHint.textContent = `当前标签暂不能输出：${gate}`;
    els.outputGateHint.className = "gate-hint blocked";
    return;
  }
  els.outputGateHint.textContent = "最终报告已通过医生审核，可以复制、打印或派生患者说明/转诊信。";
  els.outputGateHint.className = "gate-hint ready";
}

function renderClinicalAlerts() {
  if (!els.riskPanel) return;
  const localAlerts = localRiskAlerts(readEncounter(), state.segments);
  const remoteAlerts = state.clinicalAlerts
    .map((alert) => typeof alert === "string" ? alert : alert.message || "")
    .filter(Boolean);
  const alerts = unique([...localAlerts, ...remoteAlerts]);
  if (!alerts.length) {
    els.riskPanel.hidden = true;
    els.riskPanel.innerHTML = "";
    return;
  }
  els.riskPanel.hidden = false;
  els.riskPanel.innerHTML = [
    "<strong>审核提示</strong>",
    "<ul>",
    ...alerts.map((alert) => `<li>${escapeHtml(alert)}</li>`),
    "</ul>"
  ].join("");
}

function renderEvidence() {
  if (!els.evidencePanel) return;
  const evidence = state.evidence.filter((item) => item && (item.claim || item.segmentId || item.source));
  if (!evidence.length) {
    els.evidencePanel.hidden = true;
    els.evidencePanel.innerHTML = "";
    return;
  }
  els.evidencePanel.hidden = false;
  els.evidencePanel.innerHTML = [
    "<strong>证据链</strong>",
    "<ul>",
    ...evidence.map((item) => {
      const claim = item.claim || item.item || "记录项";
      const segmentId = item.segmentId || item.evidenceSegmentId || "";
      const source = item.source || "";
      return `<li>${escapeHtml(claim)}${segmentId ? `（片段：${escapeHtml(segmentId)}）` : ""}${source ? ` - ${escapeHtml(source)}` : ""}</li>`;
    }),
    "</ul>"
  ].join("");
}

function renderAuditLog() {
  if (!els.auditPanel) return;
  if (!state.auditLog.length) {
    els.auditPanel.hidden = true;
    els.auditPanel.innerHTML = "";
    return;
  }
  els.auditPanel.hidden = false;
  els.auditPanel.innerHTML = [
    "<strong>本地审计日志</strong>",
    "<ol>",
    ...state.auditLog.slice(-12).map((item) => `<li>${escapeHtml(formatAuditItem(item))}</li>`),
    "</ol>"
  ].join("");
}

function addAuditEvent(action) {
  state.auditLog.push({
    at: new Date().toISOString(),
    action,
    doctorName: els.doctorName.value.trim()
  });
  renderAuditLog();
}

function formatAuditItem(item) {
  const at = item.at ? new Date(item.at).toLocaleString("zh-CN", { hour12: false }) : "";
  const doctor = item.doctorName ? ` - ${item.doctorName}` : "";
  return `${at} ${item.action}${doctor}`.trim();
}

function localRiskAlerts(encounter, segments) {
  const alerts = [];
  const required = [
    ["过敏史", encounter.allergies],
    ["用药史", encounter.medications],
    ["全身病史", encounter.medicalHistory],
    ["检查所见", encounter.examFindings],
    ["诊断/问题清单", encounter.diagnoses],
    ["知情同意要点", encounter.treatmentConsent],
    ["术后医嘱/复诊", encounter.followUp]
  ];
  required.forEach(([label, value]) => {
    if (!String(value || "").trim()) alerts.push(`${label}为空，请医生确认是否为无或待补充。`);
  });
  const text = `${Object.values(encounter).join(" ")} ${segments.map((segment) => segment.text).join(" ")}`;
  const surgicalKeywords = /拔牙|种植|翻瓣|切开|缝合|骨粉|植骨|根管|开髓|麻醉|处方|抗生素|止痛药/;
  if (surgicalKeywords.test(text) && !String(encounter.treatmentConsent || "").trim()) {
    alerts.push("涉及手术、麻醉、处方或根管等高风险项目，请补充风险、替代方案和知情同意。");
  }
  if (segments.some((segment) => segment.speaker === "unknown")) {
    alerts.push("仍有待确认说话人片段，请核对后再定稿。");
  }
  if (/牙周|探诊|出血|BOP|松动|附着|PD|袋|龈/.test(text) && !String(encounter.perioChart || "").trim()) {
    alerts.push("对话涉及牙周检查，请摘录探诊深度、出血、松动度或确认无需牙周记录。");
  }
  return alerts;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function extractPerioLines(text) {
  const source = String(text || "");
  const sentences = source
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;])\s*|[\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const perioPattern = /牙周|探诊|出血|BOP|PD|袋|附着|松动|动度|龈|mm|毫米|[1-4]?[1-8]\s*(近中|远中|颊|舌|腭|唇|MB|DB|ML|DL)/i;
  return unique(sentences.filter((line) => perioPattern.test(line))).slice(0, 12);
}

function formatPatientSummary() {
  const encounter = readEncounter();
  return [
    "患者说明草稿",
    reportHeader(),
    "",
    "本次主要问题：",
    plainOrPlaceholder(state.report?.chiefComplaintSummary || encounter.chiefNote),
    "",
    "医生需要您了解的重点：",
    plainOrPlaceholder(state.report?.visitAnalysis || encounter.diagnoses),
    "",
    "拟定处理计划：",
    formatTreatmentPlan(state.report?.treatmentPlan),
    "",
    "注意事项与复诊：",
    plainOrPlaceholder(state.report?.followUp || encounter.followUp),
    "",
    "说明：以上内容为医生审核后的患者沟通草稿，不替代最终病历或处方。"
  ].join("\n").trim();
}

function formatReferralLetter() {
  const encounter = readEncounter();
  return [
    "转诊信草稿",
    reportHeader(),
    "",
    "转诊原因：",
    plainOrPlaceholder(state.report?.chiefComplaintSummary || encounter.chiefNote),
    "",
    "病史与风险：",
    plainOrPlaceholder(formatHistoryAndRisk(state.report || {})),
    "",
    "检查与影像：",
    plainOrPlaceholder(formatExamAndImaging(state.report || {})),
    "",
    "诊断/问题清单：",
    plainOrPlaceholder(formatDiagnosisList(state.report?.diagnoses) || encounter.diagnoses),
    "",
    "已沟通/已处理：",
    plainOrPlaceholder(state.report?.informedConsent || encounter.treatmentConsent),
    "",
    "请会诊/处理建议：",
    plainOrPlaceholder(formatTreatmentPlan(state.report?.treatmentPlan)),
    "",
    "转出医生签名："
  ].join("\n").trim();
}

function plainOrPlaceholder(value) {
  return String(value || "").trim() || "待医生补充";
}

function reviewLabel(key) {
  return {
    transcriptReviewed: "转写核对",
    historyReviewed: "病史风险核对",
    planReviewed: "方案核对",
    finalReviewed: "最终报告核对"
  }[key] || key;
}

function writeEncounter(encounter) {
  els.patientName.value = encounter.patientName || "";
  els.patientId.value = encounter.patientId || "";
  els.doctorName.value = encounter.doctorName || "";
  els.visitDate.value = encounter.visitDate || new Date().toISOString().slice(0, 10);
  els.chiefNote.value = encounter.chiefNote || "";
  els.medicalHistory.value = encounter.medicalHistory || "";
  els.allergies.value = encounter.allergies || "";
  els.medications.value = encounter.medications || "";
  els.dentalHistory.value = encounter.dentalHistory || "";
  els.examFindings.value = encounter.examFindings || "";
  els.perioChart.value = encounter.perioChart || "";
  els.imagingFindings.value = encounter.imagingFindings || "";
  els.diagnoses.value = encounter.diagnoses || "";
  els.treatmentConsent.value = encounter.treatmentConsent || "";
  els.followUp.value = encounter.followUp || "";
  els.consent.checked = Boolean(encounter.consentConfirmed);
  els.privacyConfirmed.checked = Boolean(encounter.privacyConfirmed);
}

function writeReviewState(review) {
  els.transcriptReviewed.checked = Boolean(review.transcriptReviewed);
  els.historyReviewed.checked = Boolean(review.historyReviewed);
  els.planReviewed.checked = Boolean(review.planReviewed);
  els.finalReviewed.checked = Boolean(review.finalReviewed);
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

function fileNameForMime(mimeType, label = "recording") {
  const safeLabel = String(label || "recording").replace(/[^\w.-]/g, "_");
  if (mimeType.includes("mp4")) return `${safeLabel}.mp4`;
  if (mimeType.includes("ogg")) return `${safeLabel}.ogg`;
  return `${safeLabel}.webm`;
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
