// analytics.js - Enhanced Analytics for WaterScope-AI Research Platform
class WaterScopeAnalytics {
    constructor() {
        this.version = '2.0';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.currentSessionId = this.generateSessionId();
        this.init();
    }
    
    init() {
        console.log('🌊 WaterScope-AI Analytics v' + this.version + ' Initialized');
        
        // Set first visit date if not set
        if (!localStorage.getItem('waterScopeFirstVisit')) {
            localStorage.setItem('waterScopeFirstVisit', new Date().toISOString());
            console.log('📅 First visit recorded:', new Date().toLocaleString());
        }
        
        this.startNewSession();
        this.trackPageView();
        this.setupEventListeners();
        this.updateDisplay();
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    startNewSession() {
        const now = Date.now();
        const lastSessionEnd = localStorage.getItem('waterScopeLastSessionEnd');
        
        // Check if this should be a new visit (new session)
        const isNewVisit = !lastSessionEnd || (now - parseInt(lastSessionEnd)) > this.sessionTimeout;
        
        if (isNewVisit) {
            this.incrementTotalVisits();
            console.log('🆕 New visit started - Session:', this.currentSessionId);
        } else {
            console.log('🔁 Continuing existing session');
        }
        
        // Always start a new session instance
        sessionStorage.setItem('currentSessionId', this.currentSessionId);
        sessionStorage.setItem('sessionStartTime', now.toString());
        
        // Store session info in localStorage for cross-tab detection
        const activeSessions = JSON.parse(localStorage.getItem('waterScopeActiveSessions') || '{}');
        activeSessions[this.currentSessionId] = now;
        localStorage.setItem('waterScopeActiveSessions', JSON.stringify(activeSessions));
    }
    
    incrementTotalVisits() {
        let totalVisits = localStorage.getItem('waterScopeTotalVisits');
        totalVisits = totalVisits ? parseInt(totalVisits) + 1 : 1;
        localStorage.setItem('waterScopeTotalVisits', totalVisits.toString());
        
        // Track unique visitors (based on first visit)
        if (!localStorage.getItem('waterScopeUniqueVisitors')) {
            localStorage.setItem('waterScopeUniqueVisitors', '1');
            console.log('👤 New unique visitor');
        }
        
        return totalVisits;
    }
    
    trackPageView() {
        const currentPage = this.getCurrentPage();
        const pageTitle = this.getPageTitle();
        
        // Total page views (always increment)
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
            sessionId: this.currentSessionId
        };
        
        // Only add if different from last page
        if (navPath.length === 0 || navPath[navPath.length - 1].page !== currentPage) {
            navPath.push(navEntry);
            // Keep last 20 pages to avoid storage bloat
            if (navPath.length > 20) navPath.shift();
            sessionStorage.setItem('waterScopeNavPath', JSON.stringify(navPath));
        }
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        return path.split('/').pop() || 'index.html';
    }
    
    getPageTitle() {
        const pages = {
            'index.html': 'WaterScope-AI Home',
            'demo.html': 'MCQA Demo', 
            'chat.html': 'Chat Experimental',
            'instructions.html': 'Instructions'
        };
        return pages[this.getCurrentPage()] || document.title;
    }
    
    updateDisplay() {
        const totalVisits = localStorage.getItem('waterScopeTotalVisits') || '1';
        const totalPageViews = localStorage.getItem('waterScopeTotalPageViews') || '1';
        
        // Update visit count displays
        document.querySelectorAll('.visit-count, #visit-count').forEach(element => {
            element.textContent = totalVisits;
        });
        
        // Update page view displays if they exist
        document.querySelectorAll('.page-view-count, #page-view-count').forEach(element => {
            element.textContent = totalPageViews;
        });
    }
    
    logPageView(page, count) {
        console.log(`📊 Page View: ${page} (View #${count})`);
    }
    
    setupEventListeners() {
        // Track when user leaves the page
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });
        
        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onTabHidden();
            } else {
                this.onTabVisible();
            }
        });
        
        // Track interactions
        this.trackUserInteractions();
    }
    
    onTabHidden() {
        console.log('📱 Tab hidden - updating last activity');
        localStorage.setItem('waterScopeLastActivity', Date.now().toString());
    }
    
    onTabVisible() {
        console.log('📱 Tab visible - checking session');
        this.checkSessionStatus();
    }
    
    endSession() {
        // Clean up this session from active sessions
        const activeSessions = JSON.parse(localStorage.getItem('waterScopeActiveSessions') || '{}');
        delete activeSessions[this.currentSessionId];
        localStorage.setItem('waterScopeActiveSessions', JSON.stringify(activeSessions));
        
        // Mark when this session ended
        localStorage.setItem('waterScopeLastSessionEnd', Date.now().toString());
        
        console.log('🔚 Session ended:', this.currentSessionId);
    }
    
    checkSessionStatus() {
        const activeSessions = JSON.parse(localStorage.getItem('waterScopeActiveSessions') || '{}');
        const now = Date.now();
        
        // Clean up expired sessions
        Object.keys(activeSessions).forEach(sessionId => {
            if (now - activeSessions[sessionId] > this.sessionTimeout) {
                delete activeSessions[sessionId];
            }
        });
        
        localStorage.setItem('waterScopeActiveSessions', JSON.stringify(activeSessions));
    }
    
    trackUserInteractions() {
        // Track major interactions
        document.addEventListener('click', (e) => {
            if (e.target.matches('#send, #send-chat, #add-option, #clear, .tab, .btn-primary')) {
                this.trackInteraction(e.target.id || e.target.className);
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
        const activeSessions = JSON.parse(localStorage.getItem('waterScopeActiveSessions') || '{}');
        const activeSessionCount = Object.keys(activeSessions).length;
        
        return {
            // Basic metrics
            totalVisits: parseInt(localStorage.getItem('waterScopeTotalVisits') || '0'),
            uniqueVisitors: parseInt(localStorage.getItem('waterScopeUniqueVisitors') || '0'),
            totalPageViews: parseInt(localStorage.getItem('waterScopeTotalPageViews') || '0'),
            activeSessions: activeSessionCount,
            
            // Page analytics
            pageViews: JSON.parse(localStorage.getItem('waterScopePageViews') || '{}'),
            featureUsage: JSON.parse(localStorage.getItem('waterScopeFeatureUsage') || '{}'),
            
            // User behavior
            interactions: JSON.parse(localStorage.getItem('waterScopeInteractions') || '{}'),
            navigationPath: JSON.parse(sessionStorage.getItem('waterScopeNavPath') || '[]'),
            
            // Timestamps
            firstVisit: localStorage.getItem('waterScopeFirstVisit'),
            lastActivity: localStorage.getItem('waterScopeLastActivity'),
            lastSessionEnd: localStorage.getItem('waterScopeLastSessionEnd'),
            
            // Current session
            currentSessionId: this.currentSessionId,
            sessionStart: sessionStorage.getItem('sessionStartTime'),
            
            // System info
            analyticsVersion: this.version,
            reportGenerated: new Date().toISOString()
        };
    }
    
    // Display analytics on page (for admin)
    showAnalyticsDashboard() {
        const data = this.getAnalyticsReport();
        return `
            <div class="analytics-dashboard">
                <h3>📊 WaterScope-AI Analytics</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${data.totalVisits}</div>
                        <div class="metric-label">Total Visits</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${data.uniqueVisitors}</div>
                        <div class="metric-label">Unique Visitors</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${data.totalPageViews}</div>
                        <div class="metric-label">Page Views</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${data.activeSessions}</div>
                        <div class="metric-label">Active Sessions</div>
                    </div>
                </div>
                
                <h4>Popular Pages:</h4>
                <pre>${JSON.stringify(data.pageViews, null, 2)}</pre>
                
                <h4>Feature Usage:</h4>
                <pre>${JSON.stringify(data.featureUsage, null, 2)}</pre>
                
                <button onclick="waterScopeAnalytics.exportData()" class="btn-secondary">Export Data</button>
                <button onclick="waterScopeAnalytics.resetAnalytics()" class="btn-secondary">Reset Analytics</button>
            </div>
        `;
    }
    
    // Export data for research
    exportData(format = 'json') {
        const data = this.getAnalyticsReport();
        let exportData;
        
        if (format === 'csv') {
            // Simple CSV export for page views
            let csv = 'Page,Views\n';
            Object.entries(data.pageViews).forEach(([page, views]) => {
                csv += `${page},${views}\n`;
            });
            exportData = csv;
            
            // Create download link
            this.downloadFile(csv, 'waterscope-analytics.csv', 'text/csv');
        } else {
            exportData = JSON.stringify(data, null, 2);
            this.downloadFile(exportData, 'waterscope-analytics.json', 'application/json');
        }
        
        return exportData;
    }
    
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Reset analytics (for testing)
    resetAnalytics() {
        if (confirm('Are you sure you want to reset all analytics data?')) {
            const keys = [
                'waterScopeTotalVisits',
                'waterScopeUniqueVisitors', 
                'waterScopeTotalPageViews',
                'waterScopePageViews',
                'waterScopeFeatureUsage',
                'waterScopeInteractions',
                'waterScopeFirstVisit',
                'waterScopeLastActivity',
                'waterScopeLastSessionEnd',
                'waterScopeActiveSessions'
            ];
            
            keys.forEach(key => localStorage.removeItem(key));
            sessionStorage.clear();
            
            console.log('🔄 Analytics data reset');
            alert('Analytics data has been reset. Refreshing page...');
            location.reload();
        }
    }
}

// Initialize analytics and make globally available
const waterScopeAnalytics = new WaterScopeAnalytics();
window.waterScopeAnalytics = waterScopeAnalytics;
