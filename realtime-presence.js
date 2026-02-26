// realtime-presence.js - Handle online/offline status with Realtime DB
(function() {
    class PresenceManager {
        constructor() {
            this.database = null;
            this.userId = null;
            this.presenceRef = null;
            this.userStatusRef = null;
            this.isConnected = false;
        }
        
        initialize(userId) {
            if (!userId || !firebase.database) return;
            
            this.userId = userId;
            this.database = firebase.database();
            
            // Get references
            this.presenceRef = this.database.ref('.info/connected');
            this.userStatusRef = this.database.ref(`userStatus/${userId}`);
            
            this.setupPresence();
        }
        
        setupPresence() {
            if (!this.presenceRef || !this.userStatusRef) return;
            
            this.presenceRef.on('value', (snapshot) => {
                if (snapshot.val()) {
                    // User is connected
                    this.userStatusRef.set({
                        status: 'online',
                        lastSeen: firebase.database.ServerValue.TIMESTAMP,
                        userId: this.userId
                    });
                    
                    // Set up disconnect hook
                    this.userStatusRef.onDisconnect().set({
                        status: 'offline',
                        lastSeen: firebase.database.ServerValue.TIMESTAMP,
                        userId: this.userId
                    });
                    
                    this.isConnected = true;
                } else {
                    // User is disconnected
                    this.isConnected = false;
                }
            });
        }
        
        updateStatus(status, metadata = {}) {
            if (!this.userStatusRef) return;
            
            this.userStatusRef.update({
                status: status,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                ...metadata
            });
        }
        
        getOnlineUsers(callback) {
            const usersRef = this.database.ref('userStatus');
            
            usersRef.on('value', (snapshot) => {
                const users = [];
                snapshot.forEach((childSnapshot) => {
                    const userData = childSnapshot.val();
                    if (userData.status === 'online') {
                        users.push({
                            userId: childSnapshot.key,
                            ...userData
                        });
                    }
                });
                callback(users);
            });
            
            // Return cleanup function
            return () => usersRef.off();
        }
        
        cleanup() {
            if (this.presenceRef) {
                this.presenceRef.off();
            }
            if (this.userStatusRef) {
                this.userStatusRef.off();
                this.userStatusRef.set({
                    status: 'offline',
                    lastSeen: firebase.database.ServerValue.TIMESTAMP,
                    userId: this.userId
                });
            }
        }
    }
    
    // Create global instance
    window.presenceManager = new PresenceManager();
})();