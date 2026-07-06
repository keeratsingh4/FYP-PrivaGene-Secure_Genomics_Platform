// ===================================
// PRIVAGENE - SECURITY AUTHENTICATION
// Separate auth system for Security Admin
// ===================================

const SecurityAuth = {
    // API endpoint for security login - use Config if available
    get API_BASE() {
        return (typeof Config !== 'undefined' && Config.backend) ? Config.backend.baseURL : 'http://localhost:3001';
    },

    // Check if user is authenticated as security admin
    isSecurityAuthenticated() {
        const user = Auth.getCurrentUser();
        return user && user.role === 'security_admin';
    },

    // Redirect to security login if not authenticated
    requireSecurityAuth() {
        if (!this.isSecurityAuthenticated()) {
            window.location.href = 'security-login.html';
            return false;
        }
        return true;
    },

    // Login via security-specific endpoint
    async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE}/api/security/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Login failed');
            }

            // Store security user in session
            if (data.user) {
                Auth.setCurrentUser(data.user);
            }

            return data.user;
        } catch (error) {
            console.error('Security login error:', error);
            throw error;
        }
    },

    // Logout security user
    logout() {
        Auth.logout();
        window.location.href = 'security-login.html';
    },

    // Get security login path
    getLoginPath() {
        return 'security-login.html';
    }
};

// Initialize security login form handler
(function initSecurityLogin() {
    const form = document.getElementById('security-login-form');
    if (!form) return; // Not on login page

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');

    // If already logged in as security admin, redirect to dashboard
    if (SecurityAuth.isSecurityAuthenticated()) {
        window.location.href = 'security-dashboard.html';
        return;
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }

    // Hide error message
    function hideError() {
        errorMessage.classList.remove('show');
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validate inputs
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        // Disable button and show loading state
        loginBtn.disabled = true;
        loginBtn.innerHTML = '⏳ Authenticating...';

        try {
            const user = await SecurityAuth.login(email, password);

            loginBtn.innerHTML = '✅ Success!';

            // Show success message
            if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('Login successful! Redirecting...', 'success', 2000);
            }

            // Redirect to security dashboard
            setTimeout(() => {
                window.location.href = 'security-dashboard.html';
            }, 1000);

        } catch (error) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '🔐 Secure Login';
            showError(error.message || 'Authentication failed. Please try again.');
        }
    });

    // Clear error on input
    emailInput.addEventListener('input', hideError);
    passwordInput.addEventListener('input', hideError);
})();
