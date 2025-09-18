// api-manager.js - Centralized API management for WaterScope-AI
class APIManager {
    constructor() {
        this.gradioApp = null;
        this.apiInitializing = false;
        this.apiConnected = false;
        this.initializationTime = null;
        this.initializationTimer = null;
        this.init();
    }

    init() {
        // Load state from sessionStorage if available
        this.loadState();
        
        // If API is already connected, no need to initialize again
        if (this.apiConnected && this.gradioApp) {
            console.log("API already connected");
            this.updateUI();
            return;
        }
        
        // Initialize if not already initializing
        if (!this.apiInitializing) {
            this.initializeGradioClient();
        }
    }

    loadState() {
        const savedState = sessionStorage.getItem('waterScopeAIState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.apiConnected = state.apiConnected;
            this.apiInitializing = state.apiInitializing;
            this.initializationTime = state.initializationTime;
            
            if (this.initializationTime) {
                this.startInitializationTimer();
            }
        }
    }

    saveState() {
        const state = {
            apiConnected: this.apiConnected,
            apiInitializing: this.apiInitializing,
            initializationTime: this.initializationTime
        };
        sessionStorage.setItem('waterScopeAIState', JSON.stringify(state));
    }

    async initializeGradioClient() {
        try {
            this.apiInitializing = true;
            this.initializationTime = Date.now();
            this.saveState();
            
            this.startInitializationTimer();
            this.updateUI("Initializing connection to AI API...", "Initializing application...");
            
            // Import the Gradio client
            const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
            
            // Connect to your Hugging Face Space
            this.gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
            
            console.log("Gradio client initialized successfully");
            this.stopInitializationTimer();
            
            this.apiInitializing = false;
            this.apiConnected = true;
            this.saveState();
            
            this.updateUI("Connected to AI API successfully", "Ready");
            
        } catch (error) {
            console.error("Failed to initialize Gradio client:", error);
            this.stopInitializationTimer();
            
            this.apiInitializing = false;
            this.apiConnected = false;
            this.saveState();
            
            this.updateUI("Failed to connect to AI API", "Connection Error");
        }
    }

    startInitializationTimer() {
        if (this.initializationTimer) clearInterval(this.initializationTimer);
        
        this.initializationTimer = setInterval(() => {
            if (this.initializationTime) {
                const elapsedTime = (Date.now() - this.initializationTime) / 1000;
                
                // Update timer display on all pages
                const timerElements = document.querySelectorAll('#initialization-time, #elapsed-time');
                timerElements.forEach(el => {
                    if (el) el.textContent = elapsedTime.toFixed(1) + 's';
                });
            }
        }, 100);
    }

    stopInitializationTimer() {
        if (this.initializationTimer) {
            clearInterval(this.initializationTimer);
            this.initializationTimer = null;
        }
    }

    updateUI(apiStatus, systemStatus) {
        // Update API status
        const apiStatusElements = document.querySelectorAll('#api-status, #api-status-value');
        apiStatusElements.forEach(el => {
            if (el && apiStatus) el.textContent = apiStatus;
        });
        
        // Update system status
        const systemStatusElements = document.querySelectorAll('#system-status, #system-status-value');
        systemStatusElements.forEach(el => {
            if (el && systemStatus) el.textContent = systemStatus;
        });
        
        // Update visual indicators
        this.updateStatusIndicators();
    }

    updateStatusIndicators() {
        const apiStatusElements = document.querySelectorAll('#api-status, #api-status-value');
        const systemStatusElements = document.querySelectorAll('#system-status, #system-status-value');
        
        apiStatusElements.forEach(el => {
            el.classList.remove('status-processing', 'status-ready', 'status-error');
            
            if (this.apiInitializing) {
                el.classList.add('status-processing');
            } else if (this.apiConnected) {
                el.classList.add('status-ready');
            } else {
                el.classList.add('status-error');
            }
        });
        
        systemStatusElements.forEach(el => {
            el.classList.remove('status-processing', 'status-ready', 'status-error');
            
            if (this.apiInitializing) {
                el.classList.add('status-processing');
            } else if (this.apiConnected) {
                el.classList.add('status-ready');
            } else {
                el.classList.add('status-error');
            }
        });
    }

    getClient() {
        return this.gradioApp;
    }

    isConnected() {
        return this.apiConnected;
    }

    isInitializing() {
        return this.apiInitializing;
    }
}

// Create a global instance
window.waterScopeAPI = new APIManager();

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    window.waterScopeAPI.updateUI();
});