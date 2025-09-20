// MCQA Testing Script
let MCQA_DATA = [];
let testResults = [];
let currentQuestionIndex = 0;
let isTesting = false;
let gradioApp = null;
let testPaused = false;

// DOM Elements
const startTestBtn = document.getElementById('start-test');
const pauseTestBtn = document.getElementById('pause-test');
const resumeTestBtn = document.getElementById('resume-test');
const exportResultsBtn = document.getElementById('export-results');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const statusMessage = document.getElementById('status-message');
const resultsSummary = document.getElementById('results-summary');
const resultsTable = document.getElementById('results-table').querySelector('tbody');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    updateStatus("Loading MCQA dataset...");
    
    // Load the MCQA dataset
    Papa.parse("https://raw.githubusercontent.com/starfriend10/WaterScope-AI-demo/main/Data/Decarbonization_MCQA.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            MCQA_DATA = results.data;
            updateStatus("Dataset loaded successfully. Ready to start testing.");
            startTestBtn.disabled = false;
        },
        error: function(err) {
            updateStatus("Error loading dataset: " + err.message, "error");
            console.error("CSV loading error:", err);
        }
    });

    // Set up event listeners
    startTestBtn.addEventListener('click', startTest);
    pauseTestBtn.addEventListener('click', pauseTest);
    resumeTestBtn.addEventListener('click', resumeTest);
    exportResultsBtn.addEventListener('click', exportResults);
});

// Initialize Gradio Client
async function initializeGradioClient() {
    try {
        updateStatus("Initializing connection to AI API...");
        
        // Import the Gradio client
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        
        // Connect to your Hugging Face Space
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        
        console.log("Gradio client initialized successfully");
        updateStatus("Connected to AI API successfully");
        return true;
    } catch (error) {
        console.error("Failed to initialize Gradio client:", error);
        updateStatus("Failed to connect to AI API. Please check console for details.", "error");
        return false;
    }
}

// Start the test
async function startTest() {
    if (MCQA_DATA.length === 0) {
        updateStatus("No data available. Please load the dataset first.", "error");
        return;
    }

    // Initialize client if not already done
    if (!gradioApp) {
        const success = await initializeGradioClient();
        if (!success) return;
    }

    isTesting = true;
    testPaused = false;
    currentQuestionIndex = 0;
    testResults = [];
    
    startTestBtn.disabled = true;
    pauseTestBtn.disabled = false;
    exportResultsBtn.disabled = true;
    
    updateStatus("Starting test...");
    
    // Process questions one by one
    processNextQuestion();
}

// Pause the test
function pauseTest() {
    testPaused = true;
    pauseTestBtn.disabled = true;
    resumeTestBtn.disabled = false;
    updateStatus("Test paused");
}

// Resume the test
function resumeTest() {
    testPaused = false;
    pauseTestBtn.disabled = false;
    resumeTestBtn.disabled = true;
    updateStatus("Resuming test...");
    processNextQuestion();
}

// Process the next question
async function processNextQuestion() {
    if (!isTesting || testPaused || currentQuestionIndex >= MCQA_DATA.length) {
        if (currentQuestionIndex >= MCQA_DATA.length) {
            finishTest();
        }
        return;
    }

    const questionData = MCQA_DATA[currentQuestionIndex];
    updateStatus(`Processing question ${currentQuestionIndex + 1}/${MCQA_DATA.length}: ${questionData.Question.substring(0, 50)}...`);

    try {
        // Call the API
        const result = await gradioApp.predict("/run_mcqa_comparison", {
            question: questionData.Question,
            opt_a: questionData.A || "",
            opt_b: questionData.B || "",
            opt_c: questionData.C || "",
            opt_d: questionData.D || "",
            opt_e: "",
            opt_f: "",
            opt_g: "",
            opt_h: "",
            generate_explanation: true
        });

        // Extract results
        const outputs = result.data;
        const resultEntry = {
            id: currentQuestionIndex,
            question: questionData.Question,
            base_letter: outputs[0] || "",
            it_letter: outputs[2] || "",
            dpo_letter: outputs[4] || ""
        };

        testResults.push(resultEntry);
        updateResultsTable(resultEntry);
        
        // Update progress
        currentQuestionIndex++;
        const progressPercent = (currentQuestionIndex / MCQA_DATA.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
        progressText.textContent = `${currentQuestionIndex}/${MCQA_DATA.length} (${Math.round(progressPercent)}%)`;
        
        // Process next question after a short delay to avoid rate limiting
        setTimeout(processNextQuestion, 500);
    } catch (error) {
        console.error("Error processing question:", error);
        updateStatus(`Error processing question ${currentQuestionIndex + 1}: ${error.message}`, "error");
        
        // Add error entry
        const resultEntry = {
            id: currentQuestionIndex,
            question: questionData.Question,
            base_letter: "ERROR",
            it_letter: "ERROR",
            dpo_letter: "ERROR"
        };
        
        testResults.push(resultEntry);
        updateResultsTable(resultEntry);
        
        // Continue with next question
        currentQuestionIndex++;
        const progressPercent = (currentQuestionIndex / MCQA_DATA.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
        progressText.textContent = `${currentQuestionIndex}/${MCQA_DATA.length} (${Math.round(progressPercent)}%)`;
        
        setTimeout(processNextQuestion, 1000);
    }
}

// Finish the test
function finishTest() {
    isTesting = false;
    testPaused = false;
    
    startTestBtn.disabled = false;
    pauseTestBtn.disabled = true;
    resumeTestBtn.disabled = true;
    exportResultsBtn.disabled = false;
    
    updateStatus("Test completed successfully!");
    updateSummary();
}

// Update the results table
function updateResultsTable(result) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>${result.id + 1}</td>
        <td>${result.question.substring(0, 70)}${result.question.length > 70 ? '...' : ''}</td>
        <td>${result.base_letter}</td>
        <td>${result.it_letter}</td>
        <td>${result.dpo_letter}</td>
    `;
    
    resultsTable.appendChild(row);
}

// Update the summary
function updateSummary() {
    if (testResults.length === 0) return;
    
    const baseCounts = {};
    const itCounts = {};
    const dpoCounts = {};
    let errors = 0;
    
    testResults.forEach(result => {
        if (result.base_letter === "ERROR") errors++;
        
        baseCounts[result.base_letter] = (baseCounts[result.base_letter] || 0) + 1;
        itCounts[result.it_letter] = (itCounts[result.it_letter] || 0) + 1;
        dpoCounts[result.dpo_letter] = (dpoCounts[result.dpo_letter] || 0) + 1;
    });
    
    const baseSummary = Object.entries(baseCounts)
        .map(([letter, count]) => `${letter}: ${count}`)
        .join(", ");
    
    const itSummary = Object.entries(itCounts)
        .map(([letter, count]) => `${letter}: ${count}`)
        .join(", ");
    
    const dpoSummary = Object.entries(dpoCounts)
        .map(([letter, count]) => `${letter}: ${count}`)
        .join(", ");
    
    resultsSummary.innerHTML = `
        <p><strong>Total Questions Processed:</strong> ${testResults.length}</p>
        <p><strong>Errors:</strong> ${errors}</p>
        <p><strong>Base Model Predictions:</strong> ${baseSummary}</p>
        <p><strong>IT Model Predictions:</strong> ${itSummary}</p>
        <p><strong>DPO Model Predictions:</strong> ${dpoSummary}</p>
    `;
}

// Export results to CSV
function exportResults() {
    if (testResults.length === 0) {
        updateStatus("No results to export", "error");
        return;
    }
    
    // Convert results to CSV
    let csvContent = "Question ID,Question,Base Model,IT Model,DPO Model\n";
    
    testResults.forEach(result => {
        const row = [
            result.id + 1,
            `"${result.question.replace(/"/g, '""')}"`,
            result.base_letter,
            result.it_letter,
            result.dpo_letter
        ].join(",");
        
        csvContent += row + "\n";
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `mcqa_test_results_${date}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateStatus("Results exported successfully");
}

// Update status message
function updateStatus(message, type = "info") {
    statusMessage.textContent = message;
    
    if (type === "error") {
        statusMessage.style.backgroundColor = "#ffebee";
        statusMessage.style.borderLeft = "4px solid #f44336";
    } else {
        statusMessage.style.backgroundColor = "#e8f4fd";
        statusMessage.style.borderLeft = "4px solid #2196f3";
    }
}
