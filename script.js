// mcqa-evaluator.js
const MAX_OPTIONS = 8;
let currentOptions = 4;
let MCQA_DATA = [];
let gradioApp = null;

// Timer functionality
let timerInterval = null;
let startTime = null;
let warmupTimerInterval = null;
let warmupStartTime = null;

function startTimer(type) {
    if (type === 'warmup') {
        warmupStartTime = Date.now();
        document.getElementById('time-display').style.display = 'flex';
        document.getElementById('time-label').textContent = 'Warm-up time: ';
        
        if (warmupTimerInterval) clearInterval(warmupTimerInterval);
        
        warmupTimerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - warmupStartTime) / 1000;
            document.getElementById('elapsed-time').textContent = elapsedTime.toFixed(1);
        }, 100);
    } else if (type === 'processing') {
        startTime = Date.now();
        document.getElementById('time-display').style.display = 'flex';
        document.getElementById('time-label').textContent = 'Processing time: ';
        
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            const elapsedTime = (Date.now() - startTime) / 1000;
            document.getElementById('elapsed-time').textContent = elapsedTime.toFixed(1);
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

// Status update function
function updateStatus(message) {
    document.getElementById('status-message').textContent = message;
}

// --- 1. Load CSV ---
Papa.parse("https://raw.githubusercontent.com/starfriend10/WaterScope-AI-demo/main/Decarbonization_MCQA.csv", {
  download: true,
  header: true,
  encoding: "UTF-8", // Explicitly set encoding
  skipEmptyLines: true,
  complete: function(results) {
    console.log("CSV loaded:", results.data);
    MCQA_DATA = results.data;
    populateTable();
    updateStatus("Dataset loaded successfully");
  },
  error: function(err) {
    console.error("CSV loading error:", err);
    // Fallback to sample data if CSV fails
    MCQA_DATA = [
      {
        Question: "What role do wastewater utilities play in the water sector?",
        A: "They primarily focus on desalination.",
        B: "They collect and treat generated wastewater to ensure the effluent can be safely discharged or reused.",
        C: "They distribute bottled water to homes and industries.",
        D: "They only monitor water purity in natural bodies of water."
      },
      {
        Question: "What main challenges are facing the water sector due to climate change?",
        A: "Global trade fluctuations",
        B: "Regulatory changes",
        C: "Lack of research and new technologies",
        D: "Extreme weather events, frequent floods or prolonged droughts"
      }
    ];
    populateTable();
    updateStatus("Using sample data (CSV load failed)");
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
    tr.innerHTML = `<td>${row.Question}</td><td>${row.A}</td><td>${row.B}</td><td>${row.C}</td><td>${row.D}</td>`;
    tableBody.appendChild(tr);
  });
}

// --- 3. Click row to autofill ---
document.querySelector('#mcqa-table tbody').addEventListener('click', e => {
  const tr = e.target.closest('tr');
  if(!tr) return;
  
  // Remove highlight from all rows
  document.querySelectorAll('#mcqa-table tr').forEach(row => {
    row.classList.remove('highlighted');
  });
  
  // Add highlight to clicked row
  tr.classList.add('highlighted');
  
  const row = MCQA_DATA[tr.dataset.index];
  document.getElementById('question').value = row.Question;
  document.getElementById('opt0').value = row.A;
  document.getElementById('opt1').value = row.B;
  document.getElementById('opt2').value = row.C;
  document.getElementById('opt3').value = row.D;
  for(let i=4;i<MAX_OPTIONS;i++){
    const el=document.getElementById('opt'+i);
    if(el) el.value="";
  }
  updateStatus("Form filled from dataset");
});

// --- 4. Add Option ---
document.getElementById('add-option').addEventListener('click', ()=>{
  if(currentOptions>=MAX_OPTIONS) {
    updateStatus("Maximum options reached");
    return;
  }
  const container=document.getElementById('option-container');
  
  // Create a new option row with label and input
  const optionRow = document.createElement('div');
  optionRow.className = 'option-row';
  
  // Create the option label
  const label = document.createElement('span');
  label.className = 'option-label';
  label.textContent = String.fromCharCode(65 + currentOptions) + ':';
  
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
  updateStatus("Added option " + String.fromCharCode(65 + currentOptions - 1));
});

// --- 5. Clear All ---
document.getElementById('clear').addEventListener('click', ()=>{
  document.getElementById('question').value="";
  for(let i=0;i<MAX_OPTIONS;i++){
    const el=document.getElementById('opt'+i);
    if(el) el.value="";
  }
  document.getElementById('explanation').checked=false;
  ['base_letter','base_raw','it_letter','it_raw','dpo_letter','dpo_raw'].forEach(id=>{
    document.getElementById(id).innerText="";
  });
  currentOptions=4;
  const container=document.getElementById('option-container');
  while(container.children.length>4){
    container.removeChild(container.lastChild);
  }
  
  // Remove highlights from table rows
  document.querySelectorAll('#mcqa-table tr').forEach(row => {
    row.classList.remove('highlighted');
  });
  
  // Also hide the time display when clearing
  document.getElementById('time-display').style.display = 'none';
  updateStatus("Form cleared");
});

// --- 6. Initialize Gradio Client ---
async function initializeGradioClient() {
  try {
    updateStatus("Initializing connection to AI API...");
    startTimer('warmup');
    
    // Import the Gradio client
    const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
    
    // Connect to your Hugging Face Space
    gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
    
    console.log("Gradio client initialized successfully");
    stopTimer('warmup');
    updateStatus("Connected to AI API successfully");
  } catch (error) {
    console.error("Failed to initialize Gradio client:", error);
    stopTimer('warmup');
    updateStatus("Failed to connect to AI API. Please check console for details.");
  }
}

// --- 7. Run Comparison (using Gradio Client) ---
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
    updateStatus("Please enter a question and at least two options");
    alert("Please enter a question and at least two options");
    return;
  }

  // Initialize client if not already done
  if (!gradioApp) {
    updateStatus("Initializing connection to AI API...");
    await initializeGradioClient();
    if (!gradioApp) {
      updateStatus("Failed to connect to AI API. Please try again.");
      alert("Failed to connect to AI API. Please try again.");
      return;
    }
  }

  try {
    // Start the processing timer
    startTimer('processing');
    updateStatus("Processing your question...");
    
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

    // Update results
    const outputs = result.data;
    document.getElementById('base_letter').innerText = outputs[0] || "";
    document.getElementById('base_raw').innerText = outputs[1] || "";
    document.getElementById('it_letter').innerText = outputs[2] || "";
    document.getElementById('it_raw').innerText = outputs[3] || "";
    document.getElementById('dpo_letter').innerText = outputs[4] || "";
    document.getElementById('dpo_raw').innerText = outputs[5] || "";
    
    updateStatus("Evaluation completed successfully");
    // Stop the processing timer on success
    stopTimer('processing');
  } catch (err) {
    // Stop the processing timer on error
    stopTimer('processing');
    console.error('API Error:', err);
    updateStatus('Error: ' + err.message);
    alert('Error calling API: ' + err.message);
  }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  updateStatus("Initializing application...");
  // Initialize Gradio client when page loads
  initializeGradioClient().catch(console.error);
});
