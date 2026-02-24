// Copy this file to a private, untracked location and inject it before firebase-config.js.
// Example usage in HTML:
// <script src="firebase-config.example.js"></script>
// <script src="firebase-config.js"></script>

window.__FIREBASE_CONFIG__ = {
    apiKey: 'REPLACE_ME',
    authDomain: 'REPLACE_ME.firebaseapp.com',
    databaseURL: 'https://REPLACE_ME-default-rtdb.firebaseio.com',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME.firebasestorage.app',
    messagingSenderId: 'REPLACE_ME',
    appId: 'REPLACE_ME'
};