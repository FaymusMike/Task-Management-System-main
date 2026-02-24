// firebase-config.js - Fixed version
(function() {
    const REQUIRED_FIELDS = [
        'apiKey', 'authDomain', 'projectId', 
        'storageBucket', 'messagingSenderId', 'appId'
    ];

    function isValidConfig(config) {
        if (!config || typeof config !== 'object') return false;
        return REQUIRED_FIELDS.every(field => 
            config[field] && typeof config[field] === 'string' && config[field].length > 0
        );
    }

    // Get config from various sources
    function getConfig() {
        // Priority 1: window.__FIREBASE_CONFIG__
        if (isValidConfig(window.__FIREBASE_CONFIG__)) {
            return window.__FIREBASE_CONFIG__;
        }
        
        // Priority 2: window.__FIREBASE_CONFIG_JSON__
        try {
            if (window.__FIREBASE_CONFIG_JSON__) {
                const parsed = JSON.parse(window.__FIREBASE_CONFIG_JSON__);
                if (isValidConfig(parsed)) return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse __FIREBASE_CONFIG_JSON__');
        }
        
        // Priority 3: Local storage (for development)
        try {
            const stored = localStorage.getItem('firebaseConfig');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (isValidConfig(parsed)) return parsed;
            }
        } catch (e) {}
        
        return null;
    }

    const config = getConfig();
    
    // Initialize Firebase
    if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        if (isValidConfig(config)) {
            firebase.initializeApp(config);
            window.__FIREBASE_READY__ = true;
            console.log('Firebase initialized successfully');
            
            // Enable offline persistence for Firestore
            firebase.firestore().enablePersistence()
                .catch(err => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Multiple tabs open, persistence disabled');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Browser doesn\'t support persistence');
                    }
                });
        } else {
            console.error(
                '%cFirebase Configuration Error\n' +
                '==========================\n' +
                'Valid Firebase configuration not found.\n' +
                'Please set window.__FIREBASE_CONFIG__ before loading this script.',
                'color: red; font-weight: bold; font-size: 14px;'
            );
            window.__FIREBASE_READY__ = false;
        }
    }
})();