# Task Management System

Firestor Rules:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Admins can read all users
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Tasks rules
    match /tasks/{taskId} {
      allow read: if request.auth != null && (
        // User is owner
        resource.data.ownerId == request.auth.uid ||
        // User is assigned
        resource.data.assigneeIds.hasAny([request.auth.uid]) ||
        // User is admin
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      
      allow write: if request.auth != null && (
        // User is owner
        resource.data.ownerId == request.auth.uid ||
        // User is assigned (can update status)
        (resource.data.assigneeIds.hasAny([request.auth.uid]) && 
         request.resource.data.status != null) ||
        // User is admin
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      
      allow create: if request.auth != null;
    }
    
    // Teams rules
    match /teams/{teamId} {
      allow read: if request.auth != null && (
        // User is member
        resource.data.memberIds.hasAny([request.auth.uid]) ||
        // User is admin
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      
      allow write: if request.auth != null && (
        // User is team lead/owner
        resource.data.leadId == request.auth.uid ||
        resource.data.ownerId == request.auth.uid ||
        // User is admin
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }
  }
}



Use the secret key in admin login: TASKFLOW_ADMIN_SECRET








## Firebase configuration and API key security

Firebase Web API keys are not fully secret, but they must still be protected with **API restrictions** and **application restrictions** in Google Cloud Console.

### What was changed
- The repository no longer hardcodes a live Firebase config in `firebase-config.js`.
- Runtime config is now expected via `window.__FIREBASE_CONFIG__`.
- A safe template is provided in `firebase-config.example.js`.

### Setup
1. Create a local file named `firebase-config.local.js` (this file is gitignored) with:

```js
window.__FIREBASE_CONFIG__ = {
  apiKey: 'YOUR_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};
```

2. Include that file before `firebase-config.js` in each HTML page (or inject it inline).
3. Rotate the leaked API key from Google Cloud Console and restrict the new key to allowed referrers and required APIs only.


### Netlify deployment (important)
`firebase-config.local.js` is intentionally gitignored, so Netlify **cannot** load it from your GitHub deploy.

Use one of these options:

1. Add this inline script in each HTML file **before** `firebase-config.js`:

```html
<script>
  window.__FIREBASE_CONFIG__ = {
    apiKey: '...',
    authDomain: '...',
    databaseURL: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...'
  };
</script>
```

2. Or inject `window.__FIREBASE_CONFIG_JSON__` at build/runtime and parse it in `firebase-config.js`.

Also enable these providers in Firebase Console > Authentication:
- Email/Password
- Google

And add your production domain (for example `https://taskbyuv.netlify.app`) to:
- Authentication > Settings > Authorized domains
- Google Cloud API key HTTP referrer restrictions
