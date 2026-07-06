// ===================================
// PRIVAGENE - AUTHENTICATION
// ===================================

// BACKEND_INTEGRATION: Replace all authentication logic with JWT tokens or session-based auth from your backend

const Auth = {
    // Get current logged-in user
    getCurrentUser() {
        // BACKEND_INTEGRATION: Replace with API call: GET /api/auth/me (using session cookie or JWT)
        const userJson = sessionStorage.getItem('privagene_current_user');
        return userJson ? JSON.parse(userJson) : null;
    },

    // Set current user in session
    setCurrentUser(user) {
        // BACKEND_INTEGRATION: This will be handled by server-side session or JWT token
        sessionStorage.setItem('privagene_current_user', JSON.stringify(user));
    },

    // Clear current user
    clearCurrentUser() {
        // BACKEND_INTEGRATION: Replace with API call: POST /api/auth/logout
        sessionStorage.removeItem('privagene_current_user');
    },

    // Check if user is authenticated
    isAuthenticated() {
        
        return this.getCurrentUser() !== null;
    },

    // Check if user has a specific role
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    },

    // Helper function to clear all gene-related data from localStorage
    clearGeneData() {
        // Clear standard gene data keys
        localStorage.removeItem('mappedGeneSymbols');
        localStorage.removeItem('geneUploads');
        localStorage.removeItem('psiResult');
        
        // Clear all patient-specific gene keys (patient_*_genes)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('patient_') && key.endsWith('_genes')) {
                keysToRemove.push(key);
            }
        }
        
        // Remove all patient gene keys
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        console.log(`Cleared ${keysToRemove.length} patient gene data entries`);
    },

    // Login function
    async login(email, password) {
        try {
            const response = await fetch(`${Config.backend.baseURL}/api/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Backend responded with an error (401, 403, etc.)
                // Throw the error message from the backend
                throw new Error(data.message || data.error || 'Invalid email or password');
            }

            const user = data.user;

            // Clear all gene data when logging in
            this.clearGeneData();

            // Store user in session
            this.setCurrentUser(user);
            return user;

        } catch (error) {
            // Check if it's a network error (backend truly unavailable)
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error('Backend server is not running');
                throw new Error('Cannot connect to server. Please try again later.');
            }
            
            // Re-throw authentication errors (wrong credentials, suspended account, etc.)
            throw error;
        }
    },

    // Register function
    async register(userData, autoLogin = true) {
        try {
            const response = await fetch(`${Config.backend.baseURL}/api/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                // Backend responded with an error
                throw new Error(data.message || data.error || 'Registration failed');
            }

            const user = data.user;

            // Auto-login for non-admin roles
            if (autoLogin && userData.role !== 'system_admin' && user.status === 'active') {
                this.setCurrentUser(user);
            }

            return user;

        } catch (error) {
            // Check if it's a network error (backend truly unavailable)
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error('Backend server is not running');
                throw new Error('Cannot connect to server. Please try again later.');
            }
            
            // Re-throw registration errors
            throw error;
        }
    },

    // Logout function
    logout() {
        // Clear all gene data when logging out
        this.clearGeneData();
        
        // BACKEND_INTEGRATION: Replace with API call: POST /api/auth/logout
        this.clearCurrentUser();
        // Use navigation helper to resolve path robustly
        const prefix = (window.Navigation && typeof Navigation.getPathToPages === 'function') ? Navigation.getPathToPages() : './';
        window.location.href = prefix + 'index.html';
    },

    // Request password reset
    async requestPasswordReset(email) {
        // TODO: Implement backend endpoint POST /api/auth/password-reset-request
        throw new Error('Password reset feature is not yet implemented. Please contact support.');
    },

    // Reset password
    async resetPassword(token, newPassword) {
        // BACKEND_INTEGRATION: Replace with API call: POST /api/auth/password-reset
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // In production, validate the token and update password in database
                if (newPassword.length < 8) {
                    reject({ message: 'Password must be at least 8 characters long' });
                    return;
                }

                console.log('Password reset successful');
                resolve({ message: 'Password updated successfully' });
            }, 800);
        });
    },

    // Update password for logged-in user
    async updatePassword(currentPassword, newPassword) {
        // TODO: Implement backend endpoint PUT /api/auth/password
        throw new Error('Password update feature is not yet implemented.');
    },

    // Update user profile
    async updateProfile(updates) {
        // TODO: Implement backend endpoint PUT /api/users/profile
        throw new Error('Profile update feature is not yet implemented.');
    },

    // Delete user account
    async deleteAccount(password) {
        // TODO: Implement backend endpoint DELETE /api/users/account
        throw new Error('Account deletion feature is not yet implemented.');
    },

    // Redirect to appropriate dashboard based on user role
    redirectToDashboard(user) {
        // Determine current location and build appropriate path
        const currentPath = window.location.pathname;
        let basePath = '';

        // If we're in pages directory (login.html, index.html, etc)
        if (currentPath.includes('/pages/') && !currentPath.includes('/pages/patient/') &&
            !currentPath.includes('/pages/hospital/') && !currentPath.includes('/pages/admin/') &&
            !currentPath.includes('/pages/system-admin/') && !currentPath.includes('/pages/researcher/') &&
            !currentPath.includes('/pages/caregiver/')) {
            basePath = '';
        } else {
            // We're somewhere else, use relative path back to pages
            basePath = '../';
        }

        const dashboardPaths = {
            patient: basePath + 'patient/dashboard.html',
            hospital: basePath + 'hospital/dashboard.html',
            hospital_admin: basePath + 'admin/dashboard.html',
            admin: basePath + 'admin/dashboard.html',
            system_admin: basePath + 'system-admin/dashboard.html',
            researcher: basePath + 'researcher/dashboard.html',
            caregiver: basePath + 'caregiver/dashboard.html',
            security_admin: basePath + 'security/security-dashboard.html'
        };

        const dashboardPath = dashboardPaths[user.role];
        if (dashboardPath) {
            window.location.href = dashboardPath;
        } else {
            console.error('Unknown user role:', user.role);
        }
    },

    // Require authentication for a page
    requireAuth() {
        if (!this.isAuthenticated()) {
            // Navigate to login from any subdirectory
            const currentPath = window.location.pathname;
            const depth = (currentPath.match(/\//g) || []).length - 2;
            const prefix = '../'.repeat(Math.max(0, depth));
            window.location.href = prefix + 'login.html';
            return false;
        }
        return true;
    },

    // Require specific role for a page
    requireRole(role) {
        if (!this.requireAuth()) {
            return false;
        }

        if (!this.hasRole(role)) {
            // Redirect to their own dashboard
            this.redirectToDashboard(this.getCurrentUser());
            return false;
        }

        return true;
    }
};

// Export for use in other scripts
window.Auth = Auth;