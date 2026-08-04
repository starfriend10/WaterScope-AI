let agentApp = null;
let publications = [];
let filteredPublications = [];
let selectedPublicationIds = new Set();
let agentConversation = [];
let agentProcessing = false;

const SPACE_ID = "EnvironmentalAI/WaterScopeAI";

const RESEARCH_TASKS = [
    { value: "general_qa", label: "General environmental QA", minPapers: 0 },
    { value: "document_qa", label: "Document-grounded QA", minPapers: 1 },
    { value: "paper_synthesis", label: "Multi-paper synthesis", minPapers: 2 },
    { value: "method_recommendation", label: "Method recommendation", minPapers: 0 },
    { value: "research_gaps", label: "Research-gap identification", minPapers: 1 },
    { value: "claim_check", label: "Unsupported-claim check", minPapers: 1 }
];

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setAgentAPIStatus(message, type = "") {
    const status = document.getElementById("agent-api-status");
    status.textContent = message;
    status.classList.remove("status-processing", "status-ready", "status-error");
    if (type) status.classList.add(type);
}

async function initializeAgentClient() {
    if (agentApp) return true;
    try {
        setAgentAPIStatus("Connecting...", "status-processing");
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        agentApp = await Client.connect(SPACE_ID);
        setAgentAPIStatus("Connected", "status-ready");
        return true;
    } catch (error) {
        console.error("Agent connection error:", error);
        setAgentAPIStatus("Connection failed", "status-error");
        return false;
    }
}

async function loadPublications() {
    const response = await fetch("Data/publications.json");
    if (!response.ok) throw new Error(`Could not load publications (${response.status})`);
    publications = await response.json();
    filteredPublications = [...publications];
    renderPublicationResults();
}

function searchableText(paper) {
    return [paper.title, paper.year, paper.journal, paper.keywords, paper.abstract, paper.fulltext]
        .join(" ")
        .toLowerCase();
}

function runPublicationSearch() {
    const query = document.getElementById("publication-query").value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    filteredPublications = terms.length === 0
        ? [...publications]
        : publications.filter(paper => terms.every(term => searchableText(paper).includes(term)));
    renderPublicationResults();
}

function renderPublicationResults() {
    const container = document.getElementById("publication-results");
    document.getElementById("result-count").textContent = `${filteredPublications.length} publication${filteredPublications.length === 1 ? "" : "s"}`;

    if (filteredPublications.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-search"></i><p>No matching publications.</p></div>';
        return;
    }

    container.innerHTML = filteredPublications.map(paper => {
        const checked = selectedPublicationIds.has(paper.id) ? "checked" : "";
        const abstract = paper.abstract || paper.fulltext || "No abstract available.";
        return `
            <article class="publication-card ${checked ? "selected" : ""}" data-id="${paper.id}">
                <label class="paper-checkbox" aria-label="Select publication">
                    <input type="checkbox" data-paper-id="${paper.id}" ${checked}>
                    <span></span>
                </label>
                <div class="publication-card-content">
                    <div class="publication-meta">
                        <span>${escapeHTML(paper.year || "Year unavailable")}</span>
                        <span>${escapeHTML(paper.journal || "Journal unavailable")}</span>
                    </div>
                    <h4>${escapeHTML(paper.title)}</h4>
                    <p>${escapeHTML(abstract.slice(0, 260))}${abstract.length > 260 ? "…" : ""}</p>
                    <div class="keyword-line"><i class="fas fa-tags"></i> ${escapeHTML(paper.keywords || "No publication keywords")}</div>
                </div>
            </article>`;
    }).join("");

    container.querySelectorAll('input[type="checkbox"][data-paper-id]').forEach(input => {
        input.addEventListener("change", () => togglePublication(Number(input.dataset.paperId)));
    });
}

function togglePublication(id) {
    if (selectedPublicationIds.has(id)) selectedPublicationIds.delete(id);
    else selectedPublicationIds.add(id);
    renderPublicationResults();
    renderSelectedPublications();
}

function updateResearchTaskOptions() {
    const select = document.getElementById("agent-task");
    const paperCount = selectedPublicationIds.size;
    const previousValue = select.value;

    select.innerHTML = RESEARCH_TASKS.map(task => {
        const disabled = paperCount < task.minPapers;
        const requirement = task.minPapers === 1 ? " (select a paper)" : task.minPapers === 2 ? " (select 2+ papers)" : "";
        return `<option value="${task.value}" ${disabled ? "disabled" : ""}>${task.label}${disabled ? requirement : ""}</option>`;
    }).join("");

    const previousStillAvailable = [...select.options].some(option => option.value === previousValue && !option.disabled);
    if (previousStillAvailable) {
        select.value = previousValue;
    } else if (paperCount >= 2) {
        select.value = "paper_synthesis";
    } else if (paperCount === 1) {
        select.value = "document_qa";
    } else {
        select.value = "general_qa";
    }
}

function renderSelectedPublications() {
    const selected = publications.filter(p => selectedPublicationIds.has(p.id));
    const count = selected.length;
    document.getElementById("selected-count").textContent = count;
    document.getElementById("context-status").textContent = count ? `${count} paper${count === 1 ? "" : "s"} selected` : "No papers selected";
    document.getElementById("chat-context-description").textContent = count ? `Grounded in ${count} selected paper${count === 1 ? "" : "s"}` : "General chat mode";
    updateResearchTaskOptions();

    const container = document.getElementById("selected-paper-list");
    if (!count) {
        container.innerHTML = '<p class="empty-state">No papers selected. General chat remains available.</p>';
        return;
    }
    container.innerHTML = selected.map(paper => `
        <div class="selected-paper-item">
            <span>${escapeHTML(paper.title)}</span>
            <button data-remove-paper="${paper.id}" title="Remove"><i class="fas fa-times"></i></button>
        </div>`).join("");
    container.querySelectorAll("[data-remove-paper]").forEach(button => {
        button.addEventListener("click", () => togglePublication(Number(button.dataset.removePaper)));
    });
}

function buildSelectedPaperContext() {
    const selected = publications.filter(p => selectedPublicationIds.has(p.id));
    if (!selected.length) return "";
    return selected.map((paper, index) => `PUBLICATION ${index + 1}\nTitle: ${paper.title}\nYear: ${paper.year}\nJournal: ${paper.journal}\nKeywords: ${paper.keywords}\nAbstract: ${paper.abstract}\nFull text:\n${paper.fulltext}`)
        .join("\n\n==============================\n\n");
}

function buildQuestionWithConversation(currentQuestion) {
    const recentTurns = agentConversation.slice(-6);
    if (!recentTurns.length) return currentQuestion;
    const transcript = recentTurns.map(turn => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`).join("\n\n");
    return `RECENT CONVERSATION\n===================\n${transcript}\n\nCURRENT USER TASK\n=================\n${currentQuestion}`;
}

function addAgentMessage(text, role) {
    const container = document.getElementById("agent-chat-messages");
    const message = document.createElement("div");
    message.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
    const content = document.createElement("div");
    content.className = "message-content";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    content.appendChild(paragraph);
    message.appendChild(content);
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

async function sendAgentMessage() {
    const input = document.getElementById("agent-user-input");
    const visibleMessage = input.value.trim();
    if (!visibleMessage || agentProcessing) return;

    addAgentMessage(visibleMessage, "user");
    input.value = "";
    agentProcessing = true;
    setAgentControlsDisabled(true);
    setAgentAPIStatus("Processing...", "status-processing");

    try {
        if (!(await initializeAgentClient())) throw new Error("Unable to connect to the AI service.");

        const selectedModel = document.getElementById("agent-model").value;
        const application = document.getElementById("agent-task").value;
        const context = buildSelectedPaperContext();
        const question = buildQuestionWithConversation(visibleMessage);

        const result = await agentApp.predict("/agent_run", {
            selected_model: selectedModel,
            application: application,
            context: context,
            question: question,
            max_new_tokens: 900
        });

        const reply = typeof result?.data?.[0] === "string" && result.data[0].trim()
            ? result.data[0].trim()
            : "No response generated.";

        agentConversation.push({ role: "user", content: visibleMessage });
        agentConversation.push({ role: "assistant", content: reply });
        addAgentMessage(reply, "assistant");
        setAgentAPIStatus("Response received", "status-ready");
    } catch (error) {
        console.error("Agent request error:", error);
        addAgentMessage(`Sorry, the request could not be completed: ${error.message}`, "assistant");
        setAgentAPIStatus("Request failed", "status-error");
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
        <div class="message bot-message"><div class="message-content"><p>Chat cleared. Ask a general question, or continue with the currently selected publications.</p></div></div>`;
}


let agentWorkspaceView = "split";

function setPanelToggleIcon(button, iconClass) {
    const icon = button.querySelector("i");
    if (!icon) return;
    icon.className = `fas ${iconClass}`;
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
}

document.addEventListener("DOMContentLoaded", () => {
    updateResearchTaskOptions();

    document.getElementById("toggle-publications-panel").addEventListener("click", () => {
        setAgentWorkspaceView(agentWorkspaceView === "left" ? "split" : "left");
    });
    document.getElementById("toggle-agent-chat-panel").addEventListener("click", () => {
        setAgentWorkspaceView(agentWorkspaceView === "right" ? "split" : "right");
    });
    document.getElementById("open-publications-panel").addEventListener("click", () => setAgentWorkspaceView("left"));
    document.getElementById("open-agent-chat-panel").addEventListener("click", () => setAgentWorkspaceView("right"));

    loadPublications().catch(error => {
        console.error(error);
        document.getElementById("publication-results").innerHTML = `<div class="no-results"><p>${escapeHTML(error.message)}</p></div>`;
        document.getElementById("result-count").textContent = "Publication loading failed";
    });

    document.getElementById("publication-search").addEventListener("click", runPublicationSearch);
    document.getElementById("publication-query").addEventListener("keydown", event => {
        if (event.key === "Enter") runPublicationSearch();
    });
    document.getElementById("show-all-papers").addEventListener("click", () => {
        document.getElementById("publication-query").value = "";
        filteredPublications = [...publications];
        renderPublicationResults();
    });
    document.getElementById("clear-selected").addEventListener("click", () => {
        selectedPublicationIds.clear();
        renderPublicationResults();
        renderSelectedPublications();
    });
    document.getElementById("send-agent-message").addEventListener("click", sendAgentMessage);
    document.getElementById("agent-user-input").addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendAgentMessage();
        }
    });
    document.getElementById("clear-agent-chat").addEventListener("click", clearAgentChat);
    document.querySelectorAll(".suggestion-chip").forEach(button => {
        button.addEventListener("click", () => {
            document.getElementById("agent-user-input").value = button.dataset.prompt;
            document.getElementById("agent-user-input").focus();
        });
    });
    initializeAgentClient();
});
