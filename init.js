// init.js - Load this FIRST in all HTML files
(function() {
    // Load Firebase configuration
    window.__FIREBASE_CONFIG__ = {
        apiKey: "AIzaSyC4Z8gKWDczVJRzlRVF8VUIb-dJQvMPyMI",
        authDomain: "taskme-a59e5.firebaseapp.com",
        databaseURL: "https://taskme-a59e5-default-rtdb.firebaseio.com",
        projectId: "taskme-a59e5",
        storageBucket: "taskme-a59e5.firebasestorage.app",
        messagingSenderId: "1006542214874",
        appId: "1:1006542214874:web:b740e7d14a9615ce19b7e3"
    };
    
    // Admin secret key (you can change this)
    window.__ADMIN_SECRET__ = "TASKFLOW_ADMIN_SECRET_2024";
    
    console.log('✅ Firebase configuration loaded for project: taskme-a59e5');
})();