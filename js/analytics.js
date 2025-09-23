(function() {
    const VISITOR_KEY = 'visitor_id';
    const SESSION_KEY = 'session_expiry';
    const IDLE_TIMEOUT_MINUTES = 30;

    // Generate a unique visitor ID
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
            // Send new visitor count to server here
            sendVisitorEvent('new_visitor');
        }
        return visitorID;
    }

    // Check if session is active or expired
    function checkSession() {
        const now = Date.now();
        const expiry = sessionStorage.getItem(SESSION_KEY);

        if (!expiry || now > parseInt(expiry)) {
            startNewSession();
        } else {
            // Refresh session expiry
            const newExpiry = now + IDLE_TIMEOUT_MINUTES * 60 * 1000;
            sessionStorage.setItem(SESSION_KEY, newExpiry);
        }
    }

    // Start a new session (counts as one visit)
    function startNewSession() {
        const now = Date.now();
        const expiry = now + IDLE_TIMEOUT_MINUTES * 60 * 1000;
        sessionStorage.setItem(SESSION_KEY, expiry);
        console.log('New session started');
        sendVisitorEvent('session_start');
    }

    // Call this whenever user interacts to reset idle timer
    function resetIdleTimer() {
        const now = Date.now();
        const expiry = now + IDLE_TIMEOUT_MINUTES * 60 * 1000;
        sessionStorage.setItem(SESSION_KEY, expiry);
    }

    // Example function to send visitor info to analytics server
    function sendVisitorEvent(eventType) {
        const visitorID = getVisitorID();
        console.log(`Visitor Event: ${eventType}, ID: ${visitorID}`);
        // You can replace console.log with actual POST to your backend
        // Example:
        // fetch('/analytics', {
        //     method: 'POST',
        //     headers: {'Content-Type':'application/json'},
        //     body: JSON.stringify({visitorID, eventType, timestamp: Date.now()})
        // });
    }

    // Listen for user activity to reset idle timer
    ['mousemove','keydown','scroll','click'].forEach(evt => {
        window.addEventListener(evt, resetIdleTimer, true);
    });

    // Initialize
    getVisitorID();
    checkSession();

    // Optional: Check session periodically in case user stays idle
    setInterval(checkSession, 60 * 1000); // every 1 min
})();
