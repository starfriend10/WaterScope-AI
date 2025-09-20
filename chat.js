// chat.js - Fixed version with proper API status handling

let chatHistory = [];
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;

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
    
    // Save API status
    localStorage.setItem("chatApiStatus", document.getElementById('api-status').textContent);
    localStorage.setItem("chatApiInitializing", apiInitializing.toString());
    localStorage.setItem("chatApiConnected", apiConnected.toString());
});

// Restore chat state on page load
document.addEventListener("DOMContentLoaded", () => {
    const savedHistory = localStorage.getItem("chatHistory");
    const savedHTML = localStorage.getItem("chatMessagesHTML");
    const savedScrollTop = localStorage.getItem("chatScrollTop");
    const savedApiStatus = localStorage.getItem("chatApiStatus");
    const savedApiInitializing = localStorage.getItem("chatApiInitializing");
    const savedApiConnected = localStorage.getItem("chatApiConnected");

    if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
    }

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && savedHTML) {
        chatMessages.innerHTML = savedHTML;

        // Restore scroll position
        if (savedScrollTop) {
            setTimeout(() => {
                chatMessages.scrollTop = parseInt(savedScrollTop, 10);
            }, 100);
        }
    }
    
    // Restore API status if needed
    if (savedApiStatus) {
        document.getElementById('api-status').textContent = savedApiStatus;
    }
    
    if (savedApiInitializing) {
        apiInitializing = savedApiInitializing === 'true';
    }
    
    if (savedApiConnected) {
        apiConnected = savedApiConnected === 'true';
    }
});

// Initialize Gradio Client for chat
async function initializeGradioClient() {
    // Don't reinitialize if already initializing or connected
    if (apiInitializing || apiConnected) {
        return;
    }
    
    try {
        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI-Chat");
        
        console.log("Gradio client initialized successfully");
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
    }
}

// Update API status
function updateAPIStatus(message) {
    const element = document.getElementById('api-status');
    if (element) {
        element.textContent = message;
        
        // Add visual status indicators
        element.classList.remove('status-processing', 'status-ready', 'status-error');
        
        if (message.toLowerCase().includes('initializing') || message.toLowerCase().includes('processing')) {
            element.classList.add('status-processing');
        } else if (message.toLowerCase().includes('connected') || message.toLowerCase().includes('ready')) {
            element.classList.add('status-ready');
        } else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
            element.classList.add('status-error');
        }
    }
}

// Update system status
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

// Clear chat function
function clearChat() {
    chatHistory = [];
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Don't reset API status if it's initializing
    if (!apiInitializing) {
        updateSystemStatus("Chat cleared");
    } else {
        // If API is initializing, keep the API status as is
        updateSystemStatus("Chat cleared (API initializing...)");
    }
    
    // Save the cleared state
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    localStorage.setItem("chatMessagesHTML", '');
}

// Send message function
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Initialize client if not already done
    if (!gradioApp && !apiInitializing) {
        await initializeGradioClient();
        if (!gradioApp) {
            alert("Failed to connect to AI API. Please try again.");
            return;
        }
    }
    
    // If API is still initializing, wait for it
    if (apiInitializing) {
        const checkInitialization = setInterval(() => {
            if (!apiInitializing) {
                clearInterval(checkInitialization);
                sendMessage(); // Retry sending the message
            }
        }, 500);
        return;
    }
    
    // Add user message to chat
    addMessageToChat('user', message);
    messageInput.value = '';
    
    // Add to history
    chatHistory.push({ role: 'user', content: message });
    
    // Show typing indicator
    const typingIndicator = addMessageToChat('assistant', 'Thinking...');
    typingIndicator.classList.add('typing');
    
    try {
        isProcessing = true;
        updateSystemStatus("Processing your message...");
        
        // Call the API
        const result = await gradioApp.predict("/chat", {
            message: message,
            history: JSON.stringify(chatHistory)
        });
        
        // Remove typing indicator
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages.contains(typingIndicator)) {
            chatMessages.removeChild(typingIndicator);
        }
        
        // Add assistant response
        const response = result.data;
        addMessageToChat('assistant', response);
        
        // Add to history
        chatHistory.push({ role: 'assistant', content: response });
        
        updateSystemStatus("Ready");
        
    } catch (error) {
        console.error('API Error:', error);
        
        // Remove typing indicator
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages.contains(typingIndicator)) {
            chatMessages.removeChild(typingIndicator);
        }
        
        // Show error message
        addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
        updateSystemStatus("Error processing message");
    } finally {
        isProcessing = false;
    }
}

// Add message to chat UI
function addMessageToChat(role, content) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content;
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    
    // Set up event listeners
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const clearButton = document.getElementById('clear-chat');
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', clearChat);
    }
    
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
});
