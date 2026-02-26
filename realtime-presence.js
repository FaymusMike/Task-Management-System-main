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
            if (!userId) return;
            
            // Check if Realtime Database is available
            if (!firebase.database) {
                console.log('Realtime Database not available, presence disabled');
                return;
            }
            
            this.userId = userId;
            
            try {
                this.database = firebase.database();
                this.presenceRef = this.database.ref('.info/connected');
                this.userStatusRef = this.database.ref(`userStatus/${userId}`);
                
                this.setupPresence();
            } catch (error) {
                console.warn('Could not initialize presence:', error);
            }
        }
        
        setupPresence() {
            if (!this.presenceRef || !this.userStatusRef) return;
            
            this.presenceRef.on('value', (snapshot) => {
                if (snapshot.val()) {
                    // User is connected
                    this.userStatusRef.set({
                        status: 'online',
                        lastSeen: Date.now(),
                        userId: this.userId
                    });
                    
                    // Set up disconnect hook
                    this.userStatusRef.onDisconnect().set({
                        status: 'offline',
                        lastSeen: Date.now(),
                        userId: this.userId
                    });
                    
                    this.isConnected = true;
                } else {
                    this.isConnected = false;
                }
            }, (error) => {
                console.warn('Presence error:', error);
            });
        }
        
        updateStatus(status, metadata = {}) {
            if (!this.userStatusRef) return;
            
            this.userStatusRef.update({
                status: status,
                lastSeen: Date.now(),
                ...metadata
            }).catch(error => {
                console.warn('Could not update status:', error);
            });
        }
        
        getOnlineUsers(callback) {
            if (!this.database) {
                callback([]);
                return () => {};
            }
            
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
            }, (error) => {
                console.warn('Could not get online users:', error);
                callback([]);
            });
            
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
                    lastSeen: Date.now(),
                    userId: this.userId
                }).catch(() => {});
            }
        }
    }
    
    // Create global instance
    window.presenceManager = new PresenceManager();
})();