// chat.js
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;

// Timer functionality
let timerInterval = null;
let startTime = null;

function startTimer() {
    startTime = Date.now();
    document.getElementById('elapsed-time').style.display = 'block';
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        document.getElementById('elapsed-time').textContent = elapsedTime.toFixed(1) + 's';
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
    document.getElementById('system-status').textContent = message;
}

function updateAPIStatus(message) {
    document.getElementById('api-status').textContent = message;
}

// Initialize Gradio Client
async function initializeGradioClient() {
    try {
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
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
        updateSystemStatus("Connection Error");
    }
}

// Function to add a message to the chat
function addMessage(text, isUser) {
    const chatMessages = document.getElementById('chat-messages');
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

// Function to send a message
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, true);
    userInput.value = '';
    
    // Initialize client if not already done
    if (!gradioApp) {
        updateAPIStatus("Initializing connection to AI API...");
        await initializeGradioClient();
        if (!gradioApp) {
            updateAPIStatus("Failed to connect to AI API. Please try again.");
            addMessage("Sorry, I'm having trouble connecting to the AI service. Please try again later.", false);
            return;
        }
    }
    
    try {
        isProcessing = true;
        updateAPIStatus("Processing your message...");
        startTimer();
        
        // Call the correct endpoint - use the function name from your backend
        const result = await gradioApp.predict("/respond", [message, []]);
        
        const botResponse = result.data;
        addMessage(botResponse, false);
        updateAPIStatus("Response received");
        
    } catch (err) {
        console.error('API Error:', err);
        updateAPIStatus('Error: ' + err.message);
        addMessage("Sorry, I encountered an error while processing your message.", false);
    } finally {
        isProcessing = false;
        stopTimer();
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Initializing API connection...");
    
    // Add elapsed time element if it doesn't exist
    if (!document.getElementById('elapsed-time')) {
        const statusIndicators = document.querySelector('.status-indicators');
        if (statusIndicators) {
            const timeItem = document.createElement('div');
            timeItem.className = 'status-item';
            timeItem.innerHTML = `
                <span class="status-label">Time:</span>
                <span id="elapsed-time" class="status-value">0.0s</span>
            `;
            statusIndicators.appendChild(timeItem);
        }
    }
    
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
    
    // Add event listeners for send button and input field
    document.getElementById('send-chat').addEventListener('click', sendMessage);
    
    document.getElementById('user-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
