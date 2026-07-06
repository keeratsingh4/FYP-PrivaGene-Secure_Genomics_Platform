// ===================================
// PRIVAGENE - NAVIGATION UTILITIES
// Page navigation and UI helpers
// ===================================

const Navigation = {
    // Get relative path to root pages directory from current location
    getPathToPages() {
        const path = window.location.pathname;
        const segments = path.split('/');
        const pagesIndex = segments.lastIndexOf('pages');

        if (pagesIndex === -1) return './';

        const depth = segments.length - pagesIndex - 2; // -2 for 'pages' and current file
        return '../'.repeat(Math.max(0, depth));
    },

    // Navigate to a page (resolves path automatically)
    goto(path) {
        // If path starts with '/', it' an absolute page path
        if (path.startsWith('/')) {
            window.location.href = this.getPathToPages() + path.substring(1);
        } else {
            window.location.href = path;
        }
    },

    // Navigate to home/landing page
    goHome() {
        window.location.href = this.getPathToPages() + 'index.html';
    },
    // Get current page name from URL
    getCurrentPage() {
        const path = window.location.pathname;
        return path.substring(path.lastIndexOf('/') + 1).replace('.html', '');
    },

    // Navigate back
    goBack() {
        window.history.back();
    },

    // Set active navigation link based on current page
    setActiveNav(navSelector = '.navbar-link, .sidebar-link') {
        const currentPage = this.getCurrentPage();
        const links = document.querySelectorAll(navSelector);

        links.forEach(link => {
            const linkHref = link.getAttribute('href') || '';
            const linkPage = linkHref.substring(linkHref.lastIndexOf('/') + 1).replace('.html', '');

            if (linkPage === currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    },

    // Display user info in navbar/sidebar
    displayUserInfo(user) {
        const userNameElements = document.querySelectorAll('[data-user-name]');
        const userEmailElements = document.querySelectorAll('[data-user-email]');
        const userRoleElements = document.querySelectorAll('[data-user-role]');

        // Handle both snake_case (backend) and camelCase (frontend)
        const firstName = user.first_name || user.firstName || '';
        const lastName = user.last_name || user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim() || user.email.split('@')[0] || user.email;

        userNameElements.forEach(el => {
            el.textContent = fullName;
        });

        userEmailElements.forEach(el => {
            el.textContent = user.email;
        });

        userRoleElements.forEach(el => {
            el.textContent = this.formatRole(user.role);
        });
    },

    // Format role for display
    formatRole(role) {
        const roleMap = {
            patient: 'Patient',
            hospital: 'Doctor',
            doctor: 'Doctor',
            admin: 'Hospital Admin',
            hospital_admin: 'Hospital Admin',
            system_admin: 'System Admin',
            researcher: 'Researcher',
            caregiver: 'Caregiver',
            security_admin: 'Security Admin'
        };
        return roleMap[role] || role;
    }
};

// ===================================
// UI UTILITIES
// ===================================

const UI = {
    // Show loading overlay
    showLoading(message = 'Loading...') {
        const existing = document.getElementById('loading-overlay');
        if (existing) return;

        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
      <div class="spinner spinner-lg" style="border-color: rgba(255,255,255,0.3); border-top-color: white;"></div>
      <div class="loading-text">${message}</div>
    `;
        document.body.appendChild(overlay);
    },

    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    },

    // Show alert/notification
    showAlert(message, type = 'info', duration = 5000) {
        const alertContainer = this.getOrCreateAlertContainer();

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fade-in`;
        alert.style.marginBottom = 'var(--space-md)';

        const icons = {
            info: 'ℹ️',
            success: '✓',
            warning: '⚠️',
            error: '✕'
        };

        alert.innerHTML = `
      <span class="alert-icon">${icons[type] || icons.info}</span>
      <div class="alert-content">${message}</div>
    `;

        alertContainer.appendChild(alert);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            }, duration);
        }

        return alert;
    },

    getOrCreateAlertContainer() {
        let container = document.getElementById('alert-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alert-container';
            container.style.position = 'fixed';
            container.style.top = 'var(--space-lg)';
            container.style.right = 'var(--space-lg)';
            container.style.zIndex = '1000';
            container.style.maxWidth = '400px';
            document.body.appendChild(container);
        }
        return container;
    },

    // Show modal
    showModal(options) {
        const { title, body, buttons = [], onClose } = options;

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.id = 'modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'modal';

        let buttonsHtml = '';
        if (buttons.length > 0) {
            buttonsHtml = `
        <div class="modal-footer">
          ${buttons.map((btn, index) => `
            <button class="btn ${btn.className || 'btn-primary'}" data-btn-index="${index}">
              ${btn.text || btn.label || 'Button'}
            </button>
          `).join('')}
        </div>
      `;
        }

        modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" data-action="close">✕</button>
      </div>
      <div class="modal-body">
        ${body}
      </div>
      ${buttonsHtml}
    `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Button handlers
        modal.querySelectorAll('button[data-btn-index]').forEach((button, index) => {
            button.addEventListener('click', async () => {
                const btn = buttons[index];
                if (btn && btn.onClick) {
                    const shouldClose = await btn.onClick();
                    if (shouldClose !== false) {
                        this.closeModal();
                    }
                } else {
                    this.closeModal();
                }
            });
        });

        // Handle button clicks for close action
        modal.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (button) {
                const action = button.dataset.action;

                if (action === 'close') {
                    this.closeModal();
                    if (onClose) onClose();
                }
            }
        });

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.closeModal();
                if (onClose) onClose();
            }
        });

        return backdrop;
    },

    // Close modal
    closeModal() {
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    },

    // Confirm dialog
    async confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            this.showModal({
                title,
                body: `<p>${message}</p>`,
                buttons: [
                    {
                        label: 'Cancel',
                        className: 'btn-outline',
                        action: 'cancel',
                        onClick: () => {
                            this.closeModal();
                            resolve(false);
                        }
                    },
                    {
                        label: 'Confirm',
                        className: 'btn-primary',
                        action: 'confirm',
                        onClick: () => {
                            this.closeModal();
                            resolve(true);
                        }
                    }
                ]
            });
        });
    },

    // Format date for display
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Format date and time
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    // Validate form
    validateForm(formElement) {
        const inputs = formElement.querySelectorAll('[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('error');
                isValid = false;
            } else {
                input.classList.remove('error');
            }
        });

        return isValid;
    },

    // Set form error
    setFormError(inputElement, message) {
        inputElement.classList.add('error');

        // Remove existing error message
        const existingError = inputElement.parentElement.querySelector('.form-error');
        if (existingError) {
            existingError.remove();
        }

        if (message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'form-error';
            errorDiv.textContent = message;
            inputElement.parentElement.appendChild(errorDiv);
        }
    },

    // Clear form error
    clearFormError(inputElement) {
        inputElement.classList.remove('error');
        const errorDiv = inputElement.parentElement.querySelector('.form-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    },

    // Password strength checker
    checkPasswordStrength(password) {
        let strength = 0;
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };

        if (checks.length) strength++;
        if (checks.uppercase) strength++;
        if (checks.lowercase) strength++;
        if (checks.number) strength++;
        if (checks.special) strength++;

        return {
            strength,
            checks,
            level: strength <= 2 ? 'weak' : strength <= 3 ? 'medium' : 'strong'
        };
    },

    // Add password strength indicator
    addPasswordStrengthIndicator(passwordInput) {
        const container = passwordInput.parentElement;

        // Add guidelines
        const guidelines = document.createElement('div');
        guidelines.className = 'password-guidelines';
        guidelines.style.cssText = 'margin-top: var(--space-sm); font-size: var(--text-sm);';
        guidelines.innerHTML = `
            <div class="text-secondary" style="margin-bottom: var(--space-xs);">Password must contain:</div>
            <div class="password-req" data-req="length" style="color: var(--text-tertiary); margin-left: var(--space-md);">✓ At least 8 characters</div>
            <div class="password-req" data-req="uppercase" style="color: var(--text-tertiary); margin-left: var(--space-md);">✓ One uppercase letter</div>
            <div class="password-req" data-req="number" style="color: var(--text-tertiary); margin-left: var(--space-md);">✓ One number</div>
        `;
        container.appendChild(guidelines);

        // Add strength bar
        const strengthBar = document.createElement('div');
        strengthBar.className = 'password-strength-bar';
        strengthBar.style.cssText = 'margin-top: var(--space-sm); height: 4px; background: var(--border-light); border-radius: var(--radius-sm); overflow: hidden;';
        strengthBar.innerHTML = '<div class="strength-fill" style="height: 100%; width: 0%; transition: all 0.3s; background: var(--text-tertiary);"></div>';
        container.appendChild(strengthBar);

        // Add event listener
        passwordInput.addEventListener('input', () => {
            const result = this.checkPasswordStrength(passwordInput.value);
            const fill = strengthBar.querySelector('.strength-fill');
            const reqs = container.querySelectorAll('.password-req');

            // Update requirements
            Object.keys(result.checks).forEach(key => {
                const req = container.querySelector(`[data-req="${key}"]`);
                if (req) {
                    req.style.color = result.checks[key] ? 'var(--success-color)' : 'var(--text-tertiary)';
                }
            });

            // Update strength bar
            const widths = { weak: '33%', medium: '66%', strong: '100%' };
            const colors = { weak: 'var(--error-color)', medium: 'var(--warning-color)', strong: 'var(--success-color)' };
            fill.style.width = widths[result.level];
            fill.style.background = colors[result.level];
        });
    }
};

// Export for use in other scripts
window.Navigation = Navigation;
window.UI = UI;