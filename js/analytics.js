// analytics.js

(function() {
    const VISITOR_KEY = 'visitor_id';
    const SESSION_KEY = 'session_expiry';
    const IDLE_TIMEOUT_MINUTES = 30;

    // Generate unique visitor ID
    function generateVisitorID() {
        return 'v_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    }

    // Get or create visitor ID
    function getVisitorID() {
        let visitorID = localStorage.getItem(VISITOR_KEY);
        if (!visitorID) {
            visitorID = generateVisitorID();
            localStorage.setItem(VISITOR_KEY, visitorID);
            console.log('New visitor ID assigned:', visitorID);
            sendVisitorEvent('new_visitor');
        }
        return visitorID;
    }

    // Start a new session
    function startNewSession() {
        const now = Date.now();
        const expiry = now + IDLE_TIMEOUT_MINUTES * 60 * 1000;
        sessionStorage.setItem(SESSION_KEY, expiry);
        console.log('New session started');
        sendVisitorEvent('session_start');
    }

    // Check if session expired
    function checkSession() {
        const now = Date.now();
        const expiry = parseInt(sessionStorage.getItem(SESSION_KEY) || 0);
        if (!expiry || now > expiry) {
            startNewSession();
        } else {
            // session active → refresh expiry
            sessionStorage.setItem(SESSION_KEY, now + IDLE_TIMEOUT_MINUTES * 60 * 1000);
        }
    }

    // Reset idle timer on activity
    function resetIdleTimer() {
        const now = Date.now();
        const expiry = parseInt(sessionStorage.getItem(SESSION_KEY) || 0);
        if (!expiry || now > expiry) {
            startNewSession();
        } else {
            sessionStorage.setItem(SESSION_KEY, now + IDLE_TIMEOUT_MINUTES * 60 * 1000);
        }
    }

    // Send visitor event
    function sendVisitorEvent(eventType) {
        const visitorID = getVisitorID();
        console.log(`Visitor Event: ${eventType}, ID: ${visitorID}, Time: ${new Date().toISOString()}`);
        // TODO: replace console.log with actual POST to backend
        // fetch('/analytics', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({visitorID, eventType, timestamp: Date.now()}) });
    }

    // Listen to user activity
    ['mousemove','keydown','scroll','click','touchstart'].forEach(evt => {
        window.addEventListener(evt, resetIdleTimer, true);
    });

    // Initialize
    getVisitorID();
    checkSession();

    // Optional: periodically check session in case tab inactive
    setInterval(checkSession, 60 * 1000); // every 1 min
})();
