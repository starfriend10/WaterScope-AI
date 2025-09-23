// chat.js - Complete solution with fixed continuous timer
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;
let chatHistory = [];

// Fixed timer variables - using timestamp-based approach
let timerInterval = null;
let timerStartTime = null;

// Tab visibility handling
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Tab is hidden - update status but timer continues running in background
        updateAPIStatus("Background (Active)");
    } else {
        // Tab is visible again - update display immediately
        if (timerStartTime) {
            updateTimerDisplay();
        }
        // Check and recover connection if needed
        checkAndRecoverConnection();
    }
});

// Fixed timer functions using timestamp-based approach
function startTimer(type = 'message') {
    // Clear any existing timer first
    stopTimer();

    // Record the precise start time (timestamp in milliseconds)
    timerStartTime = Date.now();
    
    // Save to localStorage for persistence across page reloads
    localStorage.setItem('timerStartTime', timerStartTime.toString());
    localStorage.setItem('timerType', type);
    
    console.log('Timer started at:', timerStartTime, 'Type:', type);
    
    // Start UI update interval (this is just for display smoothness)
    timerInterval = setInterval(updateTimerDisplay, 100);
    
    // Show initial display
    updateTimerDisplay();
}

function updateTimerDisplay() {
    if (!timerStartTime) {
        // Try to recover from localStorage if page was reloaded
        const storedTime = localStorage.getItem('timerStartTime');
        if (!storedTime) return;
        timerStartTime = parseInt(storedTime);
    }

    // Calculate elapsed time based on actual timestamp difference
    const currentTime = Date.now();
    const elapsedTimeMs = currentTime - timerStartTime;
    const elapsedSeconds = elapsedTimeMs / 1000;
    
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = elapsedSeconds.toFixed(1) + 's';
        elapsedTimeElement.style.display = 'block';
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerStartTime = null;
    localStorage.removeItem('timerStartTime');
    localStorage.removeItem('timerType');
}

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
        if (gradioApp) return true; // Already initialized
        
        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        
        // Start the fixed timer
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
        
        // Stop timer
        stopTimer();
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
        updateSystemStatus("Connection Error");
        
        // Stop timer even if it fails
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
    if (!gradioApp) {
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
        
        // Start the fixed timer for message processing
        startTimer('message');
        
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
        stopTimer();
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
    
    // Stop and reset the timer
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

// Connection recovery function
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
        } else if (!apiInitializing) {
            updateAPIStatus("Reconnecting...");
            const success = await initializeGradioClient();
            if (success) {
                updateAPIStatus("Reconnected successfully");
            } else {
                updateAPIStatus("Reconnection failed");
            }
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Ready");
    
    // Show timer immediately on page load
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (elapsedTimeElement) {
        elapsedTimeElement.style.display = 'block';
        elapsedTimeElement.textContent = "0.0s";
    }
    
    // Check if there's an active timer from a previous session and resume it
    const savedStartTime = localStorage.getItem('timerStartTime');
    if (savedStartTime) {
        console.log('Resuming previous timer session');
        timerStartTime = parseInt(savedStartTime);
        timerInterval = setInterval(updateTimerDisplay, 100);
        updateTimerDisplay();
    }
    
    // Add UI enhancements
    addClearButton();
    setupAutoResize();
    setupEventListeners();
    
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
});

// ===== Chat history persistence across page switches =====

// Save chat state before leaving page
window.addEventListener("beforeunload", () => {
    // Save chatHistory array
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

    // Also save the rendered HTML to restore scroll position etc.
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

        // Restore scroll position
        if (savedScrollTop) {
            chatMessages.scrollTop = parseInt(savedScrollTop, 10);
        }
    }
});
