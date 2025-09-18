// Simple shared API connection manager
class SharedAPIConnection {
    constructor() {
        this.gradioApp = null;
        this.apiConnected = false;
        this.apiInitializing = false;
        this.connectionStartTime = null;
        this.timerInterval = null;
    }

    // Initialize the API connection
    async initialize() {
        if (this.apiConnected) return true;
        if (this.apiInitializing) {
            // Wait for the existing initialization to complete
            return new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.apiConnected) {
                        clearInterval(checkInterval);
                        resolve(true);
                    } else if (!this.apiInitializing) {
                        clearInterval(checkInterval);
                        resolve(false);
                    }
                }, 100);
            });
        }
        
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
            
            // Store connection status and time in sessionStorage
            const connectionTime = ((Date.now() - this.connectionStartTime) / 1000).toFixed(1);
            sessionStorage.setItem('apiConnected', 'true');
            sessionStorage.setItem('apiConnectionTime', connectionTime);
            
            // Update timer display on all pages
            this.updateTimerDisplay(connectionTime + 's');
            
            return true;
        } catch (error) {
            console.error("Failed to initialize Gradio client:", error);
            this.apiConnected = false;
            this.apiInitializing = false;
            this.stopTimer();
            return false;
        }
    }

    // Start the connection timer
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            const elapsedTime = ((Date.now() - this.connectionStartTime) / 1000).toFixed(1);
            this.updateTimerDisplay(elapsedTime + 's');
        }, 100);
    }

    // Stop the connection timer
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Update timer display
    updateTimerDisplay(time) {
        const timerElement = document.getElementById('elapsed-time');
        if (timerElement) {
            timerElement.textContent = time;
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

    // Check if initializing
    isInitializing() {
        return this.apiInitializing;
    }
}

// Create a global instance
window.sharedAPIConnection = new SharedAPIConnection();

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a stored connection status
    const storedStatus = sessionStorage.getItem('apiConnected');
    const storedTime = sessionStorage.getItem('apiConnectionTime');
    
    if (storedStatus === 'true') {
        window.sharedAPIConnection.apiConnected = true;
        
        // Update timer display if we have a stored time
        if (storedTime) {
            const timerElement = document.getElementById('elapsed-time');
            if (timerElement) {
                timerElement.textContent = storedTime + 's';
            }
        }
    }
    
    // Initialize the API connection
    window.sharedAPIConnection.initialize().catch(console.error);
});
