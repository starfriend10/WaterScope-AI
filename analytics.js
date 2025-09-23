// analytics.js - Enhanced Analytics for WaterScope-AI
class WaterScopeAnalytics {
    constructor() {
        this.version = '1.0';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.init();
    }
    
    init() {
        console.log('🌊 WaterScope-AI Analytics Initialized');
        
        // Set first visit date if not set
        if (!localStorage.getItem('waterScopeFirstVisit')) {
            localStorage.setItem('waterScopeFirstVisit', new Date().toISOString());
            console.log('📅 First visit recorded:', new Date().toLocaleString());
        }
        
        this.startSession();
        this.trackPageView();
        this.setupEventListeners();
    }
    
    startSession() {
        const now = Date.now();
        const lastActivity = sessionStorage.getItem('waterScopeLastActivity');
        
        // Check if new session (30 minutes of inactivity)
        if (!lastActivity || (now - parseInt(lastActivity)) > this.sessionTimeout) {
            this.incrementTotalVisits();
            sessionStorage.setItem('waterScopeSessionStart', now.toString());
            console.log('🆕 New session started');
        }
        
        sessionStorage.setItem('waterScopeLastActivity', now.toString());
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
        const pageTitle = this.getPageTitle();
        
        // Total page views
        let totalPageViews = localStorage.getItem('waterScopeTotalPageViews');
        totalPageViews = totalPageViews ? parseInt(totalPageViews) + 1 : 1;
        localStorage.setItem('waterScopeTotalPageViews', totalPageViews.toString());
        
        // Individual page views
        let pageViews = JSON.parse(localStorage.getItem('waterScopePageViews') || '{}');
        pageViews[currentPage] = (pageViews[currentPage] || 0) + 1;
        localStorage.setItem('waterScopePageViews', JSON.stringify(pageViews));
        
        // Track feature usage (Chat vs MCQA vs Instructions)
        this.trackFeatureUsage(currentPage);
        
        // Track navigation path
        this.trackNavigationPath(currentPage, pageTitle);
        
        this.updateDisplay();
        this.logPageView(currentPage, pageViews[currentPage]);
    }
    
    trackFeatureUsage(currentPage) {
        let featureUsage = JSON.parse(localStorage.getItem('waterScopeFeatureUsage') || '{}');
        
        const features = {
            'index.html': 'Home',
            'demo.html': 'MCQA_Demo',
            'chat.html': 'Chat_Experimental',
            'instructions.html': 'Instructions'
        };
        
        const feature = features[currentPage] || 'Other';
        featureUsage[feature] = (featureUsage[feature] || 0) + 1;
        localStorage.setItem('waterScopeFeatureUsage', JSON.stringify(featureUsage));
    }
    
    trackNavigationPath(currentPage, pageTitle) {
        let navPath = sessionStorage.getItem('waterScopeNavPath') || '[]';
        navPath = JSON.parse(navPath);
        
        const navEntry = {
            page: currentPage,
            title: pageTitle,
            timestamp: new Date().toISOString(),
            timeOnPreviousPage: this.calculateTimeOnPreviousPage()
        };
        
        // Only add if different from last page
        if (navPath.length === 0 || navPath[navPath.length - 1].page !== currentPage) {
            navPath.push(navEntry);
            // Keep last 10 pages to avoid storage bloat
            if (navPath.length > 10) navPath.shift();
            sessionStorage.setItem('waterScopeNavPath', JSON.stringify(navPath));
        }
    }
    
    calculateTimeOnPreviousPage() {
        const navPath = JSON.parse(sessionStorage.getItem('waterScopeNavPath') || '[]');
        if (navPath.length === 0) return 0;
        
        const lastEntry = navPath[navPath.length - 1];
        const lastTimestamp = new Date(lastEntry.timestamp).getTime();
        return Date.now() - lastTimestamp;
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        return path.split('/').pop() || 'index.html';
    }
    
    getPageTitle() {
        // Get page-specific title for better tracking
        const pages = {
            'index.html': 'WaterScope-AI Home',
            'demo.html': 'MCQA Demo', 
            'chat.html': 'Chat Experimental',
            'instructions.html': 'Instructions'
        };
        return pages[this.getCurrentPage()] || document.title;
    }
    
    updateDisplay() {
        const totalVisits = localStorage.getItem('waterScopeTotalVisits') || '0';
        const elements = document.querySelectorAll('.visit-count, #visit-count, .total-visits');
        
        elements.forEach(element => {
            element.textContent = parseInt(totalVisits).toLocaleString();
        });
    }
    
    logPageView(page, count) {
        console.log(`📊 Page View: ${page} (Total: ${count})`);
    }
    
    setupEventListeners() {
        // Track when user leaves the page
        window.addEventListener('beforeunload', () => {
            sessionStorage.setItem('waterScopeLastActivity', Date.now().toString());
        });
        
        // Track button clicks (optional - for deeper analytics)
        this.trackUserInteractions();
    }
    
    trackUserInteractions() {
        // Track major interactions (MCQA runs, Chat messages, etc.)
        document.addEventListener('click', (e) => {
            if (e.target.matches('#send, #send-chat, #add-option, #clear')) {
                this.trackInteraction(e.target.id);
            }
        });
    }
    
    trackInteraction(elementId) {
        let interactions = JSON.parse(localStorage.getItem('waterScopeInteractions') || '{}');
        interactions[elementId] = (interactions[elementId] || 0) + 1;
        localStorage.setItem('waterScopeInteractions', JSON.stringify(interactions));
    }
    
    // Get comprehensive analytics report
    getAnalyticsReport() {
        return {
            // Basic metrics
            totalVisits: parseInt(localStorage.getItem('waterScopeTotalVisits') || '0'),
            uniqueVisitors: parseInt(localStorage.getItem('waterScopeUniqueVisitors') || '0'),
            totalPageViews: parseInt(localStorage.getItem('waterScopeTotalPageViews') || '0'),
            
            // Page analytics
            pageViews: JSON.parse(localStorage.getItem('waterScopePageViews') || '{}'),
            featureUsage: JSON.parse(localStorage.getItem('waterScopeFeatureUsage') || '{}'),
            
            // User behavior
            interactions: JSON.parse(localStorage.getItem('waterScopeInteractions') || '{}'),
            navigationPath: JSON.parse(sessionStorage.getItem('waterScopeNavPath') || '[]'),
            
            // Timestamps
            firstVisit: localStorage.getItem('waterScopeFirstVisit'),
            currentSessionStart: sessionStorage.getItem('waterScopeSessionStart'),
            lastActivity: sessionStorage.getItem('waterScopeLastActivity'),
            
            // System info
            analyticsVersion: this.version,
            reportGenerated: new Date().toISOString()
        };
    }
    
    // Export data for research purposes
    exportData(format = 'json') {
        const data = this.getAnalyticsReport();
        
        if (format === 'csv') {
            return this.convertToCSV(data);
        }
        
        return JSON.stringify(data, null, 2);
    }
    
    convertToCSV(data) {
        // Basic CSV conversion for page views
        let csv = 'Page,Views\n';
        Object.entries(data.pageViews).forEach(([page, views]) => {
            csv += `${page},${views}\n`;
        });
        return csv;
    }
    
    // Reset analytics (for testing)
    resetAnalytics() {
        const keys = [
            'waterScopeTotalVisits',
            'waterScopeUniqueVisitors', 
            'waterScopeTotalPageViews',
            'waterScopePageViews',
            'waterScopeFeatureUsage',
            'waterScopeInteractions',
            'waterScopeFirstVisit'
        ];
        
        keys.forEach(key => localStorage.removeItem(key));
        sessionStorage.clear();
        console.log('🔄 Analytics data reset');
    }
}

// Initialize analytics
const waterScopeAnalytics = new WaterScopeAnalytics();

// Make available globally for admin functions
window.waterScopeAnalytics = waterScopeAnalytics;