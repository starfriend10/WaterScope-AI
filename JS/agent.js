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

function canChat(documentId) {
  if (!documentId) return false;
  const paper = papersById.get(documentId);
  if (paper) return Boolean(paper.has_summary);
  // Paper index still loading — allow if search already linked this document.
  return searchResults.some((row) => row.document_id === documentId);
}

async function checkFlaskApi() {
  try {
    setSearchSystemStatus("Connecting…", "status-processing");
    const response = await fetch(api("/api/health"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    setSearchSystemStatus(payload.status === "ok" ? "Connected" : "Degraded", "status-ready");
    return true;
  } catch (error) {
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
    setChatModelStatus("Connected", "status-ready");
    return true;
  }

  if (modelConnectionInProgress) return false;
  modelConnectionInProgress = true;

  try {
    startAgentModelTimer();
    if (!agentProcessing) {
      setChatModelStatus(modelStartupStatusMessage(), "status-processing");
    }

    const runtimeBeforeConnect = await getHfSpaceRuntimeState();
    if (runtimeBeforeConnect.stage === "RUNTIME_ERROR") {
      finishAgentModelTimer();
      if (!agentProcessing) setChatModelStatus("Unavailable", "status-error");
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
    if (!agentProcessing) setChatModelStatus("Connected", "status-ready");
    return true;
  } catch (error) {
    console.error("Chat model connection error:", error);

    const runtimeAfterConnect = await getHfSpaceRuntimeState();
    if (runtimeAfterConnect.stage === "RUNTIME_ERROR") {
      finishAgentModelTimer();
      if (!agentProcessing) setChatModelStatus("Unavailable", "status-error");
      console.error(
        "HF Space runtime error:",
        runtimeAfterConnect.errorText || "RUNTIME_ERROR"
      );
    } else {
      if (!agentProcessing) {
        setChatModelStatus(modelStartupStatusMessage(), "status-processing");
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
  const query = document.getElementById("publication-query").value.trim();
  if (!query) {
    document.getElementById("result-count").textContent = "Enter a search query";
    return;
  }

  document.getElementById("result-count").textContent = "Searching…";
  const topK = searchTopK();
  const response = await fetch(api(`/api/search?q=${encodeURIComponent(query)}&top_k=${topK}`));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Search failed");

  lastSearchQuery = payload.search_query || query;
  if (payload.search_query && payload.search_query !== query) {
    document.getElementById("publication-query").value = payload.search_query;
  }
  searchResults = payload.results || [];
  searchResultsPage = 0;
  searchScoreMode = payload.score_mode || "rrf";
  const excluded = payload.query_parsed?.excluded_phrases || [];
  let countText = `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} (top ${topK})`;
  if (excluded.length) {
    countText += ` · excluded: ${excluded.join(", ")}`;
  }
  document.getElementById("result-count").textContent = countText;
  renderPublicationResults();
  saveAgentSessionState();
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
        <button
          type="button"
          class="figure-thumb${extraClass}"
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
        </button>`;
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
    wireFigureGallery(body);
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

function wireFigureGallery(container) {
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
  if (!willOpen) return;

  panel.classList.remove("hidden");
  container.querySelectorAll(`[data-result-index="${index}"].paper-card-menu-btn, [data-result-index="${index}"].btn-details`).forEach((button) => {
    button.setAttribute("aria-expanded", "true");
  });
  const item = items[Number(index)];
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

  document.getElementById("context-status").textContent = count
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
  setAgentWorkspaceView("right");
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
  format_discovery_results: "Format paper list",
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
    return `Listed ${step.input?.n_papers ?? 0} papers in search order`;
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

async function sendAgentMessage() {
  const input = document.getElementById("agent-user-input");
  const visibleMessage = input.value.trim();
  if (!visibleMessage || agentProcessing) return;

  addAgentMessage(visibleMessage, "user");
  input.value = "";
  agentProcessing = true;
  setAgentControlsDisabled(true);
  setChatModelStatus("Processing…", "status-processing");

  const model = document.getElementById("agent-model").value;
  let application = document.getElementById("agent-task").value;
  const documentIds = [...selectedDocumentIds];
  const agentMode = document.getElementById("agent-mode").checked;

  try {
    let payload;
    if (documentIds.length > 0) {
      payload = await sendViaFlask(visibleMessage, documentIds, model, application, { agentMode: false });
    } else if (agentMode) {
      setChatModelStatus("Processing…", "status-processing");
      payload = await sendViaFlask(visibleMessage, [], model, application, { agentMode: true });
      applyAgentSelection(payload);
      addAgentSteps(payload.agent_steps, payload.search_query);
    } else {
      const reply = await sendViaGradio(visibleMessage, model, application);
      agentConversation.push({ role: "user", content: visibleMessage });
      agentConversation.push({ role: "assistant", content: reply });
      addAgentMessage(reply, "assistant");
      setChatModelStatus("Connected", "status-ready");
      return;
    }

    agentConversation.push({ role: "user", content: visibleMessage });
    agentConversation.push({ role: "assistant", content: payload.answer });
    addAgentMessage(payload.answer || "No response generated.", "assistant", { html: true });
    if (payload.agent_mode && !payload.discovery_mode && (payload.selected_papers || payload.sources)?.length) {
      addSelectedPapersPanel(payload.selected_papers || payload.sources);
    }
    setChatModelStatus("Connected", "status-ready");
  } catch (error) {
    console.error("Agent request error:", error);
    addAgentMessage(`Sorry, the request could not be completed: ${error.message}`, "assistant");
    setChatModelStatus("Connection issue", "status-error");
  } finally {
    agentProcessing = false;
    setAgentControlsDisabled(false);
    input.focus();
  }
}

function setAgentControlsDisabled(disabled) {
  document.getElementById("send-agent-message").disabled = disabled;
  document.getElementById("agent-user-input").disabled = disabled;
  document.getElementById("agent-model").disabled = disabled;
  document.getElementById("agent-task").disabled = disabled;
}

function clearAgentChat() {
  agentConversation = [];
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
