// firebase-config.js - Firebase v8 namespace configuration

// IMPORTANT:
// - Do not commit real Firebase credentials to source control.
// - Provide runtime configuration using `window.__FIREBASE_CONFIG__` before this file loads.
//   Example:
//   <script>
//     window.__FIREBASE_CONFIG__ = {
//       apiKey: "...",
//       authDomain: "...",
//       projectId: "...",
//       storageBucket: "...",
//       messagingSenderId: "...",
//       appId: "..."
//     };
//   </script>

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
        return typeof value === 'string' && value.trim().length > 0;
    });
}

const firebaseConfig = window.__FIREBASE_CONFIG__ || null;

if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
    if (isValidFirebaseConfig(firebaseConfig)) {
        firebase.initializeApp(firebaseConfig);
    } else {
        console.error(
            'Firebase is not configured. Define window.__FIREBASE_CONFIG__ with valid credentials before loading firebase-config.js.'
        );
    }
}

// Expose config if needed by other scripts.
window.firebaseConfig = firebaseConfig;