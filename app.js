// app.js - All application logic in one file

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let userData = null;
let tasks = [];
let teams = [];
let notifications = [];


function ensureFirebaseReady() {
    const isReady = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
    if (!isReady) {
        throw new Error('Firebase is not configured. Create firebase-config.local.js and include your Firebase project credentials.');
    }
}


// ==================== AUTHENTICATION FUNCTIONS ====================
async function loginUser(email, password) {
    ensureFirebaseReady();
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        await loadUserData();
        
        // Check if email needs verification
        if (!currentUser.emailVerified) {
            Notiflix.Notify.warning('Please verify your email address');
        }
        
        // Check role and redirect
        await checkUserRoleAndRedirect(currentUser.uid);
        
        return userCredential;
    } catch (error) {
        throw error;
    }
}

async function registerUser(firstName, lastName, email, password) {
    ensureFirebaseReady();
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        // Send email verification
        await currentUser.sendEmailVerification();
        
        // Create user document in Firestore
        await firebase.firestore().collection('users').doc(currentUser.uid).set({
            firstName: firstName,
            lastName: lastName,
            email: email,
            displayName: `${firstName} ${lastName}`,
            role: 'member',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            stats: {
                personalTasksCreated: 0,
                personalTasksCompleted: 0,
                teamTasksCreated: 0,
                teamTasksCompleted: 0,
                groupsCreated: 0,
                groupsManaged: 0
            },
            achievements: {
                tasksCreated: 0,
                tasksCompleted: 0,
                groupsLed: 0
            },
            settings: {
                theme: 'light',
                notifications: true,
                emailNotifications: true
            }
        });
        
        Notiflix.Notify.success('Account created successfully! Please verify your email.');
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
        return userCredential;
    } catch (error) {
        throw error;
    }
}

async function loginWithGoogle() {
    ensureFirebaseReady();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const userCredential = await firebase.auth().signInWithPopup(provider);
        currentUser = userCredential.user;
        
        // Check if user exists in Firestore
        const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        
        if (!userDoc.exists) {
            // Create new user document
            const displayName = currentUser.displayName || 'User';
            const names = displayName.split(' ');
            
            await firebase.firestore().collection('users').doc(currentUser.uid).set({
                firstName: names[0] || '',
                lastName: names.slice(1).join(' ') || '',
                email: currentUser.email,
                displayName: displayName,
                role: 'member',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                stats: {
                    personalTasksCreated: 0,
                    personalTasksCompleted: 0,
                    teamTasksCreated: 0,
                    teamTasksCompleted: 0,
                    groupsCreated: 0,
                    groupsManaged: 0
                },
                achievements: {
                    tasksCreated: 0,
                    tasksCompleted: 0,
                    groupsLed: 0
                },
                settings: {
                    theme: 'light',
                    notifications: true,
                    emailNotifications: true
                }
            });
        } else {
            // Update last login
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await loadUserData();
        await checkUserRoleAndRedirect(currentUser.uid);
        
        return userCredential;
    } catch (error) {
        throw error;
    }
}

async function logoutUser() {
    ensureFirebaseReady();
    try {
        await firebase.auth().signOut();
        currentUser = null;
        userData = null;
        tasks = [];
        teams = [];
        
        Notiflix.Notify.success('Logged out successfully');
        window.location.href = 'login.html';
    } catch (error) {
        throw error;
    }
}

// ==================== USER DATA MANAGEMENT ====================
async function loadUserData() {
    ensureFirebaseReady();
    if (!currentUser) return null;
    
    try {
        const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            userData.id = userDoc.id;
            
            // Load notifications
            await loadNotifications();
            
            // Load tasks
            await loadTasks();
            
            // Load teams if user is in any
            if (userData.role === 'lead' || userData.role === 'member') {
                await loadTeams();
            }
            
            // Set theme
            setTheme(userData.settings?.theme || 'light');
            
            return userData;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

async function updateUserStats(statField, increment = 1) {
    if (!currentUser || !userData) return;
    
    try {
        const stats = userData.stats || {};
        const currentValue = stats[statField] || 0;
        
        await firebase.firestore().collection('users').doc(currentUser.uid).update({
            [`stats.${statField}`]: currentValue + increment,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local user data
        if (!userData.stats) userData.stats = {};
        userData.stats[statField] = currentValue + increment;
        
        // Check for role upgrades
        await checkRoleUpgrade();
        
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

async function checkRoleUpgrade() {
    if (!currentUser || !userData) return;
    
    const stats = userData.stats || {};
    
    // Check for Team Lead upgrade (5+ group tasks completed)
    if (userData.role === 'member' && stats.teamTasksCompleted >= 5) {
        await upgradeUserRole(currentUser.uid, 'lead');
        showNotification('Congratulations! You have been promoted to Team Lead!', 'success');
    }
    
    // Check for Admin upgrade (20+ team tasks managed as lead)
    if (userData.role === 'lead' && stats.groupsManaged >= 20) {
        await upgradeUserRole(currentUser.uid, 'admin');
        showNotification('Congratulations! You have been promoted to Admin!', 'success');
    }
}

async function upgradeUserRole(userId, newRole) {
    try {
        await firebase.firestore().collection('users').doc(userId).update({
            role: newRole,
            roleUpgradedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to activity log
        await addActivityLog({
            userId: userId,
            action: 'role_upgrade',
            details: `Upgraded to ${newRole}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local user data if it's the current user
        if (currentUser && currentUser.uid === userId) {
            userData.role = newRole;
            updateUIForRole();
        }
        
    } catch (error) {
        console.error('Error upgrading user role:', error);
    }
}

// ==================== TASK MANAGEMENT ====================
async function loadTasks(filter = 'all') {
    if (!currentUser) return [];
    
    try {
        let query = firebase.firestore().collection('tasks');
        
        // Apply filters based on user role and filter type
        if (filter === 'personal') {
            query = query.where('ownerId', '==', currentUser.uid);
        } else if (filter === 'assigned') {
            query = query.where('assigneeIds', 'array-contains', currentUser.uid);
        } else if (filter === 'team') {
            query = query.where('teamId', '!=', null);
        }
        
        const snapshot = await query
            .orderBy('createdAt', 'desc')
            .get();
        
        tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        return tasks;
    } catch (error) {
        console.error('Error loading tasks:', error);
        throw error;
    }
}

async function createTask(taskData, attachments = []) {
    if (!currentUser) throw new Error('User not authenticated');
    
    try {
        const task = {
            ...taskData,
            ownerId: currentUser.uid,
            assigneeIds: taskData.assigneeIds || [currentUser.uid],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: taskData.status || 'todo',
            version: 1,
            activityLog: [{
                action: 'created',
                userId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                details: 'Task created'
            }],
            attachments: [] // Will be populated after upload
        };
        
        // Upload attachments if any
        if (attachments && attachments.length > 0) {
            const uploadResults = await uploadMultipleFiles(attachments, null); // Upload without taskId first
            task.attachments = uploadResults;
        }
        
        const docRef = await firebase.firestore().collection('tasks').add(task);
        
        // If task has attachments and was created, update with taskId in folder
        if (task.attachments.length > 0) {
            // Note: Cloudinary doesn't allow moving files, so we'll keep them as-is
            // In production, you might want to handle this differently
        }
        
        // Update user stats
        if (task.teamId) {
            await updateUserStats('teamTasksCreated');
        } else {
            await updateUserStats('personalTasksCreated');
        }
        
        // Add notification for assignees
        if (task.assigneeIds && task.assigneeIds.length > 0) {
            for (const assigneeId of task.assigneeIds) {
                if (assigneeId !== currentUser.uid) {
                    await createNotification({
                        userId: assigneeId,
                        type: 'task_assigned',
                        title: 'New Task Assigned',
                        message: `${userData.displayName} assigned you a task: ${task.title}`,
                        taskId: docRef.id,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }
        
        Notiflix.Notify.success('Task created successfully!');
        
        return { id: docRef.id, ...task };
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
}

async function updateTask(taskId, updates = {}) {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const taskRef = firebase.firestore().collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            throw new Error('Task not found');
        }

        const existingTask = taskDoc.data();

        // Check permissions
        if (!hasTaskPermission(existingTask, 'edit')) {
            throw new Error('You do not have permission to edit this task');
        }

        const previousStatus = existingTask.status;
        const newStatus = updates.status;

        const activityEntry = {
            action: 'updated',
            userId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            details: 'Task updated'
        };

        if (newStatus && newStatus !== previousStatus) {
            activityEntry.details = `Status changed from ${previousStatus} to ${newStatus}`;
        }

        await taskRef.update({
            ...updates,
            version: (existingTask.version || 1) + 1,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            activityLog: firebase.firestore.FieldValue.arrayUnion(activityEntry)
        });

        // Track completion stats when status moves to done
        if (newStatus === 'done' && previousStatus !== 'done') {
            if (existingTask.teamId) {
                await updateUserStats('teamTasksCompleted');
            } else {
                await updateUserStats('personalTasksCompleted');
            }
        }

        // Notify owner when someone else updates their task
        if (existingTask.ownerId && existingTask.ownerId !== currentUser.uid) {
            await createNotification({
                userId: existingTask.ownerId,
                type: 'task_updated',
                title: 'Task Updated',
                message: `${userData.displayName} updated task: ${existingTask.title}`,
                taskId: taskId,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        Notiflix.Notify.success('Task updated successfully!');
        return { id: taskId, ...existingTask, ...updates };
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
}

async function deleteTask(taskId) {
    try {
        const taskRef = firebase.firestore().collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();
        
        if (!taskDoc.exists) {
            throw new Error('Task not found');
        }
        
        const task = taskDoc.data();
        
        // Check permissions
        if (!hasTaskPermission(task, 'delete')) {
            throw new Error('You do not have permission to delete this task');
        }
        
        await taskRef.delete();
        
        // Add to activity log
        await addActivityLog({
            userId: currentUser.uid,
            action: 'task_deleted',
            details: `Deleted task: ${task.title}`,
            taskId: taskId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        Notiflix.Notify.success('Task deleted successfully!');
        
        return taskId;
    } catch (error) {
        console.error('Error deleting task:', error);
        throw error;
    }
}

function hasTaskPermission(task, action) {
    if (!currentUser || !userData) return false;
    
    const userId = currentUser.uid;
    const userRole = userData.role;
    
    // Admin can do everything
    if (userRole === 'admin') return true;
    
    // Owner can do everything with their tasks
    if (task.ownerId === userId) return true;
    
    // Team lead can edit/delete team tasks
    if (userRole === 'lead' && task.teamId) {
        // Check if user is team lead of the task's team
        const userTeams = userData.teams || teams || [];
        const isTeamLead = userTeams.some(team => team.id === task.teamId && team.role === 'lead');
        return isTeamLead;
    }
    
    // Assignees can edit tasks assigned to them
    if (action === 'edit' && task.assigneeIds && task.assigneeIds.includes(userId)) {
        return true;
    }
    
    return false;
}

// ==================== TEAM MANAGEMENT ====================
async function loadTeams() {
    if (!currentUser) return [];
    
    try {
        // Get teams where user is a member
        const snapshot = await firebase.firestore()
            .collection('teams')
            .where('memberIds', 'array-contains', currentUser.uid)
            .get();
        
        teams = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        return teams;
    } catch (error) {
        console.error('Error loading teams:', error);
        throw error;
    }
}

async function createTeam(teamData) {
    if (!currentUser) throw new Error('User not authenticated');
    
    try {
        // Only leads and admins can create teams
        if (userData.role === 'member') {
            throw new Error('Only team leads and admins can create teams');
        }
        
        const team = {
            ...teamData,
            ownerId: currentUser.uid,
            leadId: currentUser.uid,
            memberIds: [currentUser.uid],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await firebase.firestore().collection('teams').add(team);
        
        // Update user stats
        await updateUserStats('groupsCreated');
        
        // Add to activity log
        await addActivityLog({
            userId: currentUser.uid,
            action: 'team_created',
            details: `Created team: ${team.name}`,
            teamId: docRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        Notiflix.Notify.success('Team created successfully!');
        
        return { id: docRef.id, ...team };
    } catch (error) {
        console.error('Error creating team:', error);
        throw error;
    }
}

async function inviteToTeam(teamId, email) {
    try {
        const teamRef = firebase.firestore().collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();
        
        if (!teamDoc.exists) {
            throw new Error('Team not found');
        }
        
        const team = teamDoc.data();
        
        // Check permissions
        if (!hasTeamPermission(team, 'invite')) {
            throw new Error('You do not have permission to invite members');
        }
        
        // Find user by email
        const usersSnapshot = await firebase.firestore()
            .collection('users')
            .where('email', '==', email)
            .get();
        
        if (usersSnapshot.empty) {
            throw new Error('User not found with this email');
        }
        
        const userDoc = usersSnapshot.docs[0];
        const invitedUser = userDoc.data();
        const invitedUserId = userDoc.id;
        
        // Check if user is already in team
        if (team.memberIds && team.memberIds.includes(invitedUserId)) {
            throw new Error('User is already a member of this team');
        }
        
        // Add user to team
        await teamRef.update({
            memberIds: firebase.firestore.FieldValue.arrayUnion(invitedUserId),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create notification for invited user
        await createNotification({
            userId: invitedUserId,
            type: 'team_invite',
            title: 'Team Invitation',
            message: `${userData.displayName} invited you to join team: ${team.name}`,
            teamId: teamId,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to activity log
        await addActivityLog({
            userId: currentUser.uid,
            action: 'team_invite',
            details: `Invited ${invitedUser.displayName} to team: ${team.name}`,
            teamId: teamId,
            invitedUserId: invitedUserId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        Notiflix.Notify.success(`Invitation sent to ${email}`);
        
    } catch (error) {
        console.error('Error inviting to team:', error);
        throw error;
    }
}

function hasTeamPermission(team, action) {
    if (!currentUser || !userData) return false;
    
    const userId = currentUser.uid;
    const userRole = userData.role;
    
    // Admin can do everything
    if (userRole === 'admin') return true;
    
    // Team owner/lead can do everything
    if (team.ownerId === userId || team.leadId === userId) return true;
    
    // Members can only view
    if (action === 'view' && team.memberIds && team.memberIds.includes(userId)) {
        return true;
    }
    
    return false;
}

// ==================== NOTIFICATIONS ====================
async function loadNotifications() {
    if (!currentUser) return [];
    
    try {
        const snapshot = await firebase.firestore()
            .collection('notifications')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        return notifications;
    } catch (error) {
        console.error('Error loading notifications:', error);
        throw error;
    }
}

async function createNotification(notificationData) {
    try {
        await firebase.firestore().collection('notifications').add(notificationData);
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await firebase.firestore().collection('notifications').doc(notificationId).update({
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        const batch = firebase.firestore().batch();
        const snapshot = await firebase.firestore()
            .collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .get();
        
        snapshot.docs.forEach(doc => {
            const ref = firebase.firestore().collection('notifications').doc(doc.id);
            batch.update(ref, {
                read: true,
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// ==================== ACTIVITY LOG ====================
async function addActivityLog(activityData) {
    try {
        await firebase.firestore().collection('activityLogs').add(activityData);
    } catch (error) {
        console.error('Error adding activity log:', error);
    }
}

async function getActivityLogs(limit = 50) {
    if (!currentUser) return [];
    
    try {
        const snapshot = await firebase.firestore()
            .collection('activityLogs')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting activity logs:', error);
        return [];
    }
}

// ==================== ADMIN FUNCTIONS ====================
async function adminLogin(email, password, secretKey) {
    ensureFirebaseReady();
    try {
        // First login with Firebase Auth
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        // Check if user is admin in Firestore
        const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        
        if (!userDoc.exists) {
            throw new Error('Admin account not found');
        }
        
        const userData = userDoc.data();
        
        // Check secret key for initial admin setup
        if (userData.role !== 'admin') {
            const adminSecretKey = 'TASKFLOW_ADMIN_SECRET'; // In production, store this securely
            
            if (secretKey !== adminSecretKey) {
                await firebase.auth().signOut();
                throw new Error('Invalid admin secret key');
            }
            
            // Upgrade to admin
            await upgradeUserRole(currentUser.uid, 'admin');
        }
        
        await loadUserData();
        window.location.href = 'admin-dashboard.html';
        
    } catch (error) {
        throw error;
    }
}

async function getUsersList(limit = 100) {
    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting users list:', error);
        throw error;
    }
}

async function updateUserRole(userId, newRole) {
    try {
        // Verify current user is admin
        if (!currentUser || userData.role !== 'admin') {
            throw new Error('Only admins can update user roles');
        }
        
        await firebase.firestore().collection('users').doc(userId).update({
            role: newRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to activity log
        await addActivityLog({
            userId: currentUser.uid,
            action: 'admin_role_update',
            details: `Changed user role to ${newRole}`,
            targetUserId: userId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create notification for the user
        await createNotification({
            userId: userId,
            type: 'role_change',
            title: 'Role Updated',
            message: `Your role has been changed to ${newRole}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        Notiflix.Notify.success('User role updated successfully!');
        
    } catch (error) {
        console.error('Error updating user role:', error);
        throw error;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Update user settings
    if (currentUser && userData) {
        firebase.firestore().collection('users').doc(currentUser.uid).update({
            'settings.theme': newTheme
        });
    }
}

function formatDate(dateString) {
    if (!dateString) return 'No date';
    
    const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
    
    return Math.floor(seconds) + ' second' + (seconds === 1 ? '' : 's') + ' ago';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    switch (type) {
        case 'success':
            Notiflix.Notify.success(message);
            break;
        case 'error':
            Notiflix.Notify.failure(message);
            break;
        case 'warning':
            Notiflix.Notify.warning(message);
            break;
        default:
            Notiflix.Notify.info(message);
    }
}

function checkUserRoleAndRedirect(userId) {
    ensureFirebaseReady();
    firebase.firestore().collection('users').doc(userId).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                if (userData.role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        })
        .catch((error) => {
            console.error('Error checking user role:', error);
        });
}

function updateUIForRole() {
    // This function updates UI based on user role
    // Implementation depends on the current page
    const role = userData?.role || 'member';
    
    // Show/hide admin elements
    const adminElements = document.querySelectorAll('[data-role="admin"]');
    adminElements.forEach(el => {
        el.style.display = role === 'admin' ? '' : 'none';
    });
    
    // Show/hide lead elements
    const leadElements = document.querySelectorAll('[data-role="lead"]');
    leadElements.forEach(el => {
        el.style.display = (role === 'admin' || role === 'lead') ? '' : 'none';
    });
    
    // Update role badge if exists
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
        roleBadge.textContent = role.toUpperCase();
        roleBadge.className = `role-badge role-${role}`;
    }
}

// ==================== CLOUDINARY FILE UPLOAD ====================
async function uploadFile(file, taskId = null) {
    if (!file) return null;
    
    try {
        // Validate file
        const validation = cloudinaryUploader.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Compress image if it's an image file
        let fileToUpload = file;
        if (file.type.startsWith('image/') && file.size > 1024 * 1024) { // > 1MB
            fileToUpload = await cloudinaryUploader.compressImage(file);
        }
        
        // Create folder path
        const folder = taskId ? `tasks/${taskId}` : 'tasks/temp';
        
        // Upload to Cloudinary
        const uploadResult = await cloudinaryUploader.uploadFile(fileToUpload, folder);
        
        return {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            optimizedUrl: cloudinaryUploader.getOptimizedUrl(uploadResult.publicId, { width: 800 })
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        
        // Fallback: Try File.io as backup (free file hosting)
        try {
            return await uploadToFileIO(file);
        } catch (fallbackError) {
            throw new Error(`Upload failed: ${error.message}`);
        }
    }
}

async function uploadToFileIO(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('https://file.io', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
        return {
            url: data.link,
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            expiresAt: data.expires
        };
    } else {
        throw new Error('Fallback upload failed');
    }
}

async function uploadMultipleFiles(files, taskId = null) {
    const uploadPromises = files.map(file => uploadFile(file, taskId));
    return Promise.all(uploadPromises);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    if (!(typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0)) {
        console.warn('Firebase is not initialized. Auth-dependent features are disabled until configuration is provided.');
        return;
    }
    
    // Check auth state
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            
            // Update UI based on role
            updateUIForRole();
            
            // Set up real-time listeners if on dashboard
            if (window.location.pathname.includes('dashboard')) {
                setupRealtimeListeners();
            }
        } else {
            // Redirect to login if not on auth pages
            const authPages = ['login.html', 'register.html', 'index.html', 'admin-login.html'];
            const currentPage = window.location.pathname.split('/').pop();
            
            if (!authPages.includes(currentPage)) {
                window.location.href = 'login.html';
            }
        }
    });
});

// ==================== REALTIME LISTENERS ====================
function setupRealtimeListeners() {
    if (!currentUser || !(typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0)) return;
    
    // Listen for task updates
    firebase.firestore()
        .collection('tasks')
        .where('ownerId', '==', currentUser.uid)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    // Update task in local array
                    const updatedTask = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };
                    
                    const index = tasks.findIndex(t => t.id === updatedTask.id);
                    if (index !== -1) {
                        tasks[index] = updatedTask;
                    } else {
                        tasks.push(updatedTask);
                    }
                    
                    // Trigger UI update
                    if (typeof window.renderTasks === 'function') {
                        window.renderTasks(tasks);
                    }
                }
                
                if (change.type === 'removed') {
                    tasks = tasks.filter(t => t.id !== change.doc.id);
                    
                    // Trigger UI update
                    if (typeof window.renderTasks === 'function') {
                        window.renderTasks(tasks);
                    }
                }
            });
        });
    
    // Listen for notifications
    firebase.firestore()
        .collection('notifications')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .onSnapshot((snapshot) => {
            notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Update notification badge
            const unreadCount = notifications.filter(n => !n.read).length;
            const badge = document.getElementById('notification-badge');
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }
        });
}

// ==================== GLOBAL EXPORTS ====================
// Make functions available globally for onclick handlers
window.loginUser = loginUser;
window.registerUser = registerUser;
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
window.createTask = createTask;
window.updateTask = updateTask;
window.deleteTask = deleteTask;
window.createTeam = createTeam;
window.inviteToTeam = inviteToTeam;
window.toggleTheme = toggleTheme;
window.updateUserRole = updateUserRole;
window.adminLogin = adminLogin;
window.formatDate = formatDate;
window.formatTimeAgo = formatTimeAgo;
window.escapeHtml = escapeHtml;
window.showNotification = showNotification;