// init.js - Load this FIRST in all HTML files
(function() {
    // Load Firebase configuration from environment
    window.__FIREBASE_CONFIG__ = {
        apiKey: "AIzaSyBkHqKsQMpZ6cAxdseAf5xV9uor8kM-1eA",
        authDomain: "taskme-f16bf.firebaseapp.com",
        databaseURL: "https://taskme-f16bf-default-rtdb.firebaseio.com",
        projectId: "taskme-f16bf",
        storageBucket: "taskme-f16bf.firebasestorage.app",
        messagingSenderId: "682092320670",
        appId: "1:682092320670:web:687bc68bc95a0de614288f"
    };
    
    // Set admin secret (in production, this should be environment variable)
    window.__ADMIN_SECRET__ = "TASKFLOW_ADMIN_SECRET_2024";
    
    console.log('Firebase configuration loaded');
})();