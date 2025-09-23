// analytics.js - Fixed session tracking
class WaterScopeAnalytics {
    constructor() {
        this.version = '1.1';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.init();
    }
    
    init() {
        console.log('🌊 WaterScope-AI Analytics Initialized');
        
        // Set first visit date if not set
        if (!localStorage.getItem('waterScopeFirstVisit')) {
            localStorage.setItem('waterScopeFirstVisit', new Date().toISOString());
            console.log('📅 First visit recorded');
        }
        
        this.startSession();
        this.trackPageView();
        this.setupEventListeners();
    }
    
    startSession() {
        const now = Date.now();
        const sessionStart = sessionStorage.getItem('waterScopeSessionStart');
        const lastActivity = sessionStorage.getItem('waterScopeLastActivity');
        
        // NEW: Check if this is a completely new browser instance
        const isNewBrowserInstance = !sessionStorage.getItem('waterScopeTabCount');
        
        // Count tabs in this session
        let tabCount = parseInt(sessionStorage.getItem('waterScopeTabCount') || '0');
        tabCount++;
        sessionStorage.setItem('waterScopeTabCount', tabCount.toString());
        
        // Check if new session (no session OR timeout OR new browser instance)
        const timeSinceLastActivity = lastActivity ? now - parseInt(lastActivity) : Infinity;
        
        if (!sessionStart || timeSinceLastActivity > this.sessionTimeout || isNewBrowserInstance) {
            this.incrementTotalVisits();
            sessionStorage.setItem('waterScopeSessionStart', now.toString());
            console.log('🆕 New session started - Total visits incremented');
        }
        
        sessionStorage.setItem('waterScopeLastActivity', now.toString());
        sessionStorage.setItem('waterScopeLastTabOpen', now.toString());
    }
    
    incrementTotalVisits() {
        let totalVisits = localStorage.getItem('waterScopeTotalVisits');
        totalVisits = totalVisits ? parseInt(totalVisits) + 1 : 1;
        localStorage.setItem('waterScopeTotalVisits', totalVisits.toString());
        
        // Track unique visitors (based on first visit)
        let uniqueVisitors = localStorage.getItem('waterScopeUniqueVisitors');
        if (!uniqueVisitors) {
            uniqueVisitors = 1;
            localStorage.setItem('waterScopeUniqueVisitors', '1');
            console.log('👤 New unique visitor');
        }
        
        return totalVisits;
    }
    
    trackPageView() {
        const currentPage = this.getCurrentPage();
        
        // Always increment page views (even in same session)
        let totalPageViews = localStorage.getItem('waterScopeTotalPageViews');
        totalPageViews = totalPageViews ? parseInt(totalPageViews) + 1 : 1;
        localStorage.setItem('waterScopeTotalPageViews', totalPageViews.toString());
        
        // Individual page views
        let pageViews = JSON.parse(localStorage.getItem('waterScopePageViews') || '{}');
        pageViews[currentPage] = (pageViews[currentPage] || 0) + 1;
        localStorage.setItem('waterScopePageViews', JSON.stringify(pageViews));
        
        this.updateDisplay();
        this.logPageView(currentPage, pageViews[currentPage]);
    }
    
    // ... rest of your existing methods remain the same ...
    
    setupEventListeners() {
        // Track when user leaves the page or closes tab
        window.addEventListener('beforeunload', () => {
            this.handleTabClose();
        });
        
        // Track visibility changes (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tab is hidden
                sessionStorage.setItem('waterScopeLastActivity', Date.now().toString());
            }
        });
    }
    
    handleTabClose() {
        // Decrement tab count
        let tabCount = parseInt(sessionStorage.getItem('waterScopeTabCount') || '1');
        tabCount = Math.max(0, tabCount - 1);
        sessionStorage.setItem('waterScopeTabCount', tabCount.toString());
        
        // If last tab, mark session as potentially ending
        if (tabCount === 0) {
            sessionStorage.setItem('waterScopeLastActivity', Date.now().toString());
            console.log('📱 Last tab closed - session may end');
        }
    }
}

// Initialize analytics
const waterScopeAnalytics = new WaterScopeAnalytics();
