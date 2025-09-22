// chat.js - Corrected version with working persistent timer
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;
let chatHistory = [];

// Timer functionality with proper state management
let timerInterval = null;
let accumulatedHiddenTime = 0;
let tabHiddenTime = null;
let currentTimerType = null;

// Tab visibility handling
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Tab is being hidden - record the time
        tabHiddenTime = Date.now();
        console.log('Tab hidden at:', tabHiddenTime);
    } else {
        // Tab is visible again - calculate hidden duration
        if (tabHiddenTime) {
            const hiddenDuration = Date.now() - tabHiddenTime;
            accumulatedHiddenTime += hiddenDuration;
            console.log('Tab visible after:', hiddenDuration + 'ms');
            tabHiddenTime = null;
            
            // Update display immediately with corrected time
            updateTimerDisplay();
        }
        
        // Check connection status
        checkAndRecoverConnection();
    }
});

// Improved timer functions
function startTimer(type = 'message') {
    console.log('Starting timer:', type);
    
    // Clear any existing timer
    stopTimer();
    
    // Set current timer type
    currentTimerType = type;
    
    // Store start time
    const startTime = Date.now();
    localStorage.setItem('timerStartTime', startTime.toString());
    localStorage.setItem('timerType', type);
    localStorage.setItem('accumulatedHiddenTime', '0'); // Reset
    
    // Reset accumulated time
    accumulatedHiddenTime = 0;
    
    // Start UI update interval
    timerInterval = setInterval(updateTimerDisplay, 100);
    
    // Initial display
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const startTimeStr = localStorage.getItem('timerStartTime');
    if (!startTimeStr) return;
    
    const startTime = parseInt(startTimeStr);
    const currentTime = Date.now();
    const accumulated = parseInt(localStorage.getItem('accumulatedHiddenTime') || '0');
    const totalElapsed = currentTime - startTime - accumulated;
    const elapsedSeconds = totalElapsed / 1000;
    
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = elapsedSeconds.toFixed(1) + 's';
        elapsedTimeElement.style.display = 'block';
    }
    
    // Update accumulated time in storage (for page reloads)
    localStorage.setItem('accumulatedHiddenTime', accumulatedHiddenTime.toString());
}

function stopTimer() {
    console.log('Stopping timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Don't clear storage immediately - keep for potential resume
    // We'll clear only when explicitly needed
    
    accumulatedHiddenTime = 0;
    tabHiddenTime = null;
    currentTimerType = null;
}

function clearTimerStorage() {
    localStorage.removeItem('timerStartTime');
    localStorage.removeItem('timerType');
    localStorage.removeItem('accumulatedHiddenTime');
}

// Status update functions
function updateSystemStatus(message) {
    const element = document.getElementById('system-status');
    if (element) {
        element.textContent = message;
        element.className = 'status-value ' + (
            message.toLowerCase().includes('processing') ? 'status-processing' :
            message.toLowerCase().includes('ready') ? 'status-ready' :
            message.toLowerCase().includes('error') ? 'status-error' : ''
        );
    }
}

function updateAPIStatus(message) {
    const element = document.getElementById('api-status');
    if (element) {
        element.textContent = message;
        element.className = 'status-value ' + (
            message.toLowerCase().includes('processing') || 
            message.toLowerCase().includes('checking') || 
            message.toLowerCase().includes('reconnecting') ? 'status-processing' :
            message.toLowerCase().includes('connected') || 
            message.toLowerCase().includes('received') || 
            message.toLowerCase().includes('ready') ? 'status-ready' :
            message.toLowerCase().includes('error') || 
            message.toLowerCase().includes('failed') ? 'status-error' : ''
        );
    }
}

// Freeze/unfreeze functions
function freezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');
    
    if (userInput) {
        userInput.disabled = true;
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
        userInput.placeholder = 'Type your message here...';
        userInput.focus();
    }
    if (sendButton) sendButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
    
    updateSystemStatus("Ready");
}

// Initialize Gradio Client
async function initializeGradioClient() {
    try {
        if (gradioApp) return true;

        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        
        // Start timer
        startTimer('api-init');
        
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
        updateSystemStatus("Ready");
        
        stopTimer();
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
        updateSystemStatus("Connection Error");
        stopTimer();
        return false;
    }
}

// Message functions
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

// Send message function
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    if (!userInput) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    freezeInputPanel();
    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    
    if (!gradioApp) {
        updateAPIStatus("Initializing connection to AI API...");
        const success = await initializeGradioClient();
        if (!success) {
            updateAPIStatus("Failed to connect to AI API. Please try again.");
            addMessage("Sorry, I'm having trouble connecting to the AI service. Please try again later.", false);
            unfreezeInputPanel();
            return;
        }
    }
    
    try {
        isProcessing = true;
        updateAPIStatus("Processing your message...");
        startTimer('message');
        
        const result = await gradioApp.predict("/respond", {
            message: message,
            chat_history: chatHistory
        });
        
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
        stopTimer();
        unfreezeInputPanel();
    }
}

// Clear chat function
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
    clearTimerStorage();
    
    if (!apiInitializing) {
        updateAPIStatus("Ready");
        updateSystemStatus("Ready");
    }
    
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = "0.0s";
    }
}

// Connection recovery
async function checkAndRecoverConnection() {
    const apiStatusElement = document.getElementById('api-status');
    if (!apiStatusElement) return;
    
    const statusText = apiStatusElement.textContent.toLowerCase();
    
    if (statusText.includes('failed') || statusText.includes('error') || statusText.includes('background')) {
        console.log('Checking connection recovery...');
        updateAPIStatus("Checking connection...");
        
        if (gradioApp && apiConnected) {
            updateAPIStatus("Connected");
            updateSystemStatus("Ready");
        } else if (!apiInitializing) {
            updateAPIStatus("Reconnecting...");
            const success = await initializeGradioClient();
            if (!success) {
                updateAPIStatus("Please refresh the page");
            }
        }
    }
}

// UI setup functions
function setupAutoResize() {
    const userInput = document.getElementById('user-input');
    if (!userInput) return;
    
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
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
    if (userInput) {
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Ready");
    
    // Show timer
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.style.display = 'block';
        elapsedTimeElement.textContent = "0.0s";
    }
    
    // Check for existing timer state
    const existingTimer = localStorage.getItem('timerStartTime');
    if (existingTimer) {
        console.log('Resuming existing timer');
        timerInterval = setInterval(updateTimerDisplay, 100);
        updateTimerDisplay();
    }
    
    // Setup UI
    addClearButton();
    setupAutoResize();
    setupEventListeners();
    
    // Initialize API connection
    initializeGradioClient().catch(console.error);
});

// Persistence handlers
window.addEventListener("beforeunload", () => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        localStorage.setItem("chatMessagesHTML", chatMessages.innerHTML);
        localStorage.setItem("chatScrollTop", chatMessages.scrollTop.toString());
    }
    
    // Save current accumulated time
    localStorage.setItem('accumulatedHiddenTime', accumulatedHiddenTime.toString());
});

document.addEventListener("DOMContentLoaded", () => {
    // Restore chat history
    const savedHistory = localStorage.getItem("chatHistory");
    const savedHTML = localStorage.getItem("chatMessagesHTML");
    const savedScrollTop = localStorage.getItem("chatScrollTop");

    if (savedHistory) chatHistory = JSON.parse(savedHistory);
    
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && savedHTML) {
        chatMessages.innerHTML = savedHTML;
        if (savedScrollTop) chatMessages.scrollTop = parseInt(savedScrollTop);
    }
    
    // Restore accumulated time
    const savedAccumulated = localStorage.getItem('accumulatedHiddenTime');
    if (savedAccumulated) accumulatedHiddenTime = parseInt(savedAccumulated);
});
