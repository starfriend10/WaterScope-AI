// mcqa-evaluator.js
const MAX_OPTIONS = 8;
let currentOptions = 4;
let MCQA_DATA = [];
let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;

// Timer functionality
let timerInterval = null;
let startTime = null;
let warmupTimerInterval = null;
let warmupStartTime = null;

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

function startTimer(type) {
    if (type === 'warmup') {
        warmupStartTime = Date.now();
        document.getElementById('elapsed-time').style.display = 'block';
        
        if (warmupTimerInterval) clearInterval(warmupTimerInterval);
        
        warmupTimerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - warmupStartTime) / 1000;
            document.getElementById('elapsed-time').textContent = elapsedTime.toFixed(1) + 's';
        }, 100);
    } else if (type === 'processing') {
        startTime = Date.now();
        document.getElementById('elapsed-time').style.display = 'block';
        
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - startTime) / 1000;
            document.getElementById('elapsed-time').textContent = elapsedTime.toFixed(1) + 's';
        }, 100);
    }
}

function stopTimer(type) {
    if (type === 'warmup' && warmupTimerInterval) {
        clearInterval(warmupTimerInterval);
        warmupTimerInterval = null;
    } else if (type === 'processing' && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
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
        
        if (message.toLowerCase().includes('processing')) {
            element.classList.add('status-processing');
        } else if (message.toLowerCase().includes('connected') || message.toLowerCase().includes('received')) {
            element.classList.add('status-ready');
        } else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
            element.classList.add('status-error');
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
    // Removed the line that tries to set ID field since it doesn't exist in the form
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
    
    // Add label and input to the row
    optionRow.appendChild(label);
    optionRow.appendChild(input);
    
    // Add the row to the container
    container.appendChild(optionRow);
    
    currentOptions++;
    updateSystemStatus("Added option " + String.fromCharCode(65 + currentOptions - 1));
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
    
    updateSystemStatus("Form cleared");
    
    // Don't modify API status as it might be in the middle of processing
    document.getElementById('elapsed-time').textContent = "0.0s";
});

// --- 6. Initialize Gradio Client ---
async function initializeGradioClient() {
    try {
        apiInitializing = true;
        updateAPIStatus("Initializing connection to AI API...");
        startTimer('warmup');
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        stopTimer('warmup');
        apiInitializing = false;
        apiConnected = true;
        updateAPIStatus("Connected to AI API successfully");
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        stopTimer('warmup');
        apiInitializing = false;
        apiConnected = false;
        updateAPIStatus("Failed to connect to AI API");
    }
}

// --- 7. Handle Stop Request ---
function handleStopRequest() {
    if (isProcessing) {
        isProcessing = false;
        stopTimer('processing');
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
        await initializeGradioClient();
        if (!gradioApp) {
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
        
        // Start the processing timer
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
            stopTimer('processing');
            
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
    // Initialize Gradio client when page loads
    initializeGradioClient().catch(console.error);
});


// ===== Demo input persistence across page switches =====

document.addEventListener("DOMContentLoaded", async () => {
    // 1️⃣ Restore demo state
    const savedState = localStorage.getItem("demoState");
    if (savedState) {
        console.log("Restoring saved demo state...");
        setDemoState(JSON.parse(savedState));
        console.log("Demo state restored successfully");
    }

    // 2️⃣ Initialize application status
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Initializing API connection...");

    // 3️⃣ Initialize Gradio client
    try {
        await initializeGradioClient();
    } catch (err) {
        console.error("Error initializing Gradio client:", err);
    }
});
