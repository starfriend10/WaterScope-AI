// chat.js - Complete solution with persistent timer for tab switching
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;
let chatHistory = [];

// Enhanced timer functionality with localStorage persistence
let timerInterval = null;
let accumulatedHiddenTime = 0;
let tabHiddenTime = null;

// Tab visibility handling for continuous timing
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Tab is being hidden - record the time
        tabHiddenTime = Date.now();
        console.log('Tab hidden, recording time:', tabHiddenTime);
        
        // Update status to reflect background state
        updateAPIStatus("Background (connection active)");
        
    } else {
        // Tab is visible again - calculate hidden duration
        if (tabHiddenTime) {
            const hiddenDuration = Date.now() - tabHiddenTime;
            accumulatedHiddenTime += hiddenDuration;
            console.log('Tab visible, hidden duration:', hiddenDuration, 'Total accumulated:', accumulatedHiddenTime);
            tabHiddenTime = null;
        }
        
        // Update display immediately with corrected time
        updateAllTimerDisplays();
        
        // Check and recover connection if needed
        checkAndRecoverConnection();
    }
});

// Persistent timer using localStorage
function startTimer(type = 'message') {
    // Clear any existing timers first
    stopTimer();
    
    const now = Date.now();
    const storageKey = (type === 'api-init') ? 'apiInitStartTime' : 'messageStartTime';
    
    // Store start time in localStorage for persistence
    localStorage.setItem(storageKey, now.toString());
    localStorage.setItem('currentTimerType', type);
    
    // Reset accumulated time
    accumulatedHiddenTime = 0;
    
    console.log('Started timer:', type, 'at:', now);
    
    // Start UI updates
    timerInterval = setInterval(() => {
        updatePersistentTimerDisplay();
    }, 100);
    
    // Show timer immediately
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.style.display = 'block';
        elapsedTimeElement.textContent = "0.0s";
    }
}

function updatePersistentTimerDisplay() {
    const timerType = localStorage.getItem('currentTimerType');
    const storageKey = (timerType === 'api-init') ? 'apiInitStartTime' : 'messageStartTime';
    
    const storedStartTime = localStorage.getItem(storageKey);
    if (!storedStartTime) {
        console.log('No active timer found');
        return;
    }
    
    const startTimestamp = parseInt(storedStartTime);
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTimestamp - accumulatedHiddenTime) / 1000;
    
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = elapsedTime.toFixed(1) + 's';
    }
}

function updateAllTimerDisplays() {
    // Check if any timer is active and update display
    const apiInitTime = localStorage.getItem('apiInitStartTime');
    const messageTime = localStorage.getItem('messageStartTime');
    
    if (apiInitTime) {
        localStorage.setItem('currentTimerType', 'api-init');
        updatePersistentTimerDisplay();
    } else if (messageTime) {
        localStorage.setItem('currentTimerType', 'message');
        updatePersistentTimerDisplay();
    }
}

function stopTimer() {
    // Clear all timer storage
    localStorage.removeItem('apiInitStartTime');
    localStorage.removeItem('messageStartTime');
    localStorage.removeItem('currentTimerType');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    accumulatedHiddenTime = 0;
    tabHiddenTime = null;
    
    console.log('Timer stopped and cleared');
}

// Enhanced connection recovery
async function checkAndRecoverConnection() {
    const apiStatusElement = document.getElementById('api-status');
    
    if (apiStatusElement && (
        apiStatusElement.textContent.includes('Failed') || 
        apiStatusElement.textContent.includes('Error') ||
        apiStatusElement.textContent.includes('Background')
    )) {
        console.log('Tab active - checking API connection...');
        updateAPIStatus("Checking connection...");
        
        if (gradioApp && apiConnected) {
            updateAPIStatus("Connected");
            updateSystemStatus("Ready");
        } else {
            updateAPIStatus("Reconnecting...");
            gradioApp = null;
            apiConnected = false;
            
            const success = await initializeGradioClient();
            if (success) {
                updateAPIStatus("Reconnected successfully");
            } else {
                updateAPIStatus("Reconnection failed - please refresh");
            }
        }
    } else if (apiStatusElement && apiStatusElement.textContent.includes('Background')) {
        if (gradioApp && apiConnected) {
            updateAPIStatus("Connected");
        } else {
            updateAPIStatus("Ready");
        }
    }
}

// Status update functions
function updateSystemStatus(message) {
    const element = document.getElementById('system-status');
    if (element) {
        element.textContent = message;
        
        element.classList.remove('status-processing', 'status-ready', 'status-error');
        
        if (message.toLowerCase().includes('processing')) {
            element.classList.add('status-processing');
        } else if (message.toLowerCase().includes('ready')) {
            element.classList.add('status-ready');
        } else if (message.toLowerCase().includes('error')) {
            element.classList.add('status-error');
        }
    }
}

function updateAPIStatus(message) {
    const element = document.getElementById('api-status');
    if (element) {
        element.textContent = message;
        
        element.classList.remove('status-processing', 'status-ready', 'status-error');
        
        if (message.toLowerCase().includes('processing') || message.toLowerCase().includes('checking') || message.toLowerCase().includes('reconnecting')) {
            element.classList.add('status-processing');
        } else if (message.toLowerCase().includes('connected') || message.toLowerCase().includes('received') || message.toLowerCase().includes('ready')) {
            element.classList.add('status-ready');
        } else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
            element.classList.add('status-error');
        }
    }
}

// Function to freeze the input panel
function freezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');
    
    console.log("Freezing input panel");
    
    if (userInput) {
        userInput.disabled = true;
        userInput.setAttribute('readonly', 'readonly');
        userInput.placeholder = 'Processing your request...';
    }
    
    if (sendButton) {
        sendButton.disabled = true;
    }
    
    if (clearButton) {
        clearButton.disabled = true;
    }
    
    updateSystemStatus("Processing your request...");
}

// Function to unfreeze the input panel
function unfreezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');
    
    console.log("Unfreezing input panel");
    
    if (userInput) {
        userInput.disabled = false;
        userInput.removeAttribute('readonly');
        userInput.placeholder = 'Type your message here...';
        userInput.focus();
    }
    
    if (sendButton) {
        sendButton.disabled = false;
    }
    
    if (clearButton) {
        clearButton.disabled = false;
    }
    
    updateSystemStatus("Ready");
}

// Initialize Gradio Client
async function initializeGradioClient() {
    try {
        if (gradioApp) return true;

        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        
        // Start persistent timer for API initialization
        startTimer('api-init');
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
        updateSystemStatus("Ready");
        
        // Stop API initialization timer
        stopTimer();
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
        updateSystemStatus("Connection Error");
        
        // Stop API initialization timer even if it fails
        stopTimer();
        return false;
    }
}

// Function to add a message to the chat
function addMessage(text, isUser) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'message user-message' : 'message bot-message';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${text}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Extract just the assistant's response from API result
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

// Function to send a message
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    if (!userInput) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Freeze the input panel immediately
    freezeInputPanel();
    
    // Add user message to chat
    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Initialize client if not already done
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
        
        // Start persistent timer for message processing
        startTimer('message');
        
        // Call the correct endpoint
        const result = await gradioApp.predict("/respond", {
            message: message,
            chat_history: chatHistory
        });
        
        // Extract just the assistant's response
        const assistantResponse = extractAssistantResponse(result);
        
        // Update chat history with the new interaction
        chatHistory.push([message, assistantResponse]);
        
        // Add bot response to chat
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
    
    // Clear all timer data
    stopTimer();
    
    // Only update API status if not initializing
    if (!apiInitializing) {
        updateAPIStatus("Ready");
    }
    
    // Only update system status if not initializing
    if (!apiInitializing) {
        updateSystemStatus("Ready");
    }
    
    // Reset timer display
    if (document.getElementById('elapsed-time')) {
        document.getElementById('elapsed-time').textContent = "0.0s";
    }
}

// Auto-resize textarea as user types
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
            
            setTimeout(() => {
                this.style.height = 'auto';
            }, 10);
        }
    });
}

// Add clear chat button to UI if it doesn't exist
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

// Event listeners setup
function setupEventListeners() {
    const sendButton = document.getElementById('send-chat');
    const userInput = document.getElementById('user-input');
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    if (userInput) {
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Initializing API connection...");
    
    // Show timer immediately on page load
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.style.display = 'block';
        elapsedTimeElement.textContent = "0.0s";
    }
    
    // Add UI enhancements
    addClearButton();
    setupAutoResize();
    setupEventListeners();
    
    // Check if there's an active timer from previous session and resume it
    const apiInitTime = localStorage.getItem('apiInitStartTime');
    const messageTime = localStorage.getItem('messageStartTime');
    
    if (apiInitTime || messageTime) {
        console.log('Resuming previous timer session');
        updateAllTimerDisplays();
        
        // Start the interval for continuous updates
        timerInterval = setInterval(() => {
            updatePersistentTimerDisplay();
        }, 100);
    }
    
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
});

// ===== Chat history persistence across page switches =====

// Save chat state before leaving page
window.addEventListener("beforeunload", () => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        localStorage.setItem("chatMessagesHTML", chatMessages.innerHTML);
        localStorage.setItem("chatScrollTop", chatMessages.scrollTop);
    }
});

// Restore chat state on page load
document.addEventListener("DOMContentLoaded", () => {
    const savedHistory = localStorage.getItem("chatHistory");
    const savedHTML = localStorage.getItem("chatMessagesHTML");
    const savedScrollTop = localStorage.getItem("chatScrollTop");

    if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
    }

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && savedHTML) {
        chatMessages.innerHTML = savedHTML;

        if (savedScrollTop) {
            chatMessages.scrollTop = parseInt(savedScrollTop, 10);
        }
    }
});
