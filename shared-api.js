// Shared API connection and timer management
class SharedAPIConnection {
    constructor() {
        this.gradioApp = null;
        this.apiConnected = false;
        this.apiInitializing = false;
        this.connectionStartTime = null;
        this.timerInterval = null;
        this.connectionCallbacks = [];
    }

    // Initialize the API connection
    async initialize() {
        // Check if already connected or initializing
        if (this.apiConnected) return true;
        if (this.apiInitializing) return this.waitForConnection();
        
        this.apiInitializing = true;
        this.connectionStartTime = Date.now();
        this.startTimer();
        
        try {
            // Import the Gradio client
            const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
            
            // Connect to your Hugging Face Space
            this.gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
            
            console.log("Gradio client initialized successfully");
            this.apiConnected = true;
            this.apiInitializing = false;
            this.stopTimer();
            
            // Notify all callbacks
            this.connectionCallbacks.forEach(callback => callback(true));
            this.connectionCallbacks = [];
            
            return true;
        } catch (error) {
            console.error("Failed to initialize Gradio client:", error);
            this.apiConnected = false;
            this.apiInitializing = false;
            this.stopTimer();
            
            // Notify all callbacks
            this.connectionCallbacks.forEach(callback => callback(false));
            this.connectionCallbacks = [];
            
            return false;
        }
    }

    // Wait for connection if it's being initialized by another page
    waitForConnection() {
        return new Promise((resolve) => {
            if (this.apiConnected) {
                resolve(true);
            } else {
                this.connectionCallbacks.push(resolve);
            }
        });
    }

    // Start the connection timer
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - this.connectionStartTime) / 1000;
            this.updateTimerDisplay(elapsedTime.toFixed(1) + 's');
        }, 100);
    }

    // Stop the connection timer
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            
            if (this.apiConnected && this.connectionStartTime) {
                const totalTime = (Date.now() - this.connectionStartTime) / 1000;
                this.updateTimerDisplay(totalTime.toFixed(1) + 's');
            }
        }
    }

    // Update timer display on all pages
    updateTimerDisplay(time) {
        // Update timer on current page if it exists
        const timerElement = document.getElementById('elapsed-time');
        if (timerElement) {
            timerElement.textContent = time;
        }
        
        // Store time in sessionStorage for other pages
        sessionStorage.setItem('apiConnectionTime', time);
        if (this.apiConnected) {
            sessionStorage.setItem('apiConnected', 'true');
        }
    }

    // Get the API client
    getClient() {
        return this.gradioApp;
    }

    // Check connection status
    isConnected() {
        return this.apiConnected;
    }

    // Get connection time
    getConnectionTime() {
        if (this.connectionStartTime) {
            return (Date.now() - this.connectionStartTime) / 1000;
        }
        return 0;
    }
}

// Create a global instance
window.sharedAPIConnection = new SharedAPIConnection();

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a stored connection time
    const storedTime = sessionStorage.getItem('apiConnectionTime');
    if (storedTime) {
        const timerElement = document.getElementById('elapsed-time');
        if (timerElement) {
            timerElement.textContent = storedTime;
        }
    }
    
    // Check if we have a stored connection status
    const storedStatus = sessionStorage.getItem('apiConnected');
    if (storedStatus === 'true') {
        window.sharedAPIConnection.apiConnected = true;
    }
    
    // Initialize the API connection
    window.sharedAPIConnection.initialize().catch(console.error);
});