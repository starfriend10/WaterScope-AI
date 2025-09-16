const MAX_OPTIONS = 8;
let currentOptions = 4;
let MCQA_DATA = [];

// --- 1. Load CSV ---
Papa.parse("https://starfriend10.github.io/WaterScope-AI-demo/Decarbonization_MCQA.csv", {
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
    }
});

// --- 2. Populate MCQA Table ---
function populateTable() {
    const tableBody = document.querySelector('#mcqa-table tbody');
    tableBody.innerHTML = "";
    MCQA_DATA.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.index = idx;
        tr.innerHTML = `<td>${row.Question}</td>
                        <td>${row.A}</td>
                        <td>${row.B}</td>
                        <td>${row.C}</td>
                        <td>${row.D}</td>`;
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

    for(let i = 4; i < MAX_OPTIONS; i++){
        const el = document.getElementById('opt'+i);
        if(el) el.value = "";
    }
});

// --- 4. Add Option ---
document.getElementById('add-option').addEventListener('click', () => {
    if(currentOptions >= MAX_OPTIONS) return;
    const container = document.getElementById('option-container');
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'opt'+currentOptions;
    input.placeholder = 'Option ' + String.fromCharCode(65 + currentOptions);
    container.appendChild(input);
    currentOptions++;
});

// --- 5. Clear All ---
document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('question').value = "";
    for(let i = 0; i < MAX_OPTIONS; i++){
        const el = document.getElementById('opt'+i);
        if(el) el.value = "";
    }
    document.getElementById('explanation').checked = false;
    ['base_letter','base_raw','it_letter','it_raw','dpo_letter','dpo_raw'].forEach(id => {
        document.getElementById(id).innerText = "";
    });
    currentOptions = 4;
    const container = document.getElementById('option-container');
    while(container.children.length > 4){
        container.removeChild(container.lastChild);
    }
});

// --- 6. Run Comparison (call Hugging Face Space API) ---
document.getElementById('send').addEventListener('click', async () => {
    const question = document.getElementById('question').value;
    const options = [];
    for(let i = 0; i < MAX_OPTIONS; i++){
        const el = document.getElementById('opt'+i);
        options.push(el ? el.value : "");
    }
    const explanation = document.getElementById('explanation').checked;

    // --- Prepare payload for HF Space API ---
    const payload = { data: [question, ...options, explanation] };

    const url = "https://hf.space/embed/EnvironLLM/EnvironLLM/api/predict/";

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if(!res.ok){
            throw new Error("HTTP error " + res.status);
        }

        const data = await res.json();
        const outputs = data.data;

        ['base_letter','base_raw','it_letter','it_raw','dpo_letter','dpo_raw'].forEach((id, i) => {
            document.getElementById(id).innerText = outputs[i] || "";
        });

    } catch(err) {
        alert('Error calling Hugging Face Space API: ' + err);
        console.error(err);
    }
});
