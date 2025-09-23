// mcqa-evaluator.js - Fixed with continuous timer
const MAX_OPTIONS = 8;
let currentOptions = 4;
let MCQA_DATA = [];
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;

// Fixed timer functionality - using timestamp-based approach
let timerInterval = null;
let timerStartTime = null;

// Tab visibility handling for continuous timing
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
function startTimer(type = 'processing') {
    // Clear any existing timer first
    stopTimer();

    // Record the precise start time (timestamp in milliseconds)
    timerStartTime = Date.now();
    
    // Save to localStorage for persistence across page reloads
    localStorage.setItem('mcqaTimerStartTime', timerStartTime.toString());
    localStorage.setItem('mcqaTimerType', type);
    
    console.log('MCQA Timer started at:', timerStartTime, 'Type:', type);
    
    // Start UI update interval (this is just for display smoothness)
    timerInterval = setInterval(updateTimerDisplay, 100);
    
    // Show initial display
    updateTimerDisplay();
}

function updateTimerDisplay() {
    if (!timerStartTime) {
        // Try to recover from localStorage if page was reloaded
        const storedTime = localStorage.getItem('mcqaTimerStartTime');
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
    localStorage.removeItem('mcqaTimerStartTime');
    localStorage.removeItem('mcqaTimerType');
}

// ===== Form persistence across page switches =====

// Check if localStorage is available
function isLocalStorageAvailable() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.error("LocalStorage is not available:", e);
        return false;
    }
}

// Save form state
function saveFormState() {
    if (!isLocalStorageAvailable()) {
        console.warn("LocalStorage is not available, cannot save form state");
        return;
    }
    
    try {
        // Save input values
        localStorage.setItem("demo_question", document.getElementById('question').value);
        localStorage.setItem("demo_explanation", document.getElementById('explanation').checked);
        
        // Save options
        const options = {};
        for(let i = 0; i < MAX_OPTIONS; i++) {
            const optInput = document.getElementById('opt' + i);
            if (optInput) {
                options['opt' + i] = optInput.value;
            }
        }
        localStorage.setItem("demo_options", JSON.stringify(options));
        localStorage.setItem("demo_currentOptions", currentOptions.toString());
        
        // Save output values
        localStorage.setItem("demo_dpo_letter", document.getElementById('dpo_letter').innerText);
        localStorage.setItem("demo_dpo_raw", document.getElementById('dpo_raw').innerText);
        localStorage.setItem("demo_it_letter", document.getElementById('it_letter').innerText);
        localStorage.setItem("demo_it_raw", document.getElementById('it_raw').innerText);
        
        // Save table selection
        const highlightedRow = document.querySelector('#mcqa-table tr.highlighted');
        if (highlightedRow) {
            localStorage.setItem("demo_highlightedRow", highlightedRow.dataset.index);
        }
        
        console.log("Form state saved successfully");
    } catch (error) {
        console.error("Error saving form state:", error);
    }
}

// Clear saved form state
function clearPersistence() {
    if (!isLocalStorageAvailable()) return;
    
    localStorage.removeItem("demo_question");
    localStorage.removeItem("demo_options");
    localStorage.removeItem("demo_explanation");
    localStorage.removeItem("demo_currentOptions");
    localStorage.removeItem("demo_dpo_letter");
    localStorage.removeItem("demo_dpo_raw");
    localStorage.removeItem("demo_it_letter");
    localStorage.removeItem("demo_it_raw");
    localStorage.removeItem("demo_highlightedRow");
    
    // Also clear the form
    document.getElementById('question').value = "";
    for(let i = 0; i < MAX_OPTIONS; i++) {
        const el = document.getElementById('opt' + i);
        if (el) el.value = "";
    }
    document.getElementById('explanation').checked = false;
    
    // Reset options UI
    currentOptions = 4;
    const container = document.getElementById('option-container');
    while (container.children.length > 4) {
        container.removeChild(container.lastChild);
    }
    
    // Clear outputs
    document.getElementById('dpo_letter').innerText = "-";
    document.getElementById('dpo_raw').innerText = "Waiting for input...";
    document.getElementById('it_letter').innerText = "-";
    document.getElementById('it_raw').innerText = "Waiting for input...";
    
    // Remove highlights from table rows
    document.querySelectorAll('#mcqa-table tr').forEach(row => {
        row.classList.remove('highlighted');
    });
    
    alert("Saved data has been cleared and form reset.");
}

// Restore form state
function restoreFormState() {
    if (!isLocalStorageAvailable()) {
        console.warn("LocalStorage is not available, cannot restore form state");
        return;
    }
    
    try {
        // Restore input values
        const savedQuestion = localStorage.getItem("demo_question");
        const savedExplanation = localStorage.getItem("demo_explanation");
        const savedOptions = localStorage.getItem("demo_options");
        const savedCurrentOptions = localStorage.getItem("demo_currentOptions");
        
        if (savedQuestion) {
            document.getElementById('question').value = savedQuestion;
        }
        
        if (savedExplanation) {
            document.getElementById('explanation').checked = (savedExplanation === 'true');
        }
        
        if (savedOptions) {
            const options = JSON.parse(savedOptions);
            for (let i = 0; i < MAX_OPTIONS; i++) {
                const optInput = document.getElementById('opt' + i);
                if (optInput && options['opt' + i] !== undefined) {
                    optInput.value = options['opt' + i];
                }
            }
        }
        
        if (savedCurrentOptions) {
            currentOptions = parseInt(savedCurrentOptions, 10);
            // Recreate extra option rows if needed
            const container = document.getElementById('option-container');
            while (container.children.length > currentOptions) {
                container.removeChild(container.lastChild);
            }
            while (container.children.length < currentOptions) {
                const i = container.children.length;
                const optionRow = document.createElement('div');
                optionRow.className = 'option-row';
                optionRow.innerHTML = `
                    <span class="option-label">${String.fromCharCode(65 + i)}</span>
                    <input type="text" id="opt${i}" placeholder="Option ${String.fromCharCode(65 + i)}">
                `;
                container.appendChild(optionRow);
                
                // Set the value if it exists in saved options
                if (savedOptions) {
                    const options = JSON.parse(savedOptions);
                    if (options['opt' + i] !== undefined) {
                        document.getElementById('opt' + i).value = options['opt' + i];
                    }
                }
            }
        }
        
        // Restore output values
        const savedDpoLetter = localStorage.getItem("demo_dpo_letter");
        const savedDpoRaw = localStorage.getItem("demo_dpo_raw");
        const savedItLetter = localStorage.getItem("demo_it_letter");
        const savedItRaw = localStorage.getItem("demo_it_raw");
        
        if (savedDpoLetter && savedDpoLetter !== "-") document.getElementById('dpo_letter').innerText = savedDpoLetter;
        if (savedDpoRaw && savedDpoRaw !== "Waiting for input...") document.getElementById('dpo_raw').innerText = savedDpoRaw;
        if (savedItLetter && savedItLetter !== "-") document.getElementById('it_letter').innerText = savedItLetter;
        if (savedItRaw && savedItRaw !== "Waiting for input...") document.getElementById('it_raw').innerText = savedItRaw;
        
        console.log("Form state restored successfully");
    } catch (error) {
        console.error("Error restoring form state:", error);
    }
}

// Restore table highlight after data is loaded
function restoreTableHighlight() {
    if (!isLocalStorageAvailable()) return;
    
    const savedHighlightedRow = localStorage.getItem("demo_highlightedRow");
    if (savedHighlightedRow !== null) {
        const rows = document.querySelectorAll('#mcqa-table tr');
        if (rows[savedHighlightedRow]) {
            rows[savedHighlightedRow].classList.add('highlighted');
        }
    }
}

// Save form state before leaving page
window.addEventListener("beforeunload", () => {
    saveFormState();
});

// Set up auto-save on input changes
function setupAutoSave() {
    document.getElementById('question').addEventListener('input', saveFormState);
    document.getElementById('explanation').addEventListener('change', saveFormState);
    
    for(let i = 0; i < MAX_OPTIONS; i++) {
        const optInput = document.getElementById('opt' + i);
        if (optInput) {
            optInput.addEventListener('input', saveFormState);
        }
    }
}

// Freeze function for MCQA
function freezeMCQAInputs() {
    console.log("Freezing MCQA inputs");
    
    // Disable all input elements
    document.getElementById('question').disabled = true;
    document.getElementById('send').disabled = true;
    document.getElementById('add-option').disabled = true;
    document.getElementById('clear').disabled = true;
    document.getElementById('explanation').disabled = true;
    
    // Show the stop button
    document.getElementById('stop').style.display = 'inline-block';
    
    // Disable all option inputs
    for(let i = 0; i < MAX_OPTIONS; i++) {
        const optInput = document.getElementById('opt' + i);
        if (optInput) optInput.disabled = true;
    }
    
    // Disable table interactions
    const tableRows = document.querySelectorAll('#mcqa-table tr');
    tableRows.forEach(row => {
        row.style.pointerEvents = 'none';
        row.style.opacity = '0.7';
    });
    
    updateSystemStatus("Processing your request...");
}

// Unfreeze function for MCQA
function unfreezeMCQAInputs() {
    console.log("Unfreezing MCQA inputs");
    
    // Enable all input elements
    document.getElementById('question').disabled = false;
    document.getElementById('send').disabled = false;
    document.getElementById('add-option').disabled = false;
    document.getElementById('clear').disabled = false;
    document.getElementById('explanation').disabled = false;
    
    // Hide the stop button
    document.getElementById('stop').style.display = 'none';
    
    // Enable all option inputs
    for(let i = 0; i < MAX_OPTIONS; i++) {
        const optInput = document.getElementById('opt' + i);
        if (optInput) optInput.disabled = false;
    }
    
    // Enable table interactions
    const tableRows = document.querySelectorAll('#mcqa-table tr');
    tableRows.forEach(row => {
        row.style.pointerEvents = 'auto';
        row.style.opacity = '1';
    });
    
    updateSystemStatus("Ready");
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

// Connection recovery function
function checkAndRecoverConnection() {
    const apiStatusElement = document.getElementById('api-status');
    if (!apiStatusElement) return;
    
    const statusText = apiStatusElement.textContent.toLowerCase();
    if (statusText.includes('failed') || statusText.includes('error') || statusText.includes('background')) {
        console.log('Checking MCQA connection status...');
        updateAPIStatus("Checking connection...");
        
        if (gradioApp && apiConnected) {
            updateAPIStatus("Connected");
        } else if (!apiInitializing) {
            updateAPIStatus("Reconnecting...");
            initializeGradioClient().then(success => {
                if (success) {
                    updateAPIStatus("Reconnected successfully");
                } else {
                    updateAPIStatus("Reconnection failed");
                }
            });
        }
    }
}

// --- 1. Load CSV ---
Papa.parse("https://raw.githubusercontent.com/starfriend10/WaterScope-AI-demo/main/Data/Decarbonization_MCQA.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        console.log("CSV loaded:", results.data);
        MCQA_DATA = results.data;
        populateTable();
        restoreTableHighlight();
        updateSystemStatus("Dataset loaded successfully");
    },
    error: function(err) {
        console.error("CSV loading error:", err);
        // Fallback to sample data if CSV fails
        MCQA_DATA = [
            {
                ID: "1",
                Question: "What role do wastewater utilities play in the water sector?",
                A: "They primarily focus on desalination.",
                B: "They collect and treat generated wastewater to ensure the effluent can be safely discharged or reused.",
                C: "They distribute bottled water to homes and industries.",
                D: "They only monitor water purity in natural bodies of water."
            },
            {
                ID: "2",
                Question: "What main challenges are facing the water sector due to climate change?",
                A: "Global trade fluctuations",
                B: "Regulatory changes",
                C: "Lack of research and new technologies",
                D: "Extreme weather events, frequent floods or prolonged droughts"
            }
        ];
        populateTable();
        restoreTableHighlight();
        updateSystemStatus("Using sample data (CSV load failed)");
    }
});

// --- 2. Populate MCQA Table ---
function populateTable() {
    const tableBody = document.querySelector('#mcqa-table tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    MCQA_DATA.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.index = idx;
        tr.innerHTML = `<td>${row.ID || ''}</td><td>${row.Question || ''}</td><td>${row.A || ''}</td><td>${row.B || ''}</td><td>${row.C || ''}</td><td>${row.D || ''}</td>`;
        tableBody.appendChild(tr);
    });
}

// --- 3. Click row to autofill ---
document.querySelector('#mcqa-table tbody').addEventListener('click', e => {
    if (isProcessing) return; // Don't allow row selection during processing
    
    const tr = e.target.closest('tr');
    if(!tr) return;
    
    // Remove highlight from all rows
    document.querySelectorAll('#mcqa-table tr').forEach(row => {
        row.classList.remove('highlighted');
    });
    
    // Add highlight to clicked row
    tr.classList.add('highlighted');
    
    const row = MCQA_DATA[tr.dataset.index];
    document.getElementById('question').value = row.Question || '';
    document.getElementById('opt0').value = row.A || '';
    document.getElementById('opt1').value = row.B || '';
    document.getElementById('opt2').value = row.C || '';
    document.getElementById('opt3').value = row.D || '';
    for(let i=4;i<MAX_OPTIONS;i++){
        const el=document.getElementById('opt'+i);
        if(el) el.value="";
    }
    updateSystemStatus("Form filled from dataset");
    
    // Save the form state after autofill
    saveFormState();
});

// --- 4. Add Option ---
document.getElementById('add-option').addEventListener('click', ()=>{
    if (isProcessing) return; // Don't allow adding options during processing
    
    if(currentOptions>=MAX_OPTIONS) {
        updateSystemStatus("Maximum options reached");
        return;
    }
    const container=document.getElementById('option-container');
    
    // Create a new option row with label and input
    const optionRow = document.createElement('div');
    optionRow.className = 'option-row';
    
    // Create the option label
    const label = document.createElement('span');
    label.className = 'option-label';
    label.textContent = String.fromCharCode(65 + currentOptions);
    
    // Create the input field
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'opt' + currentOptions;
    input.placeholder = 'Option ' + String.fromCharCode(65 + currentOptions);
    
    // Add event listener for auto-saving
    input.addEventListener('input', saveFormState);
    
    // Add label and input to the row
    optionRow.appendChild(label);
    optionRow.appendChild(input);
    
    // Add the row to the container
    container.appendChild(optionRow);
    
    currentOptions++;
    updateSystemStatus("Added option " + String.fromCharCode(65 + currentOptions - 1));
    
    // Save the form state after adding option
    saveFormState();
});

// --- 5. Clear All (Inputs Only) ---
document.getElementById('clear').addEventListener('click', ()=>{
    if (isProcessing) return; // Don't allow clearing during processing
    
    // Only clear input fields, don't stop any ongoing processing
    document.getElementById('question').value="";
    for(let i=0;i<MAX_OPTIONS;i++){
        const el=document.getElementById('opt'+i);
        if(el) el.value="";
    }
    document.getElementById('explanation').checked=false;
    
    currentOptions=4;
    const container=document.getElementById('option-container');
    while(container.children.length>4){
        container.removeChild(container.lastChild);
    }
    
    // Remove highlights from table rows
    document.querySelectorAll('#mcqa-table tr').forEach(row => {
        row.classList.remove('highlighted');
    });
    
    // Clear outputs
    document.getElementById('dpo_letter').innerText = "-";
    document.getElementById('dpo_raw').innerText = "Waiting for input...";
    document.getElementById('it_letter').innerText = "-";
    document.getElementById('it_raw').innerText = "Waiting for input...";
    
    // // Stop and reset the timer
    // stopTimer();
    // document.getElementById('elapsed-time').textContent = "0.0s";
    
    // Clear saved data from localStorage
    clearPersistence();
    
    updateSystemStatus("Form cleared");
});

// --- 6. Initialize Gradio Client ---
async function initializeGradioClient() {
    try {
        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        
        // Start the fixed timer for API initialization
        startTimer('warmup');
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        stopTimer();
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        stopTimer();
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
        return false;
    }
}

// --- 7. Handle Stop Request ---
function handleStopRequest() {
    if (isProcessing) {
        isProcessing = false;
        stopTimer();
        unfreezeMCQAInputs(); // Unfreeze inputs when stopping
        updateAPIStatus("Request cancelled");
        console.log("Processing stopped by user");
    }
}

// --- 8. Stop Button Event Listener ---
document.getElementById('stop').addEventListener('click', handleStopRequest);

// --- 9. Run Comparison (using Gradio Client) ---
document.getElementById('send').addEventListener('click', async ()=>{
    const question=document.getElementById('question').value;
    const options=[];
    for(let i=0;i<MAX_OPTIONS;i++){
        const el=document.getElementById('opt'+i);
        options.push(el?el.value:"");
    }
    const explanation=document.getElementById('explanation').checked;

    // Validate inputs
    const activeOptions = options.filter(opt => opt && opt.trim());
    if (!question || activeOptions.length < 2) {
        updateAPIStatus("Please enter a question and at least two options");
        alert("Please enter a question and at least two options");
        return;
    }

    // Initialize client if not already done
    if (!gradioApp) {
        updateAPIStatus("Initializing connection to AI API...");
        const success = await initializeGradioClient();
        if (!success) {
            updateAPIStatus("Failed to connect to AI API. Please try again.");
            alert("Failed to connect to AI API. Please try again.");
            return;
        }
    }

    try {
        // Set processing flag and update UI
        isProcessing = true;
        
        // Freeze inputs before processing
        freezeMCQAInputs();
        
        // Start the fixed timer for processing
        startTimer('processing');
        updateAPIStatus("Processing your question...");
        
        // Call the API with correct parameter names
        const result = await gradioApp.predict("/run_mcqa_comparison", {
            question: question,
            opt_a: options[0],
            opt_b: options[1],
            opt_c: options[2],
            opt_d: options[3],
            opt_e: options[4],
            opt_f: options[5],
            opt_g: options[6],
            opt_h: options[7],
            generate_explanation: explanation
        });

        // Check if processing was cancelled
        if (!isProcessing) {
            console.log("Processing was cancelled, ignoring results");
            return;
        }
        
        // Update results
        const outputs = result.data;
        // Assuming the API returns [base_letter, base_raw, it_letter, it_raw, dpo_letter, dpo_raw]
        // We'll skip the base model outputs (index 0 and 1)
        document.getElementById('dpo_letter').innerText = outputs[4] || "";
        document.getElementById('dpo_raw').innerText = outputs[5] || "";
        document.getElementById('it_letter').innerText = outputs[2] || "";
        document.getElementById('it_raw').innerText = outputs[3] || "";
        
        updateAPIStatus("Evaluation completed successfully");
        
        // Save the form state after getting results
        saveFormState();
        
    } catch (err) {
        // Only show error if we didn't cancel the request
        if (isProcessing) {
            console.error('API Error:', err);
            updateAPIStatus('Error: ' + err.message);
            alert('Error calling API: ' + err.message);
        }
    } finally {
        // Always clean up, even if there was an error
        if (isProcessing) {
            // Stop the processing timer
            stopTimer();
            
            // Unfreeze inputs
            unfreezeMCQAInputs();
            
            // Reset processing flag
            isProcessing = false;
        }
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Initializing API connection...");
    
    // Check if there's an active timer from a previous session and resume it
    const savedStartTime = localStorage.getItem('mcqaTimerStartTime');
    if (savedStartTime) {
        console.log('Resuming previous MCQA timer session');
        timerStartTime = parseInt(savedStartTime);
        timerInterval = setInterval(updateTimerDisplay, 100);
        updateTimerDisplay();
    } else {
        // Show initial state
        const elapsedTimeElement = document.getElementById('elapsed-time');
        if (elapsedTimeElement) {
            elapsedTimeElement.textContent = "0.0s";
        }
    }
    
    // Restore form state after a short delay to ensure DOM is fully loaded
    setTimeout(() => {
        restoreFormState();
        setupAutoSave();
    }, 100);
    
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
});
