// mcqa-evaluator.js
const MAX_OPTIONS = 8;
let currentOptions = 4;
let MCQA_DATA = [];
let gradioApp = null;

// Timer functionality
let timerInterval = null;
let startTime = null;

function startTimer() {
    startTime = Date.now();
    document.getElementById('time-display').style.display = 'block';
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('elapsed-time').textContent = elapsedSeconds;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Remove the updateStatus function as it's trying to update a non-existent element
// function updateStatus(message) {
//   const statusElement = document.getElementById('status');
//   if (statusElement) {
//     statusElement.innerText = message;
//   }
// }

// --- 1. Load CSV ---
Papa.parse("https://raw.githubusercontent.com/starfriend10/WaterScope-AI-demo/main/Decarbonization_MCQA.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function(results) {
    console.log("CSV loaded:", results.data);
    MCQA_DATA = results.data;
    populateTable();
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
});

// --- 4. Add Option ---
document.getElementById('add-option').addEventListener('click', ()=>{
  if(currentOptions>=MAX_OPTIONS) return;
  const container=document.getElementById('option-container');
  const input=document.createElement('input');
  input.type='text';
  input.id='opt'+currentOptions;
  input.placeholder='Option '+String.fromCharCode(65+currentOptions);
  container.appendChild(input);
  currentOptions++;
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
  
  // Also hide the time display when clearing
  document.getElementById('time-display').style.display = 'none';
});

// --- 6. Initialize Gradio Client ---
async function initializeGradioClient() {
  try {
    // Import the Gradio client
    const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
    
    // Connect to your Hugging Face Space
    gradioApp = await Client.connect("EnvironLLM/EnvironLLM");
    
    console.log("Gradio client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Gradio client:", error);
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
    alert("Please enter a question and at least two options");
    return;
  }

  // Initialize client if not already done
  if (!gradioApp) {
    await initializeGradioClient();
    if (!gradioApp) {
      alert("Failed to connect to AI API. Please try again.");
      return;
    }
  }

  try {
    // Start the timer
    startTimer();
    
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
    
    // Stop the timer on success
    stopTimer();
  } catch (err) {
    // Stop the timer on error
    stopTimer();
    console.error('API Error:', err);
    alert('Error calling API: ' + err.message);
  }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Gradio client when page loads
  initializeGradioClient().catch(console.error);
});
