/** WaterScope research agent — GitHub Pages UI wired to mcpSLM Flask API. */

const SPACE_ID = "EnvironmentalAI/WaterScopeAI";
const API_BASE = (window.WATERSCOPE_API || "").replace(/\/$/, "");
const MAX_SELECT = 4;

const RESEARCH_TASKS = [
  { value: "auto", label: "Auto-detect task", minPapers: 0 },
  { value: "general_qa", label: "General environmental QA", minPapers: 0 },
  { value: "document_qa", label: "Document-grounded QA", minPapers: 1 },
  { value: "paper_synthesis", label: "Multi-paper synthesis", minPapers: 2 },
  { value: "method_recommendation", label: "Method recommendation", minPapers: 0 },
  { value: "research_gaps", label: "Research-gap identification", minPapers: 1 },
  { value: "claim_check", label: "Unsupported-claim check", minPapers: 1 },
];

let agentApp = null;
let searchResults = [];
let savedPapers = [];
let savedRenderItems = [];
let papersById = new Map();
let selectedDocumentIds = new Set();
let agentConversation = [];
let agentProcessing = false;
let pendingMediaPaper = null;
let pendingMediaExport = false;
let activeMediaDetailsPaper = null;
// Last successful figure/table analysis, for natural-language follow-ups like "the table".
let lastMediaContext = null;
// Lightweight session-only dialog state for the media pathway.
let mediaDialog = null;
let lastRenderedMediaKey = null;
let activeModelDisplay = "llama";
let mediaOperationTimer = null;
let lastSearchQuery = "";
let searchResultsPage = 0;
const RESULTS_PAGE_SIZE = 10;

const MODEL_TIMER_START_KEY = "waterscope_model_connect_started_at";
const MODEL_TIMER_DONE_KEY = "waterscope_model_connect_elapsed_ms";

function getSharedModelTimerStart() {
  const raw = sessionStorage.getItem(MODEL_TIMER_START_KEY);
  return raw ? Number(raw) : null;
}
function ensureSharedModelTimerStarted() {
  let t = getSharedModelTimerStart();
  if (!t || !Number.isFinite(t)) {
    t = Date.now();
    sessionStorage.setItem(MODEL_TIMER_START_KEY, String(t));
    sessionStorage.removeItem(MODEL_TIMER_DONE_KEY);
  }
  return t;
}
function completeSharedModelTimer() {
  const t = getSharedModelTimerStart();
  if (t && Number.isFinite(t)) {
    sessionStorage.setItem(MODEL_TIMER_DONE_KEY, String(Math.max(0, Date.now() - t)));
  }
  sessionStorage.removeItem(MODEL_TIMER_START_KEY);
}
function sharedModelElapsedMs() {
  const t = getSharedModelTimerStart();
  if (t && Number.isFinite(t)) return Math.max(0, Date.now() - t);
  const done = Number(sessionStorage.getItem(MODEL_TIMER_DONE_KEY));
  return Number.isFinite(done) && done >= 0 ? done : 0;
}
function formatSharedModelElapsed(ms) {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s/60)}m ${(s%60).toFixed(1)}s`;
}

let modelTimerInterval = null;
function updateAgentModelTimer() {
  const el = document.getElementById("chat-model-elapsed");
  if (modelOperationTimer) return;
  if (el) el.textContent = formatSharedModelElapsed(sharedModelElapsedMs());

  if (!agentApp && !agentProcessing && getSharedModelTimerStart()) {
    const status = document.getElementById("chat-model-status");
    if (status && !status.classList.contains("status-error")) {
      setChatModelStatus(
        sharedModelElapsedMs() >= MODEL_LONG_STARTUP_MS ? "Taking too long…" : "Starting…",
        "status-processing"
      );
    }
  }
}
function startAgentModelTimer() {
  ensureSharedModelTimerStarted();
  if (modelTimerInterval) clearInterval(modelTimerInterval);
  modelTimerInterval = setInterval(updateAgentModelTimer, 100);
  updateAgentModelTimer();
}
function finishAgentModelTimer() {
  completeSharedModelTimer();
  if (modelTimerInterval) clearInterval(modelTimerInterval);
  modelTimerInterval = null;
  updateAgentModelTimer();
}


const SEARCH_TIMER_START_KEY = "waterscope_search_connect_started_at";
const SEARCH_TIMER_DONE_KEY = "waterscope_search_connect_elapsed_ms";

function getSharedSearchTimerStart() {
  const raw = sessionStorage.getItem(SEARCH_TIMER_START_KEY);
  return raw ? Number(raw) : null;
}
function ensureSharedSearchTimerStarted() {
  let t = getSharedSearchTimerStart();
  if (!t || !Number.isFinite(t)) {
    t = Date.now();
    sessionStorage.setItem(SEARCH_TIMER_START_KEY, String(t));
    sessionStorage.removeItem(SEARCH_TIMER_DONE_KEY);
  }
  return t;
}
function completeSharedSearchTimer() {
  const t = getSharedSearchTimerStart();
  if (t && Number.isFinite(t)) {
    sessionStorage.setItem(SEARCH_TIMER_DONE_KEY, String(Math.max(0, Date.now() - t)));
  }
  sessionStorage.removeItem(SEARCH_TIMER_START_KEY);
}
function sharedSearchElapsedMs() {
  const t = getSharedSearchTimerStart();
  if (t && Number.isFinite(t)) return Math.max(0, Date.now() - t);
  const done = Number(sessionStorage.getItem(SEARCH_TIMER_DONE_KEY));
  return Number.isFinite(done) && done >= 0 ? done : 0;
}

let searchTimerInterval = null;
function updateAgentSearchTimer() {
  const el = document.getElementById("search-system-elapsed");
  if (el) el.textContent = formatSharedModelElapsed(sharedSearchElapsedMs());
}
function startAgentSearchTimer() {
  ensureSharedSearchTimerStarted();
  if (searchTimerInterval) clearInterval(searchTimerInterval);
  searchTimerInterval = setInterval(updateAgentSearchTimer, 100);
  updateAgentSearchTimer();
}
function finishAgentSearchTimer() {
  completeSharedSearchTimer();
  if (searchTimerInterval) clearInterval(searchTimerInterval);
  searchTimerInterval = null;
  updateAgentSearchTimer();
}


let searchOperationTimer = null;
let modelOperationTimer = null;
let searchElapsedBeforeOperation = null;
let modelElapsedBeforeOperation = null;

function formatOperationElapsed(startedAt) {
  return formatSharedModelElapsed(Math.max(0, Date.now() - startedAt));
}
function startSearchOperationStatus() {
  const startedAt = Date.now();
  const elapsedEl = document.getElementById("search-system-elapsed");
  if (searchOperationTimer) clearInterval(searchOperationTimer);
  if (searchElapsedBeforeOperation === null) {
    searchElapsedBeforeOperation = elapsedEl?.textContent || formatSharedModelElapsed(sharedSearchElapsedMs());
  }
  const update = () => {
    setSearchSystemStatus("Processing…", "status-processing");
    if (elapsedEl) elapsedEl.textContent = formatOperationElapsed(startedAt);
  };
  update();
  searchOperationTimer = setInterval(update, 100);
}
function finishSearchOperationStatus(message = "Processed", type = "status-ready") {
  if (searchOperationTimer) clearInterval(searchOperationTimer);
  searchOperationTimer = null;
  setSearchSystemStatus(message, type);
  searchElapsedBeforeOperation = null;
}
function startModelOperationStatus(mode = "llama") {
  const isMedia = mode === "media";
  const startedAt = Date.now();
  const statusId = isMedia ? "media-analysis-status" : "chat-model-status";
  const elapsedId = isMedia ? "media-analysis-elapsed" : "chat-model-elapsed";
  const statusFn = isMedia ? setMediaAnalysisStatus : setChatModelStatus;
  const elapsedEl = document.getElementById(elapsedId);
  const activeTimer = isMedia ? mediaOperationTimer : modelOperationTimer;
  if (activeTimer) clearInterval(activeTimer);
  const update = () => {
    statusFn("Processing…", "status-processing");
    if (elapsedEl) elapsedEl.textContent = formatOperationElapsed(startedAt);
  };
  update();
  const timer = setInterval(update, 100);
  if (isMedia) mediaOperationTimer = timer;
  else modelOperationTimer = timer;
}
function finishModelOperationStatus(message = "Processed", type = "status-ready", mode = "llama") {
  const isMedia = mode === "media";
  if (isMedia) {
    if (mediaOperationTimer) clearInterval(mediaOperationTimer);
    mediaOperationTimer = null;
    setMediaAnalysisStatus(message, type);
  } else {
    if (modelOperationTimer) clearInterval(modelOperationTimer);
    modelOperationTimer = null;
    setChatModelStatus(message, type);
  }
}
function clearPublicationResultsForAgentSearch() {
  activeMediaDetailsPaper = null;
  lastMediaContext = null;
  mediaDialog = null;
  lastRenderedMediaKey = null;
  searchResults = [];
  searchResultsPage = 0;
  lastSearchQuery = "";
  selectedDocumentIds.clear();
  const countEl = document.getElementById("result-count");
  if (countEl) countEl.textContent = "Searching…";
  renderPublicationResults();
  renderSelectedPublications();
  renderSavedPapers();
}

const AGENT_SESSION_KEY = "waterscope_agent_session_v1";

function saveAgentSessionState() {
  try {
    const state = {
      searchResults,
      selectedDocumentIds: [...selectedDocumentIds],
      lastSearchQuery,
      searchResultsPage,
      searchTopK: Number(document.getElementById("search-top-k")?.value || 10),
      publicationQuery: document.getElementById("publication-query")?.value || "",
      workspaceView: agentWorkspaceView || "split",
    };
    sessionStorage.setItem(AGENT_SESSION_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save Agent session state:", error);
  }
}

function restoreAgentSessionState() {
  try {
    const raw = sessionStorage.getItem(AGENT_SESSION_KEY);
    if (!raw) return false;

    const state = JSON.parse(raw);
    searchResults = Array.isArray(state.searchResults) ? state.searchResults : [];
    selectedDocumentIds = new Set(
      Array.isArray(state.selectedDocumentIds) ? state.selectedDocumentIds : []
    );
    lastSearchQuery = String(state.lastSearchQuery || "");
    searchResultsPage = Number.isInteger(state.searchResultsPage) ? state.searchResultsPage : 0;

    const queryInput = document.getElementById("publication-query");
    if (queryInput) {
      queryInput.value = state.publicationQuery || lastSearchQuery || "";
    }

    const topKSelect = document.getElementById("search-top-k");
    const restoredTopK = Number(state.searchTopK || 10);
    if (topKSelect && [10, 50, 100, 200].includes(restoredTopK)) {
      topKSelect.value = String(restoredTopK);
    }

    agentWorkspaceView = ["split", "left", "right"].includes(state.workspaceView)
      ? state.workspaceView
      : "split";

    return true;
  } catch (error) {
    console.warn("Could not restore Agent session state:", error);
    return false;
  }
}

function searchTopK() {
  const raw = Number(document.getElementById("search-top-k")?.value || 10);
  return [10, 50, 100, 200].includes(raw) ? raw : 10;
}

const api = (path) => `${API_BASE}${path}`;

function resolveApiUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function officialDoiUrl(doi) {
  const value = String(doi || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return value ? `https://doi.org/${value}` : "";
}

function paperDownloadUrl(pdfFile) {
  const value = String(pdfFile || "").trim();
  if (!value) return "";
  const filename = value.split(/[\\/]/).pop();
  return api(`/pdfs/${encodeURIComponent(filename)}`);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMetadataInline(value) {
  return escapeHTML(value)
    .replace(/&lt;i&gt;/gi, "<i>")
    .replace(/&lt;\/i&gt;/gi, "</i>")
    .replace(/&lt;em&gt;/gi, "<em>")
    .replace(/&lt;\/em&gt;/gi, "</em>");
}

function setConnectionStatus(elementId, message, type = "") {
  const status = document.getElementById(elementId);
  if (!status) return;
  status.textContent = message;
  status.classList.remove("status-processing", "status-ready", "status-error");
  if (type) status.classList.add(type);
}

function setSearchSystemStatus(message, type = "") {
  setConnectionStatus("search-system-status", message, type);
}

function setChatModelStatus(message, type = "") {
  setConnectionStatus("chat-model-status", message, type);
}
function setMediaAnalysisStatus(message, type = "") {
  setConnectionStatus("media-analysis-status", message, type);
}

function canChat(documentId) {
  if (!documentId) return false;
  const paper = papersById.get(documentId);
  if (paper) return Boolean(paper.has_summary);
  // Paper index still loading — allow if search already linked this document.
  return searchResults.some((row) => row.document_id === documentId);
}

async function checkFlaskApi() {
  startAgentSearchTimer();
  try {
    setSearchSystemStatus("Connecting…", "status-processing");
    const response = await fetch(api("/api/health"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    finishAgentSearchTimer();
    setSearchSystemStatus(payload.status === "ok" ? "Connected" : "Degraded", "status-ready");
    return true;
  } catch (error) {
    finishAgentSearchTimer();
    console.error("Search system connection error:", error);
    setSearchSystemStatus("Unavailable", "status-error");
    return false;
  }
}

const MODEL_RETRY_INTERVAL_MS = 30 * 1000;
const MODEL_LONG_STARTUP_MS = 30 * 60 * 1000;
const HF_SPACE_RUNTIME_URL = `https://huggingface.co/api/spaces/${SPACE_ID}`;

let modelRetryTimeout = null;
let modelConnectionInProgress = false;
let gradioClientModulePromise = null;

function setLlamaConnectionStatus(message, type) {
  if (!modelOperationTimer) setChatModelStatus(message, type);
}
function modelStartupStatusMessage() {
  return sharedModelElapsedMs() >= MODEL_LONG_STARTUP_MS
    ? "Taking too long…"
    : "Starting…";
}

function clearModelRetry() {
  if (modelRetryTimeout) clearTimeout(modelRetryTimeout);
  modelRetryTimeout = null;
}

function scheduleModelRetry() {
  if (agentApp || modelRetryTimeout) return;
  modelRetryTimeout = setTimeout(() => {
    modelRetryTimeout = null;
    initializeGradioClient().catch((error) => {
      console.error("Chat model retry error:", error);
    });
  }, MODEL_RETRY_INTERVAL_MS);
}

async function getHfSpaceRuntimeState() {
  try {
    const response = await fetch(HF_SPACE_RUNTIME_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HF runtime HTTP ${response.status}`);
    const payload = await response.json();

    const runtime = payload?.runtime || {};
    const stage = String(runtime.stage || payload?.stage || "").toUpperCase();

    const errorText = [
      runtime.errorMessage,
      runtime.error_message,
      runtime.message,
      runtime.raw?.errorMessage,
      runtime.raw?.error_message,
      runtime.raw?.message,
      payload?.errorMessage,
      payload?.error_message,
      payload?.message,
    ]
      .filter(Boolean)
      .join(" ");

    return { stage, errorText };
  } catch (error) {
    console.warn("Could not read HF Space runtime state:", error);
    return { stage: "", errorText: "" };
  }
}

async function initializeGradioClient() {
  if (agentApp) {
    clearModelRetry();
    setLlamaConnectionStatus("Connected", "status-ready");
    return true;
  }

  if (modelConnectionInProgress) return false;
  modelConnectionInProgress = true;

  try {
    startAgentModelTimer();
    if (!agentProcessing) {
      setLlamaConnectionStatus(modelStartupStatusMessage(), "status-processing");
    }

    const runtimeBeforeConnect = await getHfSpaceRuntimeState();
    if (runtimeBeforeConnect.stage === "RUNTIME_ERROR") {
      finishAgentModelTimer();
      if (!agentProcessing) setLlamaConnectionStatus("Unavailable", "status-error");
      console.error(
        "HF Space runtime error:",
        runtimeBeforeConnect.errorText || "RUNTIME_ERROR"
      );
      scheduleModelRetry();
      return false;
    }

    if (!gradioClientModulePromise) {
      gradioClientModulePromise = import(
        "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js"
      );
    }
    const { Client } = await gradioClientModulePromise;

    agentApp = await Client.connect(SPACE_ID);
    clearModelRetry();
    finishAgentModelTimer();
    if (!agentProcessing) setLlamaConnectionStatus("Connected", "status-ready");
    return true;
  } catch (error) {
    console.error("Chat model connection error:", error);

    const runtimeAfterConnect = await getHfSpaceRuntimeState();
    if (runtimeAfterConnect.stage === "RUNTIME_ERROR") {
      finishAgentModelTimer();
      if (!agentProcessing) setLlamaConnectionStatus("Unavailable", "status-error");
      console.error(
        "HF Space runtime error:",
        runtimeAfterConnect.errorText || "RUNTIME_ERROR"
      );
    } else {
      if (!agentProcessing) {
        setLlamaConnectionStatus(modelStartupStatusMessage(), "status-processing");
      }
    }

    scheduleModelRetry();
    return false;
  } finally {
    modelConnectionInProgress = false;
  }
}

async function loadPapersIndex() {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(api("/api/papers"));
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not load paper index from API.");
      }
      const payload = await response.json();
      papersById = new Map((payload.papers || []).map((paper) => [paper.document_id, paper]));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function loadSavedPapers() {
  const response = await fetch(api("/api/saved-papers"));
  if (!response.ok) return;
  const payload = await response.json();
  savedPapers = payload.papers || [];
  renderSavedPapers();
}

async function savePaper(savePayload) {
  const response = await fetch(api("/api/saved-papers"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savePayload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Save failed");
  await loadSavedPapers();
  return data.paper;
}

async function unsavePaper(savedId) {
  const response = await fetch(api(`/api/saved-papers/${savedId}`), { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Remove failed");
  await loadSavedPapers();
}

async function runPublicationSearch() {
  const queryInput = document.getElementById("publication-query");
  const searchButton = document.getElementById("publication-search");
  const query = queryInput.value.trim();
  if (!query) {
    document.getElementById("result-count").textContent = "Enter a search query";
    return;
  }
  if (searchButton?.disabled) return;
  const topK = searchTopK();
  const topKSelect = document.getElementById("search-top-k");
  if (searchButton) searchButton.disabled = true;
  queryInput.disabled = true;
  if (topKSelect) topKSelect.disabled = true;
  document.getElementById("result-count").textContent = "Searching…";
  startSearchOperationStatus();
  try {
    const response = await fetch(api(`/api/search?q=${encodeURIComponent(query)}&top_k=${topK}`));
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Search failed");
    lastSearchQuery = payload.search_query || query;
    if (payload.search_query && payload.search_query !== query) queryInput.value = payload.search_query;
    searchResults = payload.results || [];
    searchResultsPage = 0;
    searchScoreMode = payload.score_mode || "rrf";
    const excluded = payload.query_parsed?.excluded_phrases || [];
    let countText = `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} (top ${topK})`;
    if (excluded.length) countText += ` · excluded: ${excluded.join(", ")}`;
    document.getElementById("result-count").textContent = countText;
    renderPublicationResults();
    saveAgentSessionState();
    finishSearchOperationStatus();
  } catch (error) {
    finishSearchOperationStatus("Connection issue", "status-error");
    throw error;
  } finally {
    if (searchButton) searchButton.disabled = false;
    queryInput.disabled = false;
    if (topKSelect) topKSelect.disabled = false;
  }
}

function toggleDocument(documentId) {
  if (selectedDocumentIds.has(documentId)) {
    selectedDocumentIds.delete(documentId);
  } else {
    if (!canChat(documentId)) return;
    if (selectedDocumentIds.size >= MAX_SELECT) {
      addAgentMessage(`You can select at most ${MAX_SELECT} papers for chat.`, "assistant");
      return;
    }
    selectedDocumentIds.add(documentId);
  }
  renderPublicationResults();
  renderSelectedPublications();
  renderSavedPapers();
  saveAgentSessionState();
}

function resolveItemAuthors(item) {
  const direct = (item.authors_display || item.authors || "").trim();
  if (direct) return direct;
  const rowIndex = item.metadata_row_index;
  if (rowIndex != null) {
    const match = searchResults.find((row) => row.metadata_row_index === rowIndex);
    if (match) return (match.authors_display || match.authors || "").trim();
  }
  if (item.document_id) {
    const match = searchResults.find((row) => row.document_id === item.document_id);
    if (match) return (match.authors_display || match.authors || "").trim();
  }
  return "";
}

function renderPublicationCard(item, index, { showSave = true, showScore = true, showPaperMenu = false } = {}) {
  const documentId = item.document_id || "";
  const menuItem = { ...item, _menuIndex: index };
  const checked = documentId && selectedDocumentIds.has(documentId);
  const chatOk = documentId && canChat(documentId);
  const abstract = item.abstract || "No abstract available.";
  const authors = resolveItemAuthors(item);
  const journal = String(item.journal || item.SO || "").trim();
  const publicationType = String(item.publication_type || item.DT || "").trim();
  const savePayload = item.save_payload;
  const isSaved = Boolean(item.is_saved || savePayload?.saved_id);
  const doiUrl = officialDoiUrl(item.doi || savePayload?.doi);
  const downloadUrl = paperDownloadUrl(item.pdf_file || savePayload?.pdf_file);

  let actions = "";
  if (showSave && savePayload) {
    actions = `
      <div class="publication-actions">
        <button type="button" class="btn-save" data-result-index="${index}" ${isSaved ? "disabled" : ""}>
          ${isSaved ? "Bookmarked" : "Bookmark"}
        </button>
        ${showPaperMenu ? `<button type="button" class="btn-details" data-result-index="${index}" aria-expanded="false"><i class="fas fa-circle-info" aria-hidden="true"></i> Details</button>` : ""}
        ${doiUrl ? `<a class="publication-action-link btn-official" href="${escapeHTML(doiUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-up-right-from-square" aria-hidden="true"></i> Official</a>` : `<button type="button" class="publication-action-link btn-official" disabled title="DOI not available"><i class="fas fa-up-right-from-square" aria-hidden="true"></i> Official</button>`}
        ${downloadUrl ? `<a class="publication-action-link btn-download" href="${escapeHTML(downloadUrl)}" download><i class="fas fa-download" aria-hidden="true"></i> Download</a>` : `<button type="button" class="publication-action-link btn-download" disabled title="PDF link not available yet"><i class="fas fa-download" aria-hidden="true"></i> Download</button>`}
        ${isSaved && savePayload.saved_id ? `<button type="button" class="btn-remove" data-saved-id="${escapeHTML(savePayload.saved_id)}">Remove</button>` : ""}
      </div>`;
  }

  const checkbox = documentId
    ? `<label class="paper-checkbox" aria-label="Select for chat">
         <input type="checkbox" data-document-id="${escapeHTML(documentId)}" ${checked ? "checked" : ""} ${chatOk ? "" : "disabled"}>
         <span></span>
       </label>`
    : `<div class="paper-checkbox" aria-hidden="true"></div>`;

  const scoreText = showScore ? formatResultScore(item) : "";
  const menuButton = showPaperMenu
    ? `<div class="paper-card-menu-wrap">
         <button type="button" class="paper-card-menu-btn" data-result-index="${index}" aria-label="Paper details" aria-expanded="false" aria-haspopup="true">
           <i class="fas fa-ellipsis-v" aria-hidden="true"></i>
         </button>
       </div>`
    : "";
  const menuPanel = showPaperMenu
    ? `<div class="paper-card-menu-panel hidden" data-result-index="${index}" role="region" aria-label="Paper details">
         ${renderPaperDetailsPanel(menuItem)}
       </div>`
    : "";

  return `
    <article class="publication-card ${checked ? "selected" : ""} ${chatOk ? "" : "no-chat"}" data-document-id="${escapeHTML(documentId)}">
      ${checkbox}
      <div class="publication-card-content">
        <div class="publication-card-header">
          <div class="publication-meta">
            <span class="meta-year">${escapeHTML(item.year || "—")}</span>
            ${scoreText ? `<span class="meta-score">${escapeHTML(scoreText)}</span>` : ""}
            ${authors ? `<span class="meta-authors">${escapeHTML(authors)}</span>` : ""}
            ${journal ? `<span class="meta-journal">${escapeHTML(journal)}</span>` : ""}
            ${publicationType ? `<span class="meta-publication-type">${escapeHTML(publicationType)}</span>` : ""}
          </div>
          ${menuButton}
        </div>
        <h4>${formatMetadataInline(item.title || "Untitled")}</h4>
        <p>${escapeHTML(String(abstract).slice(0, 260))}${String(abstract).length > 260 ? "…" : ""}</p>
        <div class="keyword-line"><i class="fas fa-tags"></i> ${escapeHTML(item.keywords || "—")}</div>
        ${chatOk ? "" : '<div class="chat-hint">No linked summary — bookmark for reference, chat unavailable</div>'}
        ${actions}
        ${menuPanel}
      </div>
    </article>`;
}

let searchScoreMode = "rrf";

function formatScoreNumber(value, digits = 4) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function formatScoreRank(value) {
  const rank = Number(value);
  if (!Number.isFinite(rank) || rank <= 0) return "—";
  return `#${Math.trunc(rank)}`;
}

function usesRrfScoring(item) {
  return searchScoreMode === "rrf" || item.score_label === "RRF" || item.rrf_score != null;
}

function renderScoreDetailsHtml(item) {
  const isVector = searchScoreMode === "vector" || item.score_label === "Vector";
  const rows = [
    ["Search rank", formatScoreRank(item.rank)],
    ["Final score", formatScoreNumber(item.final_score ?? item.score)],
  ];

  if (isVector) {
    rows.push(["Vector similarity", formatScoreNumber(item.semantic_score ?? item.final_score)]);
  } else if (usesRrfScoring(item)) {
    rows.push(
      ["BM25 score", formatScoreNumber(item.bm25_score)],
      ["Dense score", formatScoreNumber(item.semantic_score)],
      ["BM25 rank", formatScoreRank(item.bm25_rank)],
      ["Dense rank", formatScoreRank(item.semantic_rank)],
      ["BM25 RRF", formatScoreNumber(item.bm25_rrf_score)],
      ["Dense RRF", formatScoreNumber(item.semantic_rrf_score)],
      ["Combined RRF", formatScoreNumber(item.rrf_score ?? item.final_score)]
    );
  } else {
    rows.push(["BM25 score", formatScoreNumber(item.bm25_score)]);
  }

  const note = isVector
    ? "Ranked by cosine similarity over weighted title + abstract + keyword embeddings (Qdrant)."
    : usesRrfScoring(item)
      ? "Hybrid ranking: 0.5 × BM25 RRF + 0.5 × dense RRF, with RRF k = 60."
      : "Semantic search off — results ranked by BM25 only.";

  return `
    <div class="score-metrics-grid">
      ${rows
        .map(
          ([label, value]) =>
            `<div class="score-metric"><span class="score-metric-label">${escapeHTML(label)}</span><strong class="score-metric-value">${escapeHTML(value)}</strong></div>`
        )
        .join("")}
    </div>
    <p class="score-details-note">${escapeHTML(note)}</p>`;
}

function renderPaperDetailsPanel(item) {
  const index = item._menuIndex ?? "";
  return `
    <div class="paper-figures-viewer" data-figure-index="${index}">
      <h5><i class="fas fa-images" aria-hidden="true"></i> Media</h5>
      <div class="figures-viewer-body" data-loaded="false">
        ${
          item.has_figures
            ? '<p class="figures-loading">Loading media…</p>'
            : '<p class="figures-empty">No extracted media for this paper yet.</p>'
        }
      </div>
    </div>
    <div class="paper-score-details">
      <h5><i class="fas fa-chart-bar" aria-hidden="true"></i> Ranking metrics</h5>
      ${renderScoreDetailsHtml(item)}
    </div>`;
}

function figureKindLabel(kind) {
  if (kind === "table") return "Table";
  if (kind === "graphic_abstract") return "Graphical abstract";
  return "Figure";
}

function mediaDisplayLabel(entry, index) {
  const kind = entry?.kind || "";
  if (kind === "graphic_abstract") return "Graphical abstract";

  const base = figureKindLabel(kind);
  const rawLabel = String(entry?.label || "");
  const numberMatch = rawLabel.match(/(\d+)/);
  const number = numberMatch ? String(parseInt(numberMatch[1], 10)) : String(index + 1);
  return `${base} ${number}`;
}

function renderFigureGallery(payload) {
  if (!payload?.items?.length) {
    return '<p class="figures-empty">No media found for this paper.</p>';
  }
  const initialVisible = 4;
  const tiles = payload.items
    .map((entry, index) => {
      const label = mediaDisplayLabel(entry, index);
      const caption = (entry.caption || "").trim();
      const imageUrl = resolveApiUrl(entry.image_url);
      const extraClass = index >= initialVisible ? " media-extra hidden" : "";

      return `
        <div class="media-analysis-tile${extraClass}">
        <button
          type="button"
          class="figure-thumb"
          data-figure-index="${index}"
          data-image-url="${escapeHTML(imageUrl)}"
          data-caption="${escapeHTML(caption)}"
          data-label="${escapeHTML(label)}"
          aria-label="View ${escapeHTML(label)}"
        >
          <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(label)}" loading="lazy">
          <span class="figure-thumb-meta figure-thumb-meta-simple">
            <span class="figure-thumb-title">${escapeHTML(label)}</span>
          </span>
        </button>
        ${(entry.kind === "figure" || entry.kind === "table") ? `<button type="button" class="media-analyze-action" data-media-label="${escapeHTML(label)}" title="Extract approximate data and summarize"><i class="fas fa-chart-line" aria-hidden="true"></i> Analyze &amp; CSV</button>` : ""}
        </div>`;
    })
    .join("");

  const expandButton = payload.items.length > initialVisible
    ? `<button type="button" class="media-expand-btn" data-expanded="false">Show all ${payload.items.length} media</button>`
    : "";

  return `
    <div class="figures-gallery" role="list">${tiles}</div>
    <div class="media-gallery-footer">
      <p class="figures-count">${payload.item_count} media item${payload.item_count === 1 ? "" : "s"} extracted from the PDF</p>
      ${expandButton}
    </div>`;
}

async function loadPaperFigures(panel, item) {
  const body = panel.querySelector(".figures-viewer-body");
  if (!body || body.dataset.loaded === "true" || body.dataset.loading === "true") return;
  if (!item.has_figures) {
    body.dataset.loaded = "true";
    return;
  }

  body.dataset.loading = "true";
  body.innerHTML = '<p class="figures-loading">Loading media…</p>';

  const params = new URLSearchParams();
  if (item.txt_file) params.set("txt_file", item.txt_file);
  else if (item.metadata_row_index != null) params.set("metadata_row_index", String(item.metadata_row_index));

  try {
    const response = await fetch(api(`/api/papers/figures?${params.toString()}`));
    if (!response.ok) {
      body.innerHTML = '<p class="figures-empty">No extracted media for this paper yet.</p>';
      body.dataset.loaded = "true";
      return;
    }
    const payload = await response.json();
    body.innerHTML = renderFigureGallery(payload);
    body.dataset.loaded = "true";
    wireFigureGallery(body, item);
  } catch (_error) {
    body.innerHTML = '<p class="figures-empty">Could not load media.</p>';
    body.dataset.loaded = "true";
  } finally {
    body.dataset.loading = "false";
  }
}

function ensureFigureLightbox() {
  let overlay = document.getElementById("figure-lightbox");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "figure-lightbox";
  overlay.className = "figure-lightbox hidden";
  overlay.innerHTML = `
    <div class="figure-lightbox-backdrop" data-close-lightbox="true"></div>
    <div class="figure-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Figure viewer">
      <button type="button" class="figure-lightbox-close" aria-label="Close figure viewer">&times;</button>
      <img class="figure-lightbox-image" alt="">
      <div class="figure-lightbox-caption"></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    if (event.target.dataset.closeLightbox === "true" || event.target.classList.contains("figure-lightbox-close")) {
      overlay.classList.add("hidden");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") overlay.classList.add("hidden");
  });
  return overlay;
}

function openFigureLightbox(imageUrl, caption, label) {
  const overlay = ensureFigureLightbox();
  const image = overlay.querySelector(".figure-lightbox-image");
  const captionEl = overlay.querySelector(".figure-lightbox-caption");
  image.src = imageUrl;
  image.alt = label || "Paper figure";
  captionEl.textContent = caption || label || "";
  overlay.classList.remove("hidden");
}

function wireFigureGallery(container, paper) {
  container.querySelectorAll(".media-analyze-action").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (agentProcessing) return;
      const input = document.getElementById("agent-user-input");
      // Bind gallery selection explicitly; never depend on the selected-paper set.
      pendingMediaPaper = paper;
      pendingMediaExport = true;
      input.value = `Extract all readable data from ${button.dataset.mediaLabel} and summarize the findings.`;
      setAgentWorkspaceView("right");
      sendAgentMessage();
    });
  });
  container.querySelectorAll(".figure-thumb").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openFigureLightbox(button.dataset.imageUrl, button.dataset.caption, button.dataset.label);
    });
  });

  const expandButton = container.querySelector(".media-expand-btn");
  if (expandButton) {
    expandButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const extras = container.querySelectorAll(".media-extra");
      const expanded = expandButton.dataset.expanded === "true";
      extras.forEach((item) => item.classList.toggle("hidden", expanded));
      expandButton.dataset.expanded = expanded ? "false" : "true";
      expandButton.textContent = expanded ? `Show all ${container.querySelectorAll(".figure-thumb").length} media` : "Show first 4";
    });
  }
}

function closeAllPaperMenus(exceptIndex = null) {
  document.querySelectorAll(".paper-card-menu-panel").forEach((panel) => {
    if (exceptIndex != null && panel.dataset.resultIndex === String(exceptIndex)) return;
    panel.classList.add("hidden");
  });
  document.querySelectorAll(".paper-card-menu-btn, .btn-details").forEach((button) => {
    if (exceptIndex != null && button.dataset.resultIndex === String(exceptIndex)) return;
    button.setAttribute("aria-expanded", "false");
  });
}

function togglePaperDetails(container, items, index) {
  const panel = container.querySelector(`.paper-card-menu-panel[data-result-index="${index}"]`);
  if (!panel) return;

  const willOpen = panel.classList.contains("hidden");
  closeAllPaperMenus();
  if (!willOpen) {
    activeMediaDetailsPaper = null;
    return;
  }

  panel.classList.remove("hidden");
  container.querySelectorAll(`[data-result-index="${index}"].paper-card-menu-btn, [data-result-index="${index}"].btn-details`).forEach((button) => {
    button.setAttribute("aria-expanded", "true");
  });
  const item = items[Number(index)];
  activeMediaDetailsPaper = item || null;
  if (item) loadPaperFigures(panel, item);
}

function formatResultScore(item) {
  const label = item.score_label || (searchScoreMode === "vector" ? "Vector" : searchScoreMode === "rrf" ? "RRF" : "BM25");
  const raw = item.rrf_score ?? item.final_score ?? item.bm25_score ?? item.score;
  if (raw == null || raw === "" || Number.isNaN(Number(raw))) return "";
  return `${label} ${Number(raw).toFixed(3)}`;
}

function wirePublicationCards(container, items) {
  container.querySelectorAll('input[type="checkbox"][data-document-id]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked && !canChat(input.dataset.documentId)) {
        input.checked = false;
        return;
      }
      toggleDocument(input.dataset.documentId);
      if (input.checked !== selectedDocumentIds.has(input.dataset.documentId)) {
        input.checked = selectedDocumentIds.has(input.dataset.documentId);
      }
    });
  });

  container.querySelectorAll(".btn-save").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const idx = Number(button.dataset.resultIndex);
        const payload = items[idx]?.save_payload;
        if (!payload) throw new Error("Missing save payload");
        await savePaper(payload);
        if (lastSearchQuery) await runPublicationSearch();
        else await loadSavedPapers();
      } catch (error) {
        addAgentMessage(error.message, "assistant");
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll(".btn-remove").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await unsavePaper(button.dataset.savedId);
        if (lastSearchQuery) await runPublicationSearch();
      } catch (error) {
        addAgentMessage(error.message, "assistant");
      }
    });
  });

  container.querySelectorAll(".paper-card-menu-btn, .btn-details").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePaperDetails(container, items, button.dataset.resultIndex);
    });
  });
}

function getSearchResultsPageInfo() {
  const total = searchResults.length;
  if (total <= RESULTS_PAGE_SIZE) {
    return { start: 0, end: total, total, page: 0, pageCount: 1, paginated: false };
  }
  const pageCount = Math.ceil(total / RESULTS_PAGE_SIZE);
  const page = Math.min(Math.max(searchResultsPage, 0), pageCount - 1);
  const start = page * RESULTS_PAGE_SIZE;
  const end = Math.min(start + RESULTS_PAGE_SIZE, total);
  return { start, end, total, page, pageCount, paginated: true };
}

function updateSearchResultsPagination() {
  const bar = document.getElementById("search-results-pagination");
  if (!bar) return;
  const info = getSearchResultsPageInfo();
  const rangeEl = document.getElementById("search-results-range");
  const prevBtn = document.getElementById("search-results-prev");
  const nextBtn = document.getElementById("search-results-next");

  if (!info.paginated) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  if (rangeEl) rangeEl.textContent = `${info.end} of ${info.total}`;
  if (prevBtn) prevBtn.disabled = info.page <= 0;
  if (nextBtn) nextBtn.disabled = info.page >= info.pageCount - 1;
}

function renderPublicationResults() {
  const container = document.getElementById("publication-results");
  if (!searchResults.length) {
    container.innerHTML = '<div class="no-results"><i class="fas fa-search"></i><p>Search by title, abstract, or keywords.</p></div>';
    updateSearchResultsPagination();
    return;
  }

  const info = getSearchResultsPageInfo();
  searchResultsPage = info.page;
  const visibleResults = searchResults.slice(info.start, info.end);
  container.innerHTML = visibleResults
    .map((item, offset) => renderPublicationCard(item, info.start + offset, { showPaperMenu: true }))
    .join("");
  wirePublicationCards(container, searchResults);
  updateSearchResultsPagination();
}

function renderSavedPapers() {
  const container = document.getElementById("saved-paper-list");
  const countEl = document.getElementById("saved-count");
  if (!container) return;

  countEl.textContent = savedPapers.length;
  if (!savedPapers.length) {
    container.innerHTML = '<p class="empty-state">No bookmarks yet.</p>';
    return;
  }

  savedRenderItems = savedPapers.map((paper) => ({
    title: paper.title,
    year: paper.year,
    authors: paper.authors,
    authors_display: paper.authors_display || paper.authors,
    abstract: paper.abstract,
    keywords: paper.keywords,
    doi: paper.doi,
    pdf_file: paper.pdf_file,
    has_figures: paper.has_figures,
    document_id: paper.document_id,
    metadata_row_index: paper.metadata_row_index,
    score_label: paper.score_label,
    rrf_score: paper.rrf_score,
    final_score: paper.final_score,
    bm25_score: paper.bm25_score,
    semantic_score: paper.semantic_score,
    bm25_rank: paper.bm25_rank,
    semantic_rank: paper.semantic_rank,
    bm25_rrf_score: paper.bm25_rrf_score,
    semantic_rrf_score: paper.semantic_rrf_score,
    is_saved: true,
    save_payload: { ...paper, saved_id: paper.id, source: paper.source || "metadata" },
  }));

  container.innerHTML = savedRenderItems
    .map((item, index) => renderPublicationCard(item, index))
    .join("");
  wirePublicationCards(container, savedRenderItems);
}

function updateResearchTaskOptions() {
  const select = document.getElementById("agent-task");
  const paperCount = selectedDocumentIds.size;
  const previousValue = select.value;

  select.innerHTML = RESEARCH_TASKS.map((task) => {
    const disabled = paperCount < task.minPapers;
    const requirement =
      task.minPapers === 1 ? " (select a paper)" : task.minPapers === 2 ? " (select 2+ papers)" : "";
    return `<option value="${task.value}" ${disabled ? "disabled" : ""}>${task.label}${disabled ? requirement : ""}</option>`;
  }).join("");

  const previousStillAvailable = [...select.options].some(
    (option) => option.value === previousValue && !option.disabled
  );
  if (previousStillAvailable) {
    select.value = previousValue;
  } else if (paperCount >= 2) {
    select.value = "paper_synthesis";
  } else if (paperCount === 1) {
    select.value = "document_qa";
  } else {
    select.value = "auto";
  }
}

function renderSelectedPublications() {
  const selected = [...selectedDocumentIds].map((id) => {
    const indexed = papersById.get(id);
    const fromSearch = searchResults.find((r) => r.document_id === id);
    return {
      document_id: id,
      title: indexed?.title || fromSearch?.title || id,
    };
  });
  const count = selected.length;
  document.getElementById("selected-count").textContent = count;

  const clearSelectedTop = document.getElementById("clear-selected-top");
  if (clearSelectedTop) {
    clearSelectedTop.classList.toggle("hidden", count === 0);
    clearSelectedTop.innerHTML = count
      ? `<i class="fas fa-times-circle" aria-hidden="true"></i> Clear selected (${count})`
      : '<i class="fas fa-times-circle" aria-hidden="true"></i> Clear selected';
  }

  // Context is shown in the Research Assistant panel, not the header status row.
  const headerContext = document.getElementById("context-status");
  if (headerContext) headerContext.textContent = count
    ? `${count} paper${count === 1 ? "" : "s"} selected`
    : "No papers selected";
  document.getElementById("chat-context-description").textContent = count
    ? `Grounded in ${count} selected paper${count === 1 ? "" : "s"}`
    : document.getElementById("agent-mode").checked
      ? "Agent mode — auto search & select when you send a message"
      : "General chat mode (HF Space)";
  updateAgentSelectionNotice();
  updateResearchTaskOptions();

  const container = document.getElementById("selected-paper-list");
  if (!count) {
    container.innerHTML =
      '<p class="empty-state">No papers selected. General chat uses the HF Space model directly.</p>';
    return;
  }
  container.innerHTML = selected
    .map(
      (paper) => `
    <div class="selected-paper-item">
      <span>${formatMetadataInline(paper.title)}</span>
      <button data-remove-document="${escapeHTML(paper.document_id)}" title="Remove"><i class="fas fa-times"></i></button>
    </div>`
    )
    .join("");
  container.querySelectorAll("[data-remove-document]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDocumentIds.delete(button.dataset.removeDocument);
      renderPublicationResults();
      renderSelectedPublications();
      renderSavedPapers();
      saveAgentSessionState();
    });
  });
}

function updateAgentSelectionNotice() {
  const agentMode = document.getElementById("agent-mode")?.checked;
  const count = selectedDocumentIds.size;
  const warning = document.getElementById("agent-selection-warning");
  const notice = document.getElementById("agent-selection-notice");
  const showWarning = Boolean(agentMode && count > 0);

  warning?.classList.toggle("hidden", !showWarning);
  if (notice) {
    notice.classList.toggle("hidden", !showWarning);
    notice.textContent = showWarning
      ? `${count} paper${count === 1 ? "" : "s"} selected — Agent will not run a new search until you clear them.`
      : "";
  }
}

function clearAllSelectedPapers() {
  selectedDocumentIds.clear();
  renderPublicationResults();
  renderSelectedPublications();
  renderSavedPapers();
  saveAgentSessionState();
}

async function runSamplePublicationQuery(query) {
  document.getElementById("publication-query").value = query;
  await runPublicationSearch();
  setAgentWorkspaceView("left");
}

function runSampleAgentPrompt(prompt) {
  document.getElementById("agent-user-input").value = prompt;
  document.getElementById("agent-user-input").focus();
  if (selectedDocumentIds.size > 0 && document.getElementById("agent-mode")?.checked) {
    updateAgentSelectionNotice();
  }
}

function formatAgentMarkdown(text) {
  const escaped = escapeHTML(String(text ?? ""));
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^(\d+)\.\s+/gm, "<span class='md-list-num'>$1.</span> ")
    .replace(/\n/g, "<br>");
}

function addAgentMessage(text, role, { html = false } = {}) {
  const container = document.getElementById("agent-chat-messages");
  const message = document.createElement("div");
  message.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
  const content = document.createElement("div");
  content.className = "message-content";
  if (html && role !== "user") {
    content.innerHTML = formatAgentMarkdown(text);
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    content.appendChild(paragraph);
  }
  message.appendChild(content);
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

const AGENT_STEP_LABELS = {
  plan_search_query: "Plan search query",
  search_metadata: "Search metadata",
  select_papers_from_search: "Select papers",
  build_paper_context: "Load summaries",
  waterscope_agent_run: "Generate answer",
  format_discovery_results: "Summarize search results",
};

function describeAgentStep(step) {
  const label = AGENT_STEP_LABELS[step.tool] || step.tool;
  const output = step.output || {};
  if (step.tool === "plan_search_query") {
    return `Query: “${output.search_query ?? ""}” (${output.planner ?? "planner"})`;
  }
  if (step.tool === "search_metadata") {
    return `Found ${output.n_results ?? 0} results for “${step.input?.query ?? ""}”`;
  }
  if (step.tool === "select_papers_from_search") {
    const titles = (output.papers || []).map((p) => p.title).filter(Boolean);
    return `Selected ${titles.length} paper${titles.length === 1 ? "" : "s"}`;
  }
  if (step.tool === "build_paper_context") {
    return `Loaded ${output.n_papers ?? 0} summaries (${output.context_chars ?? 0} chars)`;
  }
  if (step.tool === "waterscope_agent_run") {
    return `Model: ${step.input?.model ?? "auto"} · ${output.strategy ?? "done"}`;
  }
  if (step.tool === "format_discovery_results") {
    return `Summarized ${step.input?.n_results ?? step.input?.n_papers ?? 0} ranked search results`;
  }
  return label;
}

function addAgentSteps(steps, searchQuery = "") {
  if (!steps || !steps.length) return;
  const container = document.getElementById("agent-chat-messages");
  const block = document.createElement("div");
  block.className = "message bot-message agent-trace-message";
  const content = document.createElement("div");
  content.className = "message-content agent-trace";
  const details = document.createElement("details");
  details.className = "agent-trace-details";
  const summary = document.createElement("summary");
  summary.textContent = `Agent trace (${steps.length} steps${searchQuery ? ` · “${searchQuery}”` : ""})`;
  details.appendChild(summary);
  const list = document.createElement("ol");
  list.className = "agent-trace-list";
  for (const step of steps) {
    const item = document.createElement("li");
    item.innerHTML = `<span class="agent-step-label">${escapeHTML(AGENT_STEP_LABELS[step.tool] || step.tool)}</span> ${escapeHTML(describeAgentStep(step))}`;
    list.appendChild(item);
  }
  details.appendChild(list);
  content.appendChild(details);
  block.appendChild(content);
  container.appendChild(block);
  container.scrollTop = container.scrollHeight;
}

function addSelectedPapersPanel(papers) {
  if (!papers || !papers.length) return;
  const container = document.getElementById("agent-chat-messages");
  const block = document.createElement("div");
  block.className = "message bot-message agent-papers-message";
  const content = document.createElement("div");
  content.className = "message-content agent-papers-used";
  const heading = document.createElement("div");
  heading.className = "agent-papers-heading";
  heading.textContent = `Papers used (${papers.length})`;
  content.appendChild(heading);
  const list = document.createElement("ol");
  list.className = "agent-papers-list";
  for (const paper of papers) {
    const item = document.createElement("li");
    const authors = paper.authors ? ` · ${paper.authors}` : "";
    item.innerHTML = `<strong>${formatMetadataInline(paper.title || "Untitled")}</strong> <span class="agent-paper-meta">(${escapeHTML(paper.year || "—")}${escapeHTML(authors)})</span>`;
    list.appendChild(item);
  }
  content.appendChild(list);
  block.appendChild(content);
  container.appendChild(block);
  container.scrollTop = container.scrollHeight;
}

async function sendViaFlask(message, documentIds, model, application, { agentMode = false } = {}) {
  const body = {
    message,
    document_ids: documentIds,
    search_top_k: searchTopK(),
    model,
    agent_mode: agentMode,
  };
  if (application && application !== "auto") body.application = application;

  const response = await fetch(api("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || payload.error || "Chat request failed");
  return payload;
}

function applyAgentSelection(payload) {
  if (!payload.document_ids) return;
  selectedDocumentIds.clear();
  for (const id of payload.document_ids) selectedDocumentIds.add(id);
  if (payload.search_results?.length) {
    searchResults = payload.search_results;
    searchScoreMode = payload.score_mode
      || (searchResults[0]?.score_label === "RRF" ? "rrf" : "bm25");
    const countEl = document.getElementById("result-count");
    if (countEl) {
      countEl.textContent = `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`;
    }
  }
  if (payload.search_query) {
    lastSearchQuery = payload.search_query;
    const queryInput = document.getElementById("publication-query");
    if (queryInput) queryInput.value = payload.search_query;
  } else if (payload.search_plan?.search_query) {
    lastSearchQuery = payload.search_plan.search_query;
    const queryInput = document.getElementById("publication-query");
    if (queryInput) queryInput.value = payload.search_plan.search_query;
  }
  renderPublicationResults();
  renderSelectedPublications();
  renderSavedPapers();
}

async function sendViaGradio(message, model, application) {
  if (!(await initializeGradioClient())) throw new Error("Unable to connect to HF Space.");

  const recentTurns = agentConversation.slice(-6);
  let question = message;
  if (recentTurns.length) {
    const transcript = recentTurns
      .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
      .join("\n\n");
    question = `RECENT CONVERSATION\n===================\n${transcript}\n\nCURRENT USER TASK\n=================\n${message}`;
  }

  const result = await agentApp.predict("/agent_run", {
    selected_model: model,
    application: application === "auto" ? "general_qa" : application,
    context: "",
    question,
    max_new_tokens: 900,
  });

  return typeof result?.data?.[0] === "string" && result.data[0].trim()
    ? result.data[0].trim()
    : "No response generated.";
}


// CSV intent is independent of selecting the multimodal path. Gallery Analyze & CSV
// always exports; normal figure/table questions default to grounded answer-only mode.
function mediaQuestionRequestsCsv(question) {
  const text = String(question || "").trim();
  if (!text) return false;
  if (/\b(?:csv|download|export|dataset|spreadsheet|digitiz(?:e|ation)|tabulat(?:e|ion))\b/i.test(text)) return true;
  if (/\b(?:provide|give|send|share|show)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:readable\s+)?(?:data|values|coordinates|points|observations)\b/i.test(text)) return true;
  if (/\b(?:i\s+(?:want|need|would\s+like)\s+(?:to\s+have\s+)?|show\s+me\s+)(?:all\s+)?(?:the\s+)?(?:readable\s+)?(?:data|dataset)\b/i.test(text)) return true;
  if (/\b(?:all|every)\s+(?:readable\s+)?(?:data|values|rows|columns|points|observations)\b/i.test(text)) return true;
  if (/\b(?:extract|transcribe)\b[^.!?]{0,120}\b(?:data|values|rows|columns|coordinates|points|measurements|observations|series)\b/i.test(text)) return true;
  if (/\b(?:data|values|rows|columns|coordinates|points|measurements|observations|series)\b[^.!?]{0,120}\b(?:extract|transcribe)\b/i.test(text)) return true;
  return false;
}

// Read a human-friendly source label without exposing internal labels such as table_01.
function mediaLabelFromText(text) {
  const m = String(text || "").match(/\b(table|figure|fig\.?)[\s_.:-]*0*(\d+)\b/i);
  if (!m) return null;
  const kind = m[1].toLowerCase() === "table" ? "table" : "figure";
  const number = Number(m[2]);
  if (!Number.isInteger(number) || number <= 0) return null;
  return { kind, number, displayLabel: `${kind === "table" ? "Table" : "Figure"} ${number}` };
}

// Hybrid source routing: explicit numbered source > unambiguous active source >
// clarification. Do not let unrelated paper-level research requests inherit media.
function mediaReferencesInQuestion(question) {
  const refs = [];
  const re = /\b(table|figure|fig\.?)[\s_.:#-]*0*(\d+)\b/ig;
  for (const match of String(question || "").matchAll(re)) {
    const kind = match[1].toLowerCase() === "table" ? "table" : "figure";
    const number = Number(match[2]);
    if (Number.isSafeInteger(number) && number > 0 &&
        !refs.some(ref => ref.kind === kind && ref.number === number)) {
      refs.push({kind, number, displayLabel: `${kind === "table" ? "Table" : "Figure"} ${number}`});
    }
  }
  return refs;
}

function mediaRoutingIntent(question) {
  const q = String(question || "").trim();
  const refs = mediaReferencesInQuestion(q);
  if (!refs.length && /\b(?:selected papers?|whole paper|entire paper|all papers|the publication|the article|literature review)\b/i.test(q)) {
    return {intent: false, explicit: [], followup: false, referencedKind: null};
  }
  if (!refs.length && lastMediaContext && /\b(?:research gaps?|knowledge gaps?|future research|main findings|summar(?:y|ize)|limitations?|methodology|research methods?)\b/i.test(q) &&
      !/\b(?:of|in|from|about|for)\s+(?:this|that|the)?\s*(?:figure|fig\.?|table|plot|chart)\b/i.test(q)) {
    return {intent: true, explicit: [], followup: true, referencedKind: null, scopeClarification: true};
  }
  if (refs.length) return {intent: true, explicit: refs, followup: false, referencedKind: null};
  // Whole-paper and unrelated tasks must never be hijacked by an active figure.
  if (/\b(?:paper|publication|article|study|literature|methodology|abstract|entire document|whole document)\b/i.test(q) &&
      !/\b(?:table|figure|fig\.?|chart|plot|diagram)\b/i.test(q)) {
    return {intent: false, explicit: [], followup: false, referencedKind: null};
  }
  const pluralSources = /\b(?:figures|tables|charts|plots|diagrams)\b/i.test(q);
  const named = q.match(/\b(?:the|this|that|same|previous|above|last|earlier)\s+(?:(?:same|above|previous|last|earlier|published|original|selected|analyzed|analysed|current|extracted)\s+){0,2}(table|figure|fig\.?|chart|plot|diagram)\b/i);
  const referencedKind = named ? (named[1].toLowerCase() === "table" ? "table" : "figure") : null;
  const assent = /^(?:yes|yeah|yep|sure|ok(?:ay)?|please do|go ahead|of course|no|no thanks)[.!]?$/i.test(q);
  const exportRequest = mediaQuestionRequestsCsv(q);
  const exportPhrase = exportRequest || /\b(?:extract|digitize|download|transcribe|export)\b/i.test(q);
  const followup = /^(?:how about|what about|and\b|what(?:'s| is| are)\b|does it|can you|could you|would you|please|explain|elaborate|compare|summarize|interpret|describe|tell me|show me|i want|i need|give me|provide|more details|why|how|is it|are they)\b/i.test(q);
  const deictic = /\b(?:it|its|this|that|these|those|them|above|previous|same|other|more|again)\b/i.test(q);
  const mediaTopic = /\b(?:axis|axes|value|range|maximum|minimum|trend|unit|concentration|index|parameter|classification|data|dataset|coordinate|point|sample|curve|line|series|error bar|legend|panel|table|figure|plot|chart)\b/i.test(q);
  // Keep context for short, topical conversational follow-ups, not arbitrary new subjects.
  const conversational = !!lastMediaContext && q.length <= 220 &&
    (assent || exportPhrase || !!named || followup || deictic || mediaTopic || q.split(/\s+/).length <= 4);
  const intent = pluralSources || !!named || exportPhrase || conversational;
  return {intent, explicit: [], followup: intent && !pluralSources, referencedKind,
          multipleUnspecified: pluralSources, assent};
}

// Determine whether a short affirmative reply can safely execute an explicit
// preceding offer. Generic model pleasantries must lead to clarification.
function mediaAssentAction(question) {
  const text = String(question || "").trim().toLowerCase();
  if (!/^(?:yes|yeah|yep|sure|ok(?:ay)?|please do|go ahead|of course)[.!]?$/.test(text)) return null;
  const answer = String(mediaDialog?.answer || "").trim();
  const lastLine = answer.split(/\n/).filter(x => x.trim()).slice(-2).join(" ");
  if (/\b(?:would you like|shall i|should i|do you want)\b[^?]*\b(?:csv|download|export|extract all data)\b/i.test(lastLine)) return "csv";
  if (/\b(?:would you like|shall i|should i|do you want)\b[^?]*\b(?:explain further|more detailed|further explanation|elaborate)\b/i.test(lastLine)) return "explain";
  return "clarify";
}

function matchingLastMediaContext(intent) {
  const previous = lastMediaContext;
  if (!intent.followup || !previous) return null;
  if (intent.referencedKind && intent.referencedKind !== previous.kind) return null;
  const selected = [...selectedDocumentIds];
  if (selected.length > 1) return null;
  if (selected.length === 1 && String(selected[0]) !== String(previous.paper?.document_id)) return null;
  if (selected.length === 0 && activeMediaDetailsPaper &&
      String(activeMediaDetailsPaper.document_id) !== String(previous.paper?.document_id)) return null;
  return previous;
}

function mediaClarificationText(intent) {
  if (intent.multipleUnspecified) return "Which figures or tables do you want to analyze? Please specify their numbers. For now, analyze one source at a time.";
  if (intent.explicit.length > 1) {
    return `Which source should I analyze: ${intent.explicit.map(ref => ref.displayLabel).join(" or ")}? Please specify one figure or table.`;
  }
  if (intent.referencedKind === "table") return "Which table do you mean? Please specify its number, such as Table 1.";
  if (intent.referencedKind === "figure") return "Which figure do you mean? Please specify its number, such as Figure 7.";
  return "Which figure or table should I analyze? Please specify its number, or use Analyze & CSV in the media gallery.";
}

function validatedMediaSource(payload, question) {
  // A single-figure/table chat request must return exactly the requested media.
  // Never show a different image or poison follow-up context with the first
  // source in an accidentally multi-media response.
  const sources = Array.isArray(payload?.sources) ? payload.sources :
    (Array.isArray(payload?.source_identifiers) ? payload.source_identifiers : []);
  const asked = mediaLabelFromText(question);
  if (!asked || sources.length !== 1) {
    throw new Error("Media source mismatch: expected one identified figure or table. Please retry.");
  }
  const source = sources[0];
  const actual = mediaLabelFromText(source?.label);
  if (!actual || actual.kind !== asked.kind || actual.number !== asked.number) {
    throw new Error(`Media source mismatch: requested ${asked.displayLabel}, but the service returned ${source?.label || "an unidentified source"}.`);
  }
  return actual;
}

function rememberMediaResult(payload, paper, question) {
  const label = validatedMediaSource(payload, question);
  if (paper && String(payload?.status || "ok") === "ok" &&
      !payload?.empty_answer && String(payload?.answer || "").trim()) {
    lastMediaContext = { paper, ...label };
    mediaDialog = {paperId: String(paper.document_id), label: label.displayLabel,
                   answer: String(payload.answer || ""), question: String(question || "")};
  }
}

// Resolve the exact selected publication to a media-indexed record. Different
// sources (/api/papers, search results, bookmarks, Details) may hold partial
// versions of the same paper. Never use an unrelated publication as fallback.
function validMediaIndex(paper) {
  if (!paper || paper.metadata_row_index == null || paper.metadata_row_index === "") return null;
  const raw = paper.metadata_row_index;
  if (typeof raw === "string" && !/^\d+$/.test(raw.trim())) return null;
  const index = Number(raw);
  return Number.isSafeInteger(index) && index >= 0 ? index : null;
}

function resolveMediaPublication(paper) {
  if (!paper) return null;
  const id = paper.document_id == null ? "" : String(paper.document_id);
  const matches = (candidate) => {
    if (!candidate) return false;
    if (id) return candidate.document_id != null && String(candidate.document_id) === id;
    // Without a stable document ID, only the original object is safe.
    return candidate === paper;
  };
  const candidates = [
    paper,
    activeMediaDetailsPaper,
    ...searchResults,
    ...savedRenderItems,
    ...savedPapers,
    ...papersById.values(),
  ].filter(matches);
  // Prefer actual search/gallery metadata, retaining the originally selected ID.
  const indexed = candidates.find(candidate => validMediaIndex(candidate) !== null);
  return indexed || paper;
}

async function sendMediaAnalysis(message, paper, exportCsv = false) {
  const resolvedPaper = resolveMediaPublication(paper);
  const index = validMediaIndex(resolvedPaper);
  if (index === null) {
    throw new Error("Source metadata unavailable for this publication. Reopen its Details or refresh the search results, then retry.");
  }
  const response = await fetch(api("/api/media/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: message, metadata_row_index: index, export_csv: exportCsv }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Media request failed (${response.status})`);
  return payload;
}

// Construct an informative filename from citation metadata, not model-generated prose.
function mediaCsvFilename(source) {
  const rawTitle = String(source?.paper_title || source?.paper_key || "");
  const basename = rawTitle.split(/[\\/]/).pop().trim();
  const match = basename.match(/^(.+?\bet al\.)\s*-\s*(\d{4})(?:\s*-\s*.*)?$/i)
    || basename.match(/^(.+?)\s*-\s*(\d{4})(?:\s*-\s*.*)?$/);
  let authors = match ? match[1].trim() : "";
  const year = match ? match[2] : (basename.match(/\b(?:19|20)\d{2}\b/) || [])[0] || "";
  if (!authors && basename) authors = basename.split(" - ")[0].trim();
  if (authors && !/\bet al\.?$/i.test(authors) && /,|\band\b/i.test(authors)) {
    authors = authors.split(/,|\band\b/i)[0].trim() + " et al.";
  }
  const labelRaw = String(source?.label || "").trim();
  const media = labelRaw.match(/\b(figure|fig|table)[ _.-]*0*(\d+)\b/i);
  const mediaLabel = media ? `${media[1].toLowerCase() === "table" ? "Table" : "Figure"} ${Number(media[2])}` : "Media";
  let description = String(source?.caption || "").replace(/^(?:fig(?:ure)?|table)\s*\d+[.:-]?\s*/i, "").trim();
  // File-safe, concise description; don't let separators create folders.
  const clean = value => String(value).replace(/[\\/:*?"<>|\x00-\x1F]/g, " ").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim();
  authors = clean(authors);
  description = clean(description);
  if (description.length > 75) description = description.slice(0, 75).replace(/\s+\S*$/, "").trim();
  const parts = [authors || "WaterScope-AI", year, mediaLabel, description].filter(Boolean);
  return `${parts.join(" - ")}.csv`;
}

// Render simple model-supplied Markdown tables as safe native HTML tables.
// Use textContent throughout: never inject model-generated HTML.
function cleanPublicMediaAnswer(value) {
  let text = String(value || "");
  text = text.replace(/\(\s*Source\s*\d+\s*;?\s*paper_id\s*=\s*[^);\s]+\s*;?\s*label\s*=\s*[^)]+\)/gi, "");
  text = text.replace(/\(\s*paper(?:_id)?\s*[:= ]\s*\d+\s*[,;]\s*label\s*[:= ]\s*(?:table|figure|fig)[_.-]0*\d+\s*\)/gi, "");
  text = text.replace(/\bSource\s*\d+\s*;\s*paper_id\s*=\s*[^;\s]+\s*;\s*label\s*=\s*(?:table|figure|fig)[_.-]0*\d+\b/gi, "");
  text = text.replace(/\(\s*(?:source\s*\d+\s*[,;:]?\s*)?paper_id\s*=\s*\d+\s*[,;]\s*label\s*=\s*(?:table|figure|fig)[_.-]0*\d+(?:\s*[,;]\s*p\.?\s*\d+)?\s*\)/gi, "");
  text = text.replace(/\bpaper_id\s*=\s*\d+\s*[,;]\s*label\s*=\s*(?:table|figure|fig)[_.-]0*\d+\b/gi, "");
  return text.replace(/\s+([,;:.])/g, "$1").trim();
}
function appendSafeInlineMarkdown(node, text) {
  const pattern = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`)/g;
  let last = 0, match;
  while ((match = pattern.exec(String(text))) !== null) {
    if (match.index > last) node.appendChild(document.createTextNode(text.slice(last, match.index)));
    const tag = match[2] != null ? "strong" : match[3] != null ? "em" : "code";
    const span = document.createElement(tag);
    span.textContent = match[2] ?? match[3] ?? match[4];
    node.appendChild(span);
    last = pattern.lastIndex;
  }
  if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
}
function renderMediaAnswerInto(container, rawAnswer) {
  const lines = cleanPublicMediaAnswer(rawAnswer).split(/\r?\n/);
  const parseCells = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(v => v.trim());
  const isSeparator = line => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    p.className = "media-answer-paragraph";
    appendSafeInlineMarkdown(p, paragraph.join(" ").trim());
    container.appendChild(p); paragraph = [];
  };
  for (let i = 0; i < lines.length;) {
    if (i + 1 < lines.length && lines[i].includes("|") && isSeparator(lines[i+1])) {
      flush();
      const headers = parseCells(lines[i]);
      const table = document.createElement("table"); table.className = "media-answer-table";
      const thead = document.createElement("thead"), headRow = document.createElement("tr");
      headers.forEach(h => { const th=document.createElement("th"); appendSafeInlineMarkdown(th,h); headRow.appendChild(th); });
      thead.appendChild(headRow);table.appendChild(thead);
      const tbody=document.createElement("tbody"); i+=2;
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].includes("|")) {
        const cells=parseCells(lines[i]); if (cells.length !== headers.length) break;
        const row=document.createElement("tr"); cells.forEach(c => { const td=document.createElement("td");appendSafeInlineMarkdown(td,c);row.appendChild(td); });
        tbody.appendChild(row);i++;
      }
      table.appendChild(tbody);
      const wrap=document.createElement("div");wrap.className="media-answer-table-wrap";wrap.appendChild(table);container.appendChild(wrap);
      continue;
    }
    if (!lines[i].trim()) { flush();i++;continue; }
    if (/^\s*#{1,4}\s+/.test(lines[i])) {
      flush();
      const heading = document.createElement("div");
      heading.className = "media-answer-heading";
      appendSafeInlineMarkdown(heading, lines[i].replace(/^\s*#{1,4}\s+/, ""));
      container.appendChild(heading); i++; continue;
    }
    if (/^\s*[-*]\s+/.test(lines[i])) {
      flush(); const list = document.createElement("ul");list.className="media-answer-list";
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item=document.createElement("li"); appendSafeInlineMarkdown(item, lines[i].replace(/^\s*[-*]\s+/, ""));
        list.appendChild(item);i++;
      }
      container.appendChild(list);continue;
    }
    paragraph.push(lines[i].trim());i++;
  }
  flush();
}

function appendMediaAnalysisResult(payload, {repeatSource=false} = {}) {
  const container = document.getElementById("agent-chat-messages");
  if (!container) return;
  const sources = Array.isArray(payload?.sources) ? payload.sources :
    (Array.isArray(payload?.source_identifiers) ? payload.source_identifiers : []);
  const source = sources[0] || {};
  const attachment = payload?.csv_attachment;
  const kind = String(source.kind || "").toLowerCase();
  const label = String(source.label || "").replace(/_/g, " ") || "Source media";
  const card = document.createElement("div");
  card.className = "message bot-message media-result-message";
  const content = document.createElement("div");
  content.className = "message-content media-result-content";

  const header = document.createElement("div");
  header.className = "media-result-header";
  const title = document.createElement("strong");
  title.textContent = `${label.replace(/\b\w/g, c => c.toUpperCase())} · Media analysis`;
  header.appendChild(title);
  if (kind === "figure" || kind === "table") {
    const tag = document.createElement("span");
    tag.className = "media-result-tag";
    tag.textContent = kind === "figure"
      ? (attachment?.content_base64 ? "Estimated chart data" : "Figure interpretation")
      : (attachment?.content_base64 ? "Table transcription" : "Table interpretation");
    header.appendChild(tag);
  }
  content.appendChild(header);

  const mediaUrl = resolveApiUrl(source.image_url);
  if (!repeatSource && mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
    const mediaButton = document.createElement("button");
    mediaButton.type = "button";
    mediaButton.className = "media-result-image-button";
    mediaButton.title = "Enlarge original figure/table";
    const image = document.createElement("img");
    image.src = mediaUrl;
    image.alt = `${label}: ${String(source.caption || "Published media")}`;
    image.loading = "lazy";
    mediaButton.appendChild(image);
    mediaButton.addEventListener("click", () => openFigureLightbox(mediaUrl, String(source.caption || ""), label));
    content.appendChild(mediaButton);
  }

  if (!repeatSource && source.caption) {
    const caption = document.createElement("p");
    caption.className = "media-result-caption";
    caption.textContent = String(source.caption);
    content.appendChild(caption);
  }
  const attribution = [source.paper_title || source.paper_key, source.page != null ? `Page ${source.page}` : ""]
    .filter(Boolean).join(" · ");
  if (!repeatSource && attribution) {
    const cite = document.createElement("div");
    cite.className = "media-result-source";
    cite.textContent = `Source: ${attribution}`;
    content.appendChild(cite);
  }
  const heading = document.createElement("div");
  heading.className = "media-result-subheading";
  heading.textContent = attachment?.content_base64 ? "Scientific summary" : "Answer";
  content.appendChild(heading);
  const summary = document.createElement("p");
  summary.className = "media-result-summary";
  renderMediaAnswerInto(summary, payload?.answer || "No extraction summary generated.");
  content.appendChild(summary);

  if (attachment?.content_base64 && attachment.encoding === "base64") {
    const controls = document.createElement("div");
    controls.className = "media-result-download";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-secondary";
    btn.textContent = `Download extracted CSV (${Number(attachment.row_count) || 0} rows)`;
    btn.addEventListener("click", () => {
      try {
        const binary = atob(attachment.content_base64);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        const blobUrl = URL.createObjectURL(new Blob([bytes], {type:"text/csv;charset=utf-8"}));
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = mediaCsvFilename(source);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      } catch (error) { console.error("Media CSV download error:", error); alert("Unable to prepare CSV download."); }
    });
    controls.appendChild(btn);
    content.appendChild(controls);
    const note = document.createElement("p");
    note.className = "media-result-note";
    note.textContent = kind === "figure"
      ? "Chart-derived numerical values are visual estimates; verify coordinates and any omitted error bars before quantitative use."
      : "Values are transcribed from the published table; verify against the source before quantitative use.";
    content.appendChild(note);
  }
  if (payload?.export_warning) {
    const warning = document.createElement("p");
    warning.className = "media-result-warning";
    warning.textContent = `CSV unavailable: ${payload.export_warning}`;
    content.appendChild(warning);
  }
  card.appendChild(content);
  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

async function sendAgentMessage() {
  const input = document.getElementById("agent-user-input");
  const visibleMessage = input.value.trim();
  if (!visibleMessage || agentProcessing) return;

  const model = document.getElementById("agent-model").value;
  let application = document.getElementById("agent-task").value;
  const documentIds = [...selectedDocumentIds];
  const agentMode = document.getElementById("agent-mode").checked;
  const agentDiscovery = agentMode && documentIds.length === 0;
  const routing = pendingMediaPaper
    ? {intent: true, explicit: mediaReferencesInQuestion(visibleMessage), followup: false, referencedKind: null}
    : mediaRoutingIntent(visibleMessage);
  const selectedMediaPaper = documentIds.length === 1
    ? resolveMediaPublication(
        searchResults.find(paper => String(paper.document_id) === String(documentIds[0]))
        || (activeMediaDetailsPaper && String(activeMediaDetailsPaper.document_id) === String(documentIds[0]) ? activeMediaDetailsPaper : null)
        || savedRenderItems.find(paper => String(paper.document_id) === String(documentIds[0]))
        || savedPapers.find(paper => String(paper.document_id) === String(documentIds[0]))
        || papersById.get(documentIds[0])
        || [...papersById.values()].find(paper => String(paper.document_id) === String(documentIds[0]))
      )
    : null;
  const activeFollowup = matchingLastMediaContext(routing);
  const mediaPaper = resolveMediaPublication(pendingMediaPaper ||
    (routing.explicit.length === 1
      ? (selectedMediaPaper || (documentIds.length === 0 ? activeMediaDetailsPaper : null))
      : activeFollowup?.paper || null));
  const assentAction = routing.assent && activeFollowup ? mediaAssentAction(visibleMessage) : null;
  const needsClarification = routing.intent && !pendingMediaPaper &&
    (routing.explicit.length > 1 || routing.multipleUnspecified || routing.scopeClarification || !mediaPaper ||
     assentAction === "clarify" || (routing.assent && /^no\b/i.test(visibleMessage)));
  const mediaIntent = routing.intent;
  // Backend media selection reads numbered references from the question. For
  // contextual follow-ups, add exactly the resolved single label (no examples).
  // Only the one resolved label is appended; never include sample labels
  // that could be accidentally interpreted as additional media sources.
  const contextual = activeFollowup && routing.explicit.length === 0;
  const previousTopic = contextual ? String(mediaDialog?.question || "").slice(0, 260) : "";
  // Keep a short preceding answer for conversational continuity. Remove any
  // numbered media labels to prevent accidental multi-source selection.
  const previousAnswer = contextual ? String(mediaDialog?.answer || "")
    .replace(/\b(?:table|figure|fig\.?)[\s_.:#-]*0*\d+\b/ig, "the current source")
    .replace(/\b(?:paper_id|metadata_row_index|label)\s*[=:]\s*[^\s,;)]*/ig, "")
    .slice(0, 700) : "";
  const mediaQuestion = contextual
    ? assentAction === "csv"
      ? `Extract all readable data from ${activeFollowup.displayLabel} and provide a CSV.`
      : assentAction === "explain"
        ? `Explain ${activeFollowup.displayLabel} in greater detail, continuing the prior discussion.`
        : `Regarding ${activeFollowup.displayLabel}, previous question: ${previousTopic}. Previous answer (context only): ${previousAnswer}. Follow-up: ${visibleMessage}`
    : visibleMessage;
  const mediaExportCsv = pendingMediaExport || assentAction === "csv" || mediaQuestionRequestsCsv(visibleMessage);
  pendingMediaPaper = null;
  pendingMediaExport = false;
  const isMediaRequest = mediaIntent && !!mediaPaper && !needsClarification;

  addAgentMessage(visibleMessage, "user");
  input.value = "";
  agentProcessing = true;
  setAgentControlsDisabled(true);
  startModelOperationStatus(mediaIntent ? "media" : "llama");

  if (agentDiscovery && !isMediaRequest) {
    clearPublicationResultsForAgentSearch();
    startSearchOperationStatus();
    setPublicationSearchControlsDisabled(true);
  }

  try {
    let payload;
    if (needsClarification) {
      const reply = routing.scopeClarification
        ? `Would you like me to discuss ${visibleMessage.toLowerCase().includes("gap") ? "research gaps" : "the question"} in the selected publication or discuss what ${lastMediaContext?.displayLabel || "the current figure"} shows? Please specify “the paper” or “the figure/table”.`
        : assentAction === "clarify"
        ? "Certainly. What would you like me to do with the current figure or table—explain it further, extract the data as CSV, or change the presentation?"
        : routing.assent && /^no\b/i.test(visibleMessage)
          ? "Understood. What would you like to explore next?"
          : mediaClarificationText(routing);
      addAgentMessage(reply, "assistant");
      agentConversation.push({role: "user", content: visibleMessage});
      agentConversation.push({role: "assistant", content: reply});
      if (activeFollowup) mediaDialog = {...(mediaDialog || {}), answer: reply};
      finishModelOperationStatus("Clarification needed", "status-ready", "media");
      return;
    }
    if (isMediaRequest) {
      payload = await sendMediaAnalysis(mediaQuestion, mediaPaper, mediaExportCsv);
      validatedMediaSource(payload, mediaQuestion);
      const matched = validatedMediaSource(payload, mediaQuestion);
      const mediaKey = `${String(mediaPaper.document_id)}:${matched.kind}:${matched.number}`;
      const repeatSource = mediaKey === lastRenderedMediaKey;
      rememberMediaResult(payload, mediaPaper, mediaQuestion);
      agentConversation.push({ role: "user", content: visibleMessage });
      agentConversation.push({ role: "assistant", content: payload.answer || "" });
      appendMediaAnalysisResult(payload, {repeatSource});
      lastRenderedMediaKey = mediaKey;
      finishModelOperationStatus("Processed", "status-ready", "media");
      return;
    } else if (documentIds.length > 0) {
      payload = await sendViaFlask(visibleMessage, documentIds, model, application, { agentMode: false });
    } else if (agentMode) {
      payload = await sendViaFlask(visibleMessage, [], model, application, { agentMode: true });
      applyAgentSelection(payload);
      addAgentSteps(payload.agent_steps, payload.search_query);
    } else {
      const reply = await sendViaGradio(visibleMessage, model, application);
      agentConversation.push({ role: "user", content: visibleMessage });
      agentConversation.push({ role: "assistant", content: reply });
      addAgentMessage(reply, "assistant");
      finishModelOperationStatus();
      return;
    }

    agentConversation.push({ role: "user", content: visibleMessage });
    agentConversation.push({ role: "assistant", content: payload.answer });
    addAgentMessage(payload.answer || "No response generated.", "assistant", { html: true });
    if (String(payload.strategy || "").startsWith("deepseek_fallback:")) {
      addAgentMessage("Research answer generated using the fallback model because Llama was unavailable.", "assistant");
    }
    if (payload.agent_mode && !payload.discovery_mode && (payload.selected_papers || payload.sources)?.length) {
      addSelectedPapersPanel(payload.selected_papers || payload.sources);
    }
    finishModelOperationStatus();
    if (agentDiscovery) finishSearchOperationStatus();
  } catch (error) {
    console.error("Agent request error:", error);
    addAgentMessage(`Sorry, the request could not be completed: ${error.message}`, "assistant");
    const sourceProblem = mediaIntent && /^(?:Source metadata unavailable|Media source mismatch|Select (?:just )?one paper|I can't identify which figure|Select one publication)/i.test(String(error.message || ""));
    finishModelOperationStatus(sourceProblem ? "Source issue" : "Connection issue", "status-error", mediaIntent ? "media" : "llama");
    if (agentDiscovery) finishSearchOperationStatus("Connection issue", "status-error");
  } finally {
    agentProcessing = false;
    setAgentControlsDisabled(false);
    if (agentDiscovery) setPublicationSearchControlsDisabled(false);
    input.focus();
  }
}

function setPublicationSearchControlsDisabled(disabled) {
  const searchButton = document.getElementById("publication-search");
  const queryInput = document.getElementById("publication-query");
  const topKSelect = document.getElementById("search-top-k");
  if (searchButton) searchButton.disabled = disabled;
  if (queryInput) queryInput.disabled = disabled;
  if (topKSelect) topKSelect.disabled = disabled;
}

function setAgentControlsDisabled(disabled) {
  document.getElementById("send-agent-message").disabled = disabled;
  document.getElementById("agent-user-input").disabled = disabled;
  document.getElementById("agent-model").disabled = disabled;
  document.getElementById("agent-task").disabled = disabled;
}

function clearAgentChat() {
  agentConversation = [];
  lastMediaContext = null;
  mediaDialog = null;
  lastRenderedMediaKey = null;
  document.getElementById("agent-chat-messages").innerHTML = `
    <div class="message bot-message"><div class="message-content"><p>Chat cleared. Search and select papers for retrieval-grounded chat, or ask a general question.</p></div></div>`;
}

let agentWorkspaceView = "split";

function setPanelToggleIcon(button, iconClass) {
  if (!button) return;
  const icon = button.querySelector("i");
  if (icon) icon.className = `fas ${iconClass}`;
}

function setAgentWorkspaceView(view) {
  const workspace = document.getElementById("agent-workspace");
  const leftToggle = document.getElementById("toggle-publications-panel");
  const rightToggle = document.getElementById("toggle-agent-chat-panel");

  agentWorkspaceView = view;
  workspace.classList.remove("view-left", "view-right");

  if (view === "left") {
    workspace.classList.add("view-left");
    setPanelToggleIcon(leftToggle, "fa-angles-left");
    leftToggle.title = "Restore split view";
    leftToggle.setAttribute("aria-label", "Restore split view");
    setPanelToggleIcon(rightToggle, "fa-angles-left");
  } else if (view === "right") {
    workspace.classList.add("view-right");
    setPanelToggleIcon(rightToggle, "fa-angles-right");
    rightToggle.title = "Restore split view";
    rightToggle.setAttribute("aria-label", "Restore split view");
    setPanelToggleIcon(leftToggle, "fa-angles-right");
  } else {
    setPanelToggleIcon(leftToggle, "fa-angles-right");
    leftToggle.title = "Expand publication panel";
    leftToggle.setAttribute("aria-label", "Expand publication panel");
    setPanelToggleIcon(rightToggle, "fa-angles-left");
    rightToggle.title = "Expand Agent chat panel";
    rightToggle.setAttribute("aria-label", "Expand Agent chat panel");
  }

  saveAgentSessionState();
}

document.addEventListener("DOMContentLoaded", async () => {
  updateAgentModelTimer();
  const restoredSession = restoreAgentSessionState();

  updateResearchTaskOptions();
  renderSelectedPublications();
  renderPublicationResults();

  if (restoredSession) {
    const countEl = document.getElementById("result-count");
    const topK = searchTopK();
    if (countEl && searchResults.length) {
      countEl.textContent = `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} (top ${topK})`;
    }
    setAgentWorkspaceView(agentWorkspaceView);
  }

  document.getElementById("toggle-publications-panel").addEventListener("click", () => {
    setAgentWorkspaceView(agentWorkspaceView === "left" ? "split" : "left");
  });
  document.getElementById("toggle-agent-chat-panel").addEventListener("click", () => {
    setAgentWorkspaceView(agentWorkspaceView === "right" ? "split" : "right");
  });
  document.getElementById("open-publications-panel").addEventListener("click", () => setAgentWorkspaceView("left"));
  document.getElementById("open-agent-chat-panel").addEventListener("click", () => setAgentWorkspaceView("right"));

  document.getElementById("publication-search").addEventListener("click", () => {
    runPublicationSearch().catch((error) => {
      document.getElementById("result-count").textContent = "Search failed";
      addAgentMessage(error.message, "assistant");
    });
  });
  document.getElementById("publication-query").addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.getElementById("publication-search").click();
  });
  document.getElementById("show-all-papers").addEventListener("click", () => {
    document.getElementById("publication-query").value = "water sustainability";
    document.getElementById("publication-search").click();
  });
  document.getElementById("search-top-k").addEventListener("change", () => {
    searchResultsPage = 0;
    saveAgentSessionState();
    if (lastSearchQuery) {
      runPublicationSearch().catch((error) => {
        document.getElementById("result-count").textContent = "Search failed";
        addAgentMessage(error.message, "assistant");
      });
    }
  });
  document.getElementById("search-results-prev")?.addEventListener("click", () => {
    if (searchResultsPage > 0) {
      searchResultsPage -= 1;
      renderPublicationResults();
      saveAgentSessionState();
      document.getElementById("publication-results")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  document.getElementById("search-results-next")?.addEventListener("click", () => {
    const info = getSearchResultsPageInfo();
    if (info.paginated && info.page < info.pageCount - 1) {
      searchResultsPage += 1;
      renderPublicationResults();
      saveAgentSessionState();
      document.getElementById("publication-results")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  document.getElementById("clear-selected").addEventListener("click", clearAllSelectedPapers);
  document.getElementById("clear-selected-top")?.addEventListener("click", clearAllSelectedPapers);
  document.getElementById("clear-selected-help")?.addEventListener("click", clearAllSelectedPapers);
  document.getElementById("agent-mode")?.addEventListener("change", () => {
    renderSelectedPublications();
  });
  document.querySelectorAll(".sample-query-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.query || "";
      if (button.dataset.target === "agent") {
        runSampleAgentPrompt(query);
        return;
      }
      runSamplePublicationQuery(query).catch((error) => {
        document.getElementById("result-count").textContent = "Search failed";
        addAgentMessage(error.message, "assistant");
      });
    });
  });
  document.getElementById("send-agent-message").addEventListener("click", sendAgentMessage);
  document.getElementById("agent-user-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendAgentMessage();
    }
  });
  document.getElementById("clear-agent-chat").addEventListener("click", clearAgentChat);
  document.querySelectorAll(".suggestion-chip").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("agent-user-input").value = button.dataset.prompt;
      document.getElementById("agent-user-input").focus();
    });
  });

  // Start the model API immediately when the page opens so the
  // WaterScopeAI model Space can wake in parallel with the search Space.
  const modelConnectionPromise = initializeGradioClient();
  const searchConnectionPromise = checkFlaskApi();

  const ok = await searchConnectionPromise;
  if (ok) {
    try {
      await loadPapersIndex();
      await loadSavedPapers();
    } catch (error) {
      console.error(error);
      addAgentMessage(error.message, "assistant");
    }
  }

  // The model connection has already been running in parallel.
  await modelConnectionPromise;
});


document.addEventListener("visibilitychange", () => { if (!document.hidden) updateAgentModelTimer(); });
