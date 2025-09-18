// API State Management (shared with script.js)
const API_STATE_KEY = 'waterscope_api_state';
const API_TIMER_KEY = 'waterscope_api_timer';

// Function to get API state from sessionStorage
function getApiState() {
    const state = sessionStorage.getItem(API_STATE_KEY);
    return state ? JSON.parse(state) : {
        initialized: false,
        initializing: false,
        connected: false
    };
}

// Function to save API state to sessionStorage
function saveApiState(state) {
    sessionStorage.setItem(API_STATE_KEY, JSON.stringify(state));
}

// Function to get timer data from sessionStorage
function getTimerData() {
    const data = sessionStorage.getItem(API_TIMER_KEY);
    return data ? JSON.parse(data) : {
        startTime: null,
        elapsed: 0
    };
}

// Function to save timer data to sessionStorage
function saveTimerData(data) {
    sessionStorage.setItem(API_TIMER_KEY, JSON.stringify(data));
}

// Function to update timer display
function updateTimerDisplay(elapsedSeconds) {
    // Add timer element if it doesn't exist
    let elapsedTimeElement = document.getElementById('elapsed-time');
    if (!elapsedTimeElement) {
        const statusIndicators = document.querySelector('.status-indicators');
        if (statusIndicators) {
            const timeItem = document.createElement('div');
            timeItem.className = 'status-item';
            timeItem.innerHTML = `
                <span class="status-label">Time:</span>
                <span id="elapsed-time" class="status-value">${elapsedSeconds.toFixed(1)}s</span>
            `;
            statusIndicators.appendChild(timeItem);
            elapsedTimeElement = document.getElementById('elapsed-time');
        }
    }
    
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = elapsedSeconds.toFixed(1) + 's';
    }
}

// Function to update API status display
function updateApiStatusDisplay() {
    const apiState = getApiState();
    const apiStatusElement = document.getElementById('api-status');
    
    if (apiStatusElement) {
        if (apiState.connected) {
            apiStatusElement.textContent = 'Connected';
            apiStatusElement.className = 'status-value status-ready';
        } else if (apiState.initializing) {
            apiStatusElement.textContent = 'Initializing...';
            apiStatusElement.className = 'status-value status-processing';
        } else {
            apiStatusElement.textContent = 'Ready';
            apiStatusElement.className = 'status-value status-ready';
        }
    }
}

// Function to start API initialization timer
function startApiTimer() {
    const timerData = getTimerData();
    if (!timerData.startTime) {
        timerData.startTime = Date.now();
        saveTimerData(timerData);
    }
    
    // Update timer display every 100ms
    const timerInterval = setInterval(() => {
        const currentTimerData = getTimerData();
        if (currentTimerData.startTime) {
            const elapsed = (Date.now() - currentTimerData.startTime) / 1000;
            updateTimerDisplay(elapsed);
        }
    }, 100);
    
    return timerInterval;
}

// Function to stop API timer
function stopApiTimer() {
    const timerData = getTimerData();
    if (timerData.startTime) {
        const elapsed = (Date.now() - timerData.startTime) / 1000;
        timerData.elapsed = elapsed;
        timerData.startTime = null;
        saveTimerData(timerData);
        updateTimerDisplay(elapsed);
    }
}

// Function to reset API timer
function resetApiTimer() {
    const timerData = {
        startTime: null,
        elapsed: 0
    };
    saveTimerData(timerData);
    updateTimerDisplay(0);
}

// chat.js - Complete solution with freezing functionality and state management
let gradioApp = null;
let isProcessing = false;
let chatHistory = [];

// Timer functionality
let timerInterval = null;

// Status update functions
function updateSystemStatus(message) {
    const element = document.getElementById('system-status');
    if (element) {
        element.textContent = message;
        
        // Add visual status indicators
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
        
        // Add visual status indicators
        element.classList.remove('status-processing', 'status-ready', 'status-error');
        
        if (message.toLowerCase().includes('processing')) {
            element.classList.add('status-processing');
        } else if (message.toLowerCase().includes('connected') || message.toLowerCase().includes('received')) {
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
    
    console.log("Freezing input panel", {userInput, sendButton, clearButton});
    
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

// Initialize Gradio Client with state management
async function initializeGradioClient() {
    try {
        // Check if already initialized
        const apiState = getApiState();
        if (apiState.initialized && gradioApp) {
            console.log("Gradio client already initialized");
            updateAPIStatus("Connected to AI API successfully");
            return true;
        }
        
        // Update API state
        apiState.initializing = true;
        saveApiState(apiState);
        updateApiStatusDisplay();
        
        updateAPIStatus("Initializing connection to AI API...");
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        
        // Update API state
        apiState.initializing = false;
        apiState.initialized = true;
        apiState.connected = true;
        saveApiState(apiState);
        updateApiStatusDisplay();
        
        updateAPIStatus("Connected to AI API successfully");
        updateSystemStatus("Ready");
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        
        // Update API state
        const apiState = getApiState();
        apiState.initializing = false;
        apiState.connected = false;
        saveApiState(apiState);
        updateApiStatusDisplay();
        
        updateAPIStatus("Failed to connect to AI API");
        updateSystemStatus("Connection Error");
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
        // The API returns [cleared_input, updated_chat_history]
        // updated_chat_history is an array of [user_message, assistant_message] arrays
        if (apiResult && apiResult.data && Array.isArray(apiResult.data) && apiResult.data.length >= 2) {
            const chatHistory = apiResult.data[1];
            if (Array.isArray(chatHistory) && chatHistory.length > 0) {
                // Get the last message in the history
                const lastMessage = chatHistory[chatHistory.length - 1];
                // Return the assistant's response (second element in the tuple)
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
    const apiState = getApiState();
    if (!apiState.initialized || !gradioApp) {
        updateAPIStatus("Initializing connection to AI API...");
        const success = await initializeGradioClient();
        if (!success) {
            updateAPIStatus("Failed to connect to AI API. Please try again.");
            addMessage("Sorry, I'm having trouble connecting to the AI service. Please try again later.", false);
            unfreezeInputPanel(); // Unfreeze on error
            return;
        }
    }
    
    try {
        isProcessing = true;
        updateAPIStatus("Processing your message...");
        
        // Call the correct endpoint - using /respond as shown in your API documentation
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
        unfreezeInputPanel(); // Always unfreeze regardless of success/error
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
    updateAPIStatus("Ready");
    updateSystemStatus("Ready");
    
    // Clear any timer display
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
            
            // Reset height after sending
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
    
    // Check if API is already initialized
    const apiState = getApiState();
    updateApiStatusDisplay();
    
    // Check if API timer is running
    const timerData = getTimerData();
    if (timerData.startTime) {
        // Timer is running, update display
        const elapsed = (Date.now() - timerData.startTime) / 1000;
        updateTimerDisplay(elapsed);
    } else if (timerData.elapsed > 0) {
        // Timer was stopped, show elapsed time
        updateTimerDisplay(timerData.elapsed);
    }
    
    // Add UI enhancements
    addClearButton();
    setupAutoResize();
    setupEventListeners();
    
    // Initialize Gradio client if not already initialized
    if (!apiState.initialized && !apiState.initializing) {
        updateAPIStatus("Initializing API connection...");
        initializeGradioClient().catch(console.error);
    }
});

// Save API state before page unload
window.addEventListener('beforeunload', function() {
    const apiState = getApiState();
    saveApiState(apiState);
    
    const timerData = getTimerData();
    saveTimerData(timerData);
});
