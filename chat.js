// chat.js - Complete solution for WaterScope-AI chat interface
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;
let chatHistory = [];

// Timer functionality
let timerInterval = null;
let startTime = null;

function startTimer() {
    startTime = Date.now();
    // Ensure timer element exists
    const statusIndicators = document.querySelector('.status-indicators');
    if (statusIndicators && !document.getElementById('elapsed-time')) {
        const timeItem = document.createElement('div');
        timeItem.className = 'status-item';
        timeItem.innerHTML = `
            <span class="status-label">Time:</span>
            <span id="elapsed-time" class="status-value">0.0s</span>
        `;
        statusIndicators.appendChild(timeItem);
    }
    
    if (document.getElementById('elapsed-time')) {
        document.getElementById('elapsed-time').style.display = 'block';
    }
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        if (document.getElementById('elapsed-time')) {
            document.getElementById('elapsed-time').textContent = elapsedTime.toFixed(1) + 's';
        }
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Status update functions
function updateSystemStatus(message) {
    const element = document.getElementById('system-status');
    if (element) element.textContent = message;
}

function updateAPIStatus(message) {
    const element = document.getElementById('api-status');
    if (element) element.textContent = message;
}

// Initialize Gradio Client
async function initializeGradioClient() {
    try {
        if (gradioApp) return true; // Already initialized
        
        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
        updateSystemStatus("Ready");
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
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
    
    // Add user message to chat UI
    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto'; // Reset textarea height
    
    // Initialize client if not already done
    if (!gradioApp) {
        updateAPIStatus("Initializing connection to AI API...");
        const success = await initializeGradioClient();
        if (!success) {
            updateAPIStatus("Failed to connect to AI API. Please try again.");
            addMessage("Sorry, I'm having trouble connecting to the AI service. Please try again later.", false);
            return;
        }
    }
    
    try {
        isProcessing = true;
        updateAPIStatus("Processing your message...");
        startTimer();
        
        // Disable send button during processing
        const sendButton = document.getElementById('send-chat');
        if (sendButton) sendButton.disabled = true;
        
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
        
        // Re-enable send button
        const sendButton = document.getElementById('send-chat');
        if (sendButton) sendButton.disabled = false;
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
    updateAPIStatus("Initializing API connection...");
    
    // Add UI enhancements
    addClearButton();
    setupAutoResize();
    setupEventListeners();
    
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
});
