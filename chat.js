// chat.js - Enhanced with reconnect and continuous timer

let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;
let chatHistory = [];

// Timer functionality
let timerInterval = null;
let startTime = null;
let apiInitStartTime = null;
let apiInitTimerInterval = null;

// ======================== Timer functions ========================
function startTimer(type = 'message') {
    if (type === 'api-init') {
        apiInitStartTime = Date.now();
        if (apiInitTimerInterval) clearInterval(apiInitTimerInterval);
        apiInitTimerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - apiInitStartTime) / 1000;
            const elapsedTimeElement = document.getElementById('elapsed-time');
            if (elapsedTimeElement) elapsedTimeElement.textContent = elapsedTime.toFixed(1) + 's';
        }, 100);
    } else {
        startTime = Date.now();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const elapsedTimeElement = document.getElementById('elapsed-time');
            if (elapsedTimeElement) elapsedTimeElement.textContent = elapsedTime.toFixed(1) + 's';
        }, 100);
    }

    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) elapsedTimeElement.style.display = 'block';
}

function stopTimer(type = 'message') {
    if (type === 'api-init' && apiInitTimerInterval) {
        clearInterval(apiInitTimerInterval);
        apiInitTimerInterval = null;
    } else if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ======================== Status update functions ========================
function updateSystemStatus(message) {
    const element = document.getElementById('system-status');
    if (!element) return;

    element.textContent = message;
    element.classList.remove('status-processing', 'status-ready', 'status-error');

    if (message.toLowerCase().includes('processing')) element.classList.add('status-processing');
    else if (message.toLowerCase().includes('ready')) element.classList.add('status-ready');
    else if (message.toLowerCase().includes('error')) element.classList.add('status-error');
}

function updateAPIStatus(message) {
    const element = document.getElementById('api-status');
    if (!element) return;

    element.textContent = message;
    element.classList.remove('status-processing', 'status-ready', 'status-error');

    if (message.toLowerCase().includes('processing')) element.classList.add('status-processing');
    else if (message.toLowerCase().includes('connected') || message.toLowerCase().includes('received')) element.classList.add('status-ready');
    else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) element.classList.add('status-error');
}

// ======================== Input freeze/unfreeze ========================
function freezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');

    if (userInput) {
        userInput.disabled = true;
        userInput.setAttribute('readonly', 'readonly');
        userInput.placeholder = 'Processing your request...';
    }
    if (sendButton) sendButton.disabled = true;
    if (clearButton) clearButton.disabled = true;

    updateSystemStatus("Processing your request...");
}

function unfreezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');

    if (userInput) {
        userInput.disabled = false;
        userInput.removeAttribute('readonly');
        userInput.placeholder = 'Type your message here...';
        userInput.focus();
    }
    if (sendButton) sendButton.disabled = false;
    if (clearButton) clearButton.disabled = false;

    updateSystemStatus("Ready");
}

// ======================== Initialize Gradio ========================
async function initializeGradioClient() {
    try {
        if (gradioApp) return true; // already initialized

        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        startTimer('api-init');

        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");

        console.log("Gradio client initialized successfully");
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
        updateSystemStatus("Ready");
        stopTimer('api-init');

        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
        updateSystemStatus("Connection Error");
        stopTimer('api-init');
        return false;
    }
}

// ======================== Automatic reconnect ========================
async function ensureGradioConnected() {
    if (!gradioApp || !apiConnected) {
        console.log("Attempting to reconnect Gradio client...");
        await initializeGradioClient();
    }
}

// Periodic reconnect check every 10s
setInterval(() => {
    ensureGradioConnected();
}, 10000);

// Reconnect when tab becomes visible
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        ensureGradioConnected();
    }
});

// ======================== Message handling ========================
function addMessage(text, isUser) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'message user-message' : 'message bot-message';
    messageDiv.innerHTML = `<div class="message-content"><p>${text}</p></div>`;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function extractAssistantResponse(apiResult) {
    try {
        if (apiResult && apiResult.data && Array.isArray(apiResult.data) && apiResult.data.length >= 2) {
            const chatHistory = apiResult.data[1];
            if (Array.isArray(chatHistory) && chatHistory.length > 0) {
                const lastMessage = chatHistory[chatHistory.length - 1];
                if (Array.isArray(lastMessage) && lastMessage.length >= 2) {
                    return lastMessage[1] || "No response generated";
                }
            }
        }
        return "Failed to extract response from API";
    } catch (error) {
        console.error("Error extracting response:", error);
        return "Error processing response";
    }
}

// ======================== Send message ========================
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    if (!userInput) return;

    const message = userInput.value.trim();
    if (!message) return;

    freezeInputPanel();
    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto';

    await ensureGradioConnected();
    if (!apiConnected) {
        addMessage("Sorry, I'm having trouble connecting to the AI service. Please try again later.", false);
        unfreezeInputPanel();
        return;
    }

    try {
        isProcessing = true;
        updateAPIStatus("Processing your message...");
        startTimer('message');

        const result = await gradioApp.predict("/respond", { message: message, chat_history: chatHistory });
        const assistantResponse = extractAssistantResponse(result);
        chatHistory.push([message, assistantResponse]);
        addMessage(assistantResponse, false);
        updateAPIStatus("Response received");
    } catch (err) {
        console.error('API Error:', err);
        updateAPIStatus('Error: ' + (err.message || 'Unknown error'));
        addMessage("Sorry, I encountered an error while processing your message. Please try again.", false);
    } finally {
        isProcessing = false;
        stopTimer('message');
        unfreezeInputPanel();
    }
}

// ======================== Clear chat ========================
function clearChat() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="message-content">
                    <p>Hello! I'm a specialized AI model for water sustainability. How can I assist you today?</p>
                </div>
            </div>
        `;
    }
    chatHistory = [];

    if (!apiInitializing) updateAPIStatus("Ready");
    if (!apiInitializing) updateSystemStatus("Ready");

    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) elapsedTimeElement.textContent = "0.0s";
}

// ======================== UI Enhancements ========================
function setupAutoResize() {
    const userInput = document.getElementById('user-input');
    if (!userInput) return;

    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
            setTimeout(() => { this.style.height = 'auto'; }, 10);
        }
    });
}

function addClearButton() {
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (!chatInputContainer || document.getElementById('clear-chat')) return;

    const clearButton = document.createElement('button');
    clearButton.id = 'clear-chat';
    clearButton.className = 'btn-secondary';
    clearButton.innerHTML = '<i class="fas fa-broom"></i> Clear Chat';
    clearButton.addEventListener('click', clearChat);

    chatInputContainer.appendChild(clearButton);
}

function setupEventListeners() {
    const sendButton = document.getElementById('send-chat');
    const userInput = document.getElementById('user-input');

    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (userInput) userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ======================== Chat persistence ========================
window.addEventListener("beforeunload", () => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        localStorage.setItem("chatMessagesHTML", chatMessages.innerHTML);
        localStorage.setItem("chatScrollTop", chatMessages.scrollTop);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Initializing API connection...");

    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.style.display = 'block';
        elapsedTimeElement.textContent = "0.0s";
    }

    addClearButton();
    setupAutoResize();
    setupEventListeners();

    const savedHistory = localStorage.getItem("chatHistory");
    const savedHTML = localStorage.getItem("chatMessagesHTML");
    const savedScrollTop = localStorage.getItem("chatScrollTop");

    if (savedHistory) chatHistory = JSON.parse(savedHistory);
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && savedHTML) {
        chatMessages.innerHTML = savedHTML;
        if (savedScrollTop) chatMessages.scrollTop = parseInt(savedScrollTop, 10);
    }

    initializeGradioClient().catch(console.error);
});
