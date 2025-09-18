// chat.js - Simplified solution using shared API connection
let isProcessing = false;
let chatHistory = [];

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
            message.toLowerCase().includes('processing') ? 'status-processing' :
            message.toLowerCase().includes('connected') || message.toLowerCase().includes('received') ? 'status-ready' :
            message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? 'status-error' : ''
        );
    }
}

// Function to freeze the input panel
function freezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');
    
    if (userInput) userInput.disabled = true;
    if (sendButton) sendButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
    
    updateSystemStatus("Processing your request...");
}

// Function to unfreeze the input panel
function unfreezeInputPanel() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-chat');
    const clearButton = document.getElementById('clear-chat');
    
    if (userInput) userInput.disabled = false;
    if (sendButton) sendButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
    
    updateSystemStatus("Ready");
}

// Function to add a message to the chat
function addMessage(text, isUser) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'message user-message' : 'message bot-message';
    messageDiv.innerHTML = `<div class="message-content"><p>${text}</p></div>`;
    
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
    
    freezeInputPanel();
    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Get the shared API connection
    const gradioApp = window.sharedAPIConnection.getClient();
    
    // Initialize client if not already done
    if (!gradioApp) {
        updateAPIStatus("Initializing connection to AI API...");
        const success = await window.sharedAPIConnection.initialize();
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
    updateAPIStatus("Ready");
    updateSystemStatus("Ready");
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
            setTimeout(() => { this.style.height = 'auto'; }, 10);
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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Checking API connection...");
    
    // Check if API is already connected
    if (window.sharedAPIConnection.isConnected()) {
        updateAPIStatus("Connected to AI API successfully");
        
        // Update timer display
        const storedTime = sessionStorage.getItem('apiConnectionTime');
        if (storedTime) {
            const timerElement = document.getElementById('elapsed-time');
            if (timerElement) {
                timerElement.textContent = storedTime + 's';
            }
        }
    } else if (window.sharedAPIConnection.isInitializing()) {
        updateAPIStatus("Initializing connection to AI API...");
    }
    
    // Add UI enhancements
    addClearButton();
    setupAutoResize();
    setupEventListeners();
});
