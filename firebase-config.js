// firebase-config.js - Fixed with proper SDK loading
(function() {
    console.log('🔥 Firebase config loading...');
    
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

    // Get config from window (set in init.js)
    const config = window.__FIREBASE_CONFIG__;
    
    // Initialize Firebase
    if (typeof firebase !== 'undefined') {
        if (firebase.apps.length === 0) {
            if (isValidConfig(config)) {
                // Initialize core Firebase
                firebase.initializeApp(config);
                
                // Check if Realtime Database is available
                if (firebase.database) {
                    const database = firebase.database();
                    console.log('✅ Realtime Database initialized');
                } else {
                    console.warn('⚠️ Realtime Database SDK not loaded');
                }
                
                window.__FIREBASE_READY__ = true;
                console.log('✅ Firebase initialized successfully');
                
                // Enable offline persistence for Firestore
                firebase.firestore().enablePersistence()
                    .then(() => console.log('✅ Firestore persistence enabled'))
                    .catch(err => {
                        if (err.code === 'failed-precondition') {
                            console.warn('⚠️ Multiple tabs open, persistence disabled');
                        } else if (err.code === 'unimplemented') {
                            console.warn('⚠️ Browser doesn\'t support persistence');
                        }
                    });
            } else {
                console.error(
                    '%c❌ Firebase Configuration Error\n' +
                    '==========================\n' +
                    'Valid Firebase configuration not found.',
                    'color: red; font-weight: bold; font-size: 14px;'
                );
                window.__FIREBASE_READY__ = false;
            }
        } else {
            console.log('✅ Firebase already initialized');
            window.__FIREBASE_READY__ = true;
        }
    } else {
        console.error('❌ Firebase SDK not loaded');
        window.__FIREBASE_READY__ = false;
    }
})();