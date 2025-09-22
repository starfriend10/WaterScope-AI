let gradioApp = null;
let apiInitializing = false;
let apiConnected = false;
let isProcessing = false;
let chatHistory = [];

// Timer
let timerInterval = null;
let startTime = null;
let apiInitStartTime = null;

function startTimer(type='message') {
    const elapsedTimeElement = document.getElementById('elapsed-time');
    if (!elapsedTimeElement) return;

    if (type === 'api-init') {
        if (!apiInitStartTime) apiInitStartTime = Date.now();
    } else {
        if (!startTime) startTime = Date.now();
    }

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = type==='api-init'
            ? (now-apiInitStartTime)/1000
            : (now-startTime)/1000;
        elapsedTimeElement.textContent = elapsed.toFixed(1) + 's';
    }, 100);

    elapsedTimeElement.style.display = 'block';
}

function stopTimer(type='message') {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (type==='api-init') apiInitStartTime=null;
    else startTime=null;
}

// Status update
function updateSystemStatus(msg){document.getElementById('system-status')?.textContent=msg;}
function updateAPIStatus(msg){document.getElementById('api-status')?.textContent=msg;}

// Input freeze/unfreeze
function freezeInputPanel(){
    const u=document.getElementById('user-input'), s=document.getElementById('send-chat'), c=document.getElementById('clear-chat');
    if(u){u.disabled=true;u.setAttribute('readonly','readonly');u.placeholder='Processing your request...';}
    if(s)s.disabled=true;if(c)c.disabled=true;
    updateSystemStatus("Processing your request...");
}
function unfreezeInputPanel(){
    const u=document.getElementById('user-input'), s=document.getElementById('send-chat'), c=document.getElementById('clear-chat');
    if(u){u.disabled=false;u.removeAttribute('readonly');u.placeholder='Type your message here...';u.focus();}
    if(s)s.disabled=false;if(c)c.disabled=false;
    updateSystemStatus("Ready");
}

// Initialize Gradio
async function initializeGradioClient(){
    try{
        if(gradioApp) return true;
        apiInitializing=true;
        updateAPIStatus("Initializing connection to AI API...");
        startTimer('api-init');
        const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
        gradioApp = await Client.connect("EnvironmentalAI/WaterScopeAI");
        console.log("Gradio initialized");
        apiInitializing=false;
        apiConnected=true;
        updateAPIStatus("Connected to AI API");
        updateSystemStatus("Ready");
        stopTimer('api-init');
        return true;
    }catch(e){
        console.error("Gradio init failed:",e);
        apiInitializing=false;
        apiConnected=false;
        updateAPIStatus("Failed to connect");
        updateSystemStatus("Connection Error");
        stopTimer('api-init');
        return false;
    }
}

// Send message
async function sendMessage(){
    const u=document.getElementById('user-input');if(!u)return;
    const msg=u.value.trim();if(!msg)return;
    freezeInputPanel();
    addMessage(msg,true);u.value='';u.style.height='auto';
    if(!gradioApp){const success=await initializeGradioClient();if(!success){addMessage("Sorry, can't connect.",false);unfreezeInputPanel();return;}}
    try{
        isProcessing=true;
        updateAPIStatus("Processing your message...");
        startTimer('message');
        const result=await gradioApp.predict("/respond",{message:msg,chat_history:chatHistory});
        const assistantResponse=extractAssistantResponse(result);
        chatHistory.push([msg,assistantResponse]);
        addMessage(assistantResponse,false);
        updateAPIStatus("Response received");
    }catch(e){console.error(e);updateAPIStatus("Error");addMessage("Error occurred.",false);}
    finally{isProcessing=false;stopTimer('message');unfreezeInputPanel();}
}

// Add message
function addMessage(text,isUser){
    const chatMessages=document.getElementById('chat-messages');if(!chatMessages)return;
    const div=document.createElement('div');div.className=isUser?'message user-message':'message bot-message';
    div.innerHTML=`<div class="message-content"><p>${text}</p></div>`;
    chatMessages.appendChild(div);chatMessages.scrollTop=chatMessages.scrollHeight;
}

// Extract assistant response
function extractAssistantResponse(apiResult){
    try{
        if(apiResult?.data?.length>=2){
            const hist=apiResult.data[1];
            if(hist.length>0){
                const last=hist[hist.length-1];
                if(Array.isArray(last)&&last.length>=2) return last[1]||"No response";
            }
        }
        return "Failed to extract response";
    }catch(e){console.error(e);return "Error processing response";}
}

// Clear chat
function clearChat(){
    const chatMessages=document.getElementById('chat-messages');
    if(chatMessages) chatMessages.innerHTML=`<div class="message bot-message"><div class="message-content"><p>Hello! I'm a specialized AI model for water sustainability. How can I assist you today?</p></div></div>`;
    chatHistory=[];
    updateAPIStatus("Ready");updateSystemStatus("Ready");
    document.getElementById('elapsed-time').textContent="0.0s";
}

// Setup textarea auto resize
function setupAutoResize(){
    const u=document.getElementById('user-input');if(!u)return;
    u.addEventListener('input',()=>{u.style.height='auto';u.style.height=(u.scrollHeight)+'px';});
    u.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();setTimeout(()=>{u.style.height='auto'},10);}});
}

// Add clear button
function addClearButton(){
    const c=document.querySelector('.chat-input-container');if(!c||document.getElementById('clear-chat'))return;
    const b=document.createElement('button');b.id='clear-chat';b.className='btn-secondary';b.innerHTML='<i class="fas fa-broom"></i> Clear Chat';b.addEventListener('click',clearChat);
    c.appendChild(b);
}

// Setup events
function setupEventListeners(){
    const s=document.getElementById('send-chat'),u=document.getElementById('user-input');
    if(s)s.addEventListener('click',sendMessage);
    if(u)u.addEventListener('keypress',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
}

// Load page
document.addEventListener('DOMContentLoaded',async()=>{
    updateSystemStatus("Initializing application...");
    updateAPIStatus("Initializing API...");
    const e=document.getElementById('elapsed-time');if(e){e.style.display='block';e.textContent='0.0s';}
    addClearButton();setupAutoResize();setupEventListeners();
    // Restore chat
    const h=localStorage.getItem('chatHistory');if(h)chatHistory=JSON.parse(h);
    const html=localStorage.getItem('chatMessagesHTML'),s=localStorage.getItem('chatScrollTop');const chatMessages=document.getElementById('chat-messages');
    if(chatMessages&&html){chatMessages.innerHTML=html;if(s)chatMessages.scrollTop=parseInt(s,10);}
    startTime=localStorage.getItem('startTime')?parseInt(localStorage.getItem('startTime')):null;
    apiInitStartTime=localStorage.getItem('apiInitStartTime')?parseInt(localStorage.getItem('apiInitStartTime')):null;

    // Initialize Gradio client immediately
    await initializeGradioClient();
});

// Save chat state
window.addEventListener("beforeunload",()=>{
    localStorage.setItem("chatHistory",JSON.stringify(chatHistory));
    if(startTime)localStorage.setItem("startTime",startTime);
    if(apiInitStartTime)localStorage.setItem("apiInitStartTime",apiInitStartTime);
    const chatMessages=document.getElementById('chat-messages');
    if(chatMessages){localStorage.setItem("chatMessagesHTML",chatMessages.innerHTML);localStorage.setItem("chatScrollTop",chatMessages.scrollTop);}
});
