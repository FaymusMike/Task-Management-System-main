// firebase-config.js - Firebase v8 namespace configuration

// IMPORTANT:
// - Do not commit real Firebase credentials to source control.
// - Provide runtime configuration using `window.__FIREBASE_CONFIG__` before this file loads.
// - For local development, add firebase-config.local.js (gitignored) before this file.

const REQUIRED_FIREBASE_CONFIG_FIELDS = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
];

function isValidFirebaseConfig(config) {
    if (!config || typeof config !== 'object') return false;
    return REQUIRED_FIREBASE_CONFIG_FIELDS.every((field) => {
        const value = config[field];
        return typeof value === 'string' && value.trim().length > 0 && !value.includes('REPLACE_ME');
    });
}

function getFirebaseConfig() {
    const injectedConfig = window.__FIREBASE_CONFIG__ || null;
    if (isValidFirebaseConfig(injectedConfig)) return injectedConfig;

    // Optional fallback for simple static hosting setups.
    try {
        const rawConfig = window.localStorage.getItem('firebaseConfig');
        if (rawConfig) {
            const parsed = JSON.parse(rawConfig);
            if (isValidFirebaseConfig(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn('Unable to read firebaseConfig from localStorage:', error);
    }

    // Optional fallback from a global JSON string (useful for static hosts/env injection).
    try {
        if (typeof window.__FIREBASE_CONFIG_JSON__ === 'string') {
            const parsed = JSON.parse(window.__FIREBASE_CONFIG_JSON__);
            if (isValidFirebaseConfig(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn('Unable to parse window.__FIREBASE_CONFIG_JSON__:', error);
    }

    return null;
}

const firebaseConfig = getFirebaseConfig();
window.__FIREBASE_READY__ = false;

if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
    if (isValidFirebaseConfig(firebaseConfig)) {
        firebase.initializeApp(firebaseConfig);
        window.__FIREBASE_READY__ = true;
    } else {
        console.error(
            'Firebase is not configured. Define window.__FIREBASE_CONFIG__ (or window.__FIREBASE_CONFIG_JSON__) before loading firebase-config.js.'
        );
    }
}

// Expose config if needed by other scripts.
window.firebaseConfig = firebaseConfig;