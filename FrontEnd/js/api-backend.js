// ===================================
// PRIVAGENE - BACKEND API SERVICE
// Real backend integration for document storage and user management
// ===================================

const BackendAPI = {
    // Configuration
    config: {
        baseURL: (typeof Config !== 'undefined' && Config.backend) ? Config.backend.baseURL : 'http://localhost:3001',
        enabled: true // Set to false to use mock API only
    },

    // Helper to get current user info
    getCurrentUser() {
        // Use Auth.getCurrentUser() which reads from sessionStorage
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            console.warn('No user logged in');
            return null;
        }
        return currentUser;
    },

    // Helper to check if backend is available
    async checkHealth() {
        if (!this.config.enabled) return false;

        try {
            const response = await fetch(`${this.config.baseURL}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            console.warn('Backend not available:', error.message);
            return false;
        }
    },

    // ===================================
    // SYSTEM ADMIN - PLATFORM ANALYTICS
    // ===================================

    /**
     * Get platform-wide analytics for system admin
     * @returns {Promise<Object>} analytics payload
     */
    async getPlatformAnalytics() {
        // If backend disabled, approximate using local storage (legacy behavior)
        if (!this.config.enabled) {
            const users = Storage.get('users') || [];
            const assessments = Storage.get('risk_assessments') || [];
            const orgs = new Set();
            users.filter(u => u.organization || u.organization_name).forEach(u => orgs.add(u.organization || u.organization_name));

            // Aggregate role distribution from local storage
            const roleMap = {};
            users.forEach(u => {
                const role = u.role || 'unknown';
                const status = (u.status || 'active').toLowerCase();
                if (!roleMap[role]) roleMap[role] = { role, active: 0, pending: 0, suspended: 0, total: 0 };
                roleMap[role].total++;
                if (status === 'pending_approval') roleMap[role].pending++;
                else if (status === 'suspended') roleMap[role].suspended++;
                else roleMap[role].active++;
            });

            return {
                metrics: {
                    totalUsers: users.length,
                    totalAssessments: assessments.length,
                    activeOrganizations: orgs.size,
                    pendingOrganizations: 0
                },
                roleDistribution: Object.values(roleMap),
                trends: { usersByMonth: [], assessmentsByMonth: [] }
            };
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/admin/platform-analytics`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to load platform analytics');
            }

            const data = await response.json();
            return data.analytics;
        } catch (error) {
            console.error('Error loading platform analytics:', error);
            throw error;
        }
    },

    // ===================================
    // USER MANAGEMENT
    // ===================================

    /**
     * Get all users from the backend
     * @param {Object} filters - Optional filters (role, status)
     * @returns {Promise<Array>} Array of users
     */
    async getAllUsers(filters = {}) {
        if (!this.config.enabled) {
            console.log('Backend disabled, falling back to localStorage');
            return Storage.get('users') || [];
        }

        try {
            let url = `${this.config.baseURL}/api/users`;
            const params = new URLSearchParams();

            if (filters.role) params.append('role', filters.role);
            if (filters.status) params.append('status', filters.status);
            if (filters.includeDeleted) params.append('includeDeleted', 'true');

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            console.log('Users loaded from backend:', data);
            return data.users || [];
        } catch (error) {
            console.error('Error fetching users from backend:', error);
            // Fallback to localStorage
            return Storage.get('users') || [];
        }
    },

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User object
     */
    async getUserById(userId) {
        if (!this.config.enabled) {
            return Storage.getUserById(userId);
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error fetching user:', error);
            throw error;
        }
    },

    /**
     * Update user status (approve, suspend, activate)
     * @param {string} userId - User ID
     * @param {string} status - New status (active, suspended, pending_approval)
     * @returns {Promise<Object>} Updated user
     */
    async updateUserStatus(userId, status) {
        if (!this.config.enabled) {
            return Storage.updateUser(userId, { status });
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update user status');
            }
            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error updating user status:', error);
            throw error;
        }
    },

    /**
     * Suspend a user
     * @param {string} userId - User ID
     * @param {string} reason - Reason for suspension
     * @returns {Promise<Object>} Updated user
     */
    async suspendUser(userId, reason = '') {
        return await this.updateUserStatus(userId, 'suspended');
    },

    /**
     * Activate a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Updated user
     */
    async activateUser(userId) {
        return await this.updateUserStatus(userId, 'active');

    },
    /**
     * Update user profile
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update (firstName, lastName, phone, dateOfBirth, etc.)
     * @returns {Promise<Object>} Updated user
     */
    async updateUserProfile(userId, updates) {
        if (!this.config.enabled) {
            return Storage.updateUser(userId, updates);
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update profile');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    },

    /**
     * Update user password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password for verification
     * @param {string} newPassword - New password to set
     * @returns {Promise<Object>} Success response
     */
    async updatePassword(userId, currentPassword, newPassword) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update password');
            }

            return data;
        } catch (error) {
            console.error('Error updating password:', error);
            throw error;
        }
    },

    /**
     * Delete a user
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteUser(userId) {
        if (!this.config.enabled) {
            Storage.deleteUser(userId);
            return true;
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete user');
            }

            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    },

    /**
     * Permanently delete a user from database (GDPR compliance)
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Success status
     */
    async hardDeleteUser(userId) {
        if (!this.config.enabled) {
            Storage.deleteUser(userId);
            return true;
        }

        try {
            const user = this.getCurrentUser();
            
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}/permanent`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to permanently delete user');
            }

            return true;
        } catch (error) {
            console.error('Error permanently deleting user:', error);
            throw error;
        }
    },

    /**
     * Update user profile
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated user
     */
    async updateUser(userId, updates) {
        if (!this.config.enabled) {
            return Storage.updateUser(userId, updates);
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update user');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },

    // ===================================
    // DISEASE CATEGORIES
    // ===================================

    /**
     * Get all disease categories (without genes for privacy)
     * @returns {Promise<Array>} Array of disease categories
     */
    async getDiseaseCategories() {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty categories');
            return [];
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/disease-categories`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load disease categories');
            }

            const data = await response.json();
            
            // Handle both response formats (array or {categories: array})
            const categories = Array.isArray(data) ? data : (data.categories || []);
            
            // Normalize the response to match expected frontend format
            // Map database fields to frontend expected fields
            const normalizedCategories = categories.map(cat => ({
                id: cat.id,
                name: cat.disease_name || cat.name,
                description: cat.description || '',
                hospitalId: cat.hospital_id || cat.hospitalId,
                hospitalName: cat.hospital_name || cat.hospitalName,
                diseaseCode: cat.disease_code || cat.diseaseCode
                // NOTE: gene_symbols are intentionally NOT included for privacy
            }));
            
            console.log('Disease categories loaded:', normalizedCategories);
            return normalizedCategories;
        } catch (error) {
            console.error('Error fetching disease categories:', error);
            throw error;
        }
    },

    // ===================================
    // RISK ASSESSMENTS
    // ===================================

    /**
     * Create a new risk assessment
     * @param {Object} data - Assessment data
     * @returns {Promise<Object>} Created assessment
     */
    async createRiskAssessment(data) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping risk assessment storage');
            return { success: true, assessment: data };
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/risk-assessments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to create risk assessment');
            }

            const result = await response.json();
            console.log('Risk assessment created:', result);
            return result;
        } catch (error) {
            console.error('Error creating risk assessment:', error);
            throw error;
        }
    },

    /**
     * Get all risk assessments for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of assessments
     */
    async getRiskAssessments(userId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, checking localStorage');
            const stored = localStorage.getItem('psiResult');
            if (stored) {
                const results = JSON.parse(stored);
                return results.map(r => ({
                    id: 'local_' + Date.now(),
                    userId: userId,
                    overallRisk: r.result.riskPercentage,
                    diseaseId: r.disease,
                    matchCount: r.result.matchCount,
                    matchedGenes: r.result.matches,
                    riskPercentage: r.result.riskPercentage,
                    createdAt: new Date().toISOString()
                }));
            }
            return [];
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/risk-assessments/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get risk assessments');
            }

            const data = await response.json();
            console.log('Backend response:', data);  // Debug log
            
            // Make sure we return an array
            const assessments = data.assessments || [];
            console.log('Returning assessments:', assessments);  // Debug log
            
            return assessments;
        } catch (error) {
            console.error('Error fetching risk assessments:', error);

            // Fallback to localStorage
            console.log('Falling back to localStorage');
            const stored = localStorage.getItem('psiResult');
            if (stored) {
                const results = JSON.parse(stored);
                return results.map(r => ({
                    id: 'local_' + Date.now(),
                    userId: userId,
                    overallRisk: r.result.riskPercentage,
                    diseaseId: r.disease,
                    matchCount: r.result.matchCount,
                    matchedGenes: r.result.matches,
                    riskPercentage: r.result.riskPercentage,
                    createdAt: new Date().toISOString()
                }));
            }
            
            return [];  // Always return an array, never undefined
        }
    },

    // Generate a unique session ID for a risk assessment
    generateSessionId(userId, assessmentId) {
        return `assessment_${userId}_${assessmentId || Date.now()}`;
    },

    // ===================================
    // DOCUMENT UPLOAD
    // ===================================

    /**
     * Upload a risk assessment document to the backend
     * @param {File|Blob} file - The file to upload
     * @param {string} userId - The user ID
     * @param {string} assessmentId - The risk assessment ID (session ID)
     * @returns {Promise<{success: boolean, id: string, fileName: string, size: number}>}
     */
    async uploadRiskAssessment(file, userId, assessmentId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping upload');
            return { success: true, id: 'mock_' + Date.now(), fileName: file.name, size: file.size };
        }

        try {
            const user = this.getCurrentUser();
            const sessionId = this.generateSessionId(userId, assessmentId);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('session_id', sessionId);

            const response = await fetch(`${this.config.baseURL}/api/documents/upload`, {
                method: 'POST',
                headers: {
                    'X-Role': user.role,
                    'X-Session-ID': sessionId
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const result = await response.json();
            console.log('Document uploaded successfully:', result);
            return result;
        } catch (error) {
            console.error('Failed to upload document:', error);
            throw error;
        }
    },

    // ===================================
    // DOCUMENT LISTING
    // ===================================

    /**
     * List all documents for a specific session (risk assessment)
     * @param {string} sessionId - The session ID (assessment ID)
     * @returns {Promise<Array>} Array of document metadata
     */
    async listRiskAssessments(sessionId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty list');
            return [];
        }

        try {
            const user = this.getCurrentUser();

            const response = await fetch(`${this.config.baseURL}/api/documents?session_id=${encodeURIComponent(sessionId)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user.role
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to retrieve documents');
            }

            const result = await response.json();
            console.log('Documents retrieved:', result);
            return result.documents || [];
        } catch (error) {
            console.error('Failed to list documents:', error);
            throw error;
        }
    },

    // ===================================
    // DOCUMENT DOWNLOAD
    // ===================================

    /**
     * Download a specific document by ID
     * @param {string} docId - The document ID
     * @param {string} sessionId - Optional session ID for verification
     * @returns {Promise<Blob>} The document file as a Blob
     */
    async downloadRiskAssessment(docId, sessionId = null) {
        if (!this.config.enabled) {
            throw new Error('Backend disabled');
        }

        try {
            const user = this.getCurrentUser();

            const headers = {
                'X-Role': user.role
            };

            if (sessionId) {
                headers['X-Session-ID'] = sessionId;
            }

            const response = await fetch(`${this.config.baseURL}/api/documents/${docId}/download`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            const blob = await response.blob();
            return blob;
        } catch (error) {
            console.error('Failed to download document:', error);
            throw error;
        }
    },

    /**
     * Trigger a browser download for a document
     * @param {string} docId - The document ID
     * @param {string} fileName - The file name to save as
     * @param {string} sessionId - Optional session ID
     */
    async triggerDownload(docId, fileName, sessionId = null) {
        try {
            const blob = await this.downloadRiskAssessment(docId, sessionId);

            // Create a download link and trigger it
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'document';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log('Document downloaded:', fileName);
        } catch (error) {
            console.error('Failed to trigger download:', error);
            alert('Failed to download document: ' + error.message);
        }
    },

    // ===================================
    // DOCUMENT DELETION (Admin only)
    // ===================================

    /**
     * Delete a document (admin/hospital_admin/system_admin only)
     * @param {string} docId - The document ID to delete
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async deleteRiskAssessment(docId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, simulating delete');
            return { success: true, message: 'Document deleted (mock)' };
        }

        try {
            const user = this.getCurrentUser();

            // Check if user has admin role
            if (!['hospital_admin', 'system_admin'].includes(user.role)) {
                throw new Error('Only administrators can delete documents');
            }

            const response = await fetch(`${this.config.baseURL}/api/documents/${docId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user.role
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Delete failed');
            }

            const result = await response.json();
            console.log('Document deleted:', result);
            return result;
        } catch (error) {
            console.error('Failed to delete document:', error);
            throw error;
        }
    },

    // ===================================
    // UTILITY FUNCTIONS
    // ===================================

    /**
     * Create a downloadable file from assessment results
     * @param {Object} assessment - The risk assessment object
     * @param {string} format - 'json', 'csv', or 'txt'
     * @returns {Blob} The file as a Blob
     */
    createAssessmentFile(assessment, format = 'json') {
        let content = '';
        let mimeType = 'text/plain';

        if (format === 'json') {
            content = JSON.stringify(assessment, null, 2);
            mimeType = 'application/json';
        } else if (format === 'csv') {
            // Create CSV format
            const headers = ['Category', 'Risk Percentage', 'Risk Level', 'Affected Genes'];
            const rows = assessment.results.map(r => [
                r.category,
                r.riskPercentage + '%',
                r.riskLevel,
                (r.affectedGenes || []).join('; ')
            ]);

            content = [headers, ...rows].map(row => row.join(',')).join('\n');
            content = `Risk Assessment Report\nGenerated: ${assessment.computedAt}\nOverall Risk: ${assessment.overallRisk}%\n\n${content}`;
            mimeType = 'text/csv';
        } else {
            // Text format
            content = `Risk Assessment Report\n`;
            content += `Generated: ${assessment.computedAt}\n`;
            content += `Overall Risk: ${assessment.overallRisk}%\n\n`;
            content += `Results:\n`;

            assessment.results.forEach(r => {
                content += `\nCategory: ${r.category}\n`;
                content += `Risk: ${r.riskPercentage}% (${r.riskLevel})\n`;
                content += `Affected Genes: ${(r.affectedGenes || []).join(', ')}\n`;
            });

            mimeType = 'text/plain';
        }

        return new Blob([content], { type: mimeType });
    },

    // ===================================
    // HOSPITAL SPECIALIST MANAGEMENT API FUNCTIONS
    // ===================================

    /**
     * Create a hospital specialist account (hospital_admin only)
     * @param {Object} data - Specialist data
     * @param {string} data.email - Email address
     * @param {string} data.password - Password
     * @param {string} data.firstName - First name
     * @param {string} data.lastName - Last name
     * @param {string} data.phone - Phone number
     * @param {string} data.licenseNumber - Medical license number
     * @param {string} data.organizationName - Organization name (auto-filled from admin)
     * @returns {Promise<Object>} Created user object
     */
    async createHospitalSpecialist(data) {
        if (!this.config.enabled) {
            console.log('Backend disabled, cannot create hospital specialist');
            return { success: false, message: 'Backend not available' };
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/users/create-hospital-specialist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'hospital_admin'
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phone: data.phone,
                    licenseNumber: data.licenseNumber,
                    organizationName: data.organizationName
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: result.message || result.error || 'Failed to create specialist account'
                };
            }

            return {
                success: true,
                user: result.user,
                message: result.message
            };
        } catch (error) {
            console.error('Error creating hospital specialist:', error);
            return {
                success: false,
                message: error.message || 'An error occurred while creating the account'
            };
        }
    },

    /**
     * Get hospital specialists by organization name
     * @param {string} organizationName - The organization name to filter by
     * @returns {Promise<Array>} Array of specialists
     */
    async getHospitalSpecialists(organizationName) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty specialists list');
            return [];
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(
                `${this.config.baseURL}/api/users/hospital-specialists/${encodeURIComponent(organizationName)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Role': user?.role || 'hospital_admin'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch hospital specialists');
            }

            const data = await response.json();
            return data.specialists || [];
        } catch (error) {
            console.error('Error fetching hospital specialists:', error);
            return [];
        }
    },

    /**
     * Get hospital admin dashboard stats
     * @returns {Promise<Object>} Dashboard statistics
     */
    async getHospitalAdminStats() {
        if (!this.config.enabled) {
            return {
                diseaseCount: 0,
                specialistCount: 0,
                totalGenes: 0,
                totalAssessments: 0
            };
        }

        try {
            const user = this.getCurrentUser();
            const organizationName = user?.organizationName || user?.organization_name;

            // Get disease categories for this hospital
            const categories = await this.getDiseaseCategories();
            const hospitalCategories = categories.filter(c => 
                c.hospitalName === organizationName || c.hospital_name === organizationName
            );

            // Get specialists for this organization
            const specialists = await this.getHospitalSpecialists(organizationName);

            // Count total genes from disease categories
            let totalGenes = 0;
            hospitalCategories.forEach(cat => {
                totalGenes += cat.geneCount || cat.gene_count || 0;
            });

            // Get assessments (if you have an endpoint for this)
            let totalAssessments = 0;
            try {
                const assessments = await this.getRiskAssessmentsByHospital(organizationName);
                totalAssessments = assessments?.length || 0;
            } catch (e) {
                // Assessment endpoint might not exist yet
                totalAssessments = 0;
            }

            return {
                diseaseCount: hospitalCategories.length,
                specialistCount: specialists.length,
                totalGenes: totalGenes,
                totalAssessments: totalAssessments
            };
        } catch (error) {
            console.error('Error fetching hospital admin stats:', error);
            return {
                diseaseCount: 0,
                specialistCount: 0,
                totalGenes: 0,
                totalAssessments: 0
            };
        }
    },

    /**
     * Check if email already exists
     * @param {string} email - Email to check
     * @returns {Promise<boolean>} True if exists
     */
    async checkEmailExists(email) {
        if (!this.config.enabled) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/users/check-email/${encodeURIComponent(email)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to check email');
            }

            const data = await response.json();
            return data.exists || false;
        } catch (error) {
            console.error('Error checking email:', error);
            return false;
        }
    },

    /**
     * Check if license number already exists
     * @param {string} licenseNumber - License number to check
     * @returns {Promise<boolean>} True if exists
     */
    async checkLicenseExists(licenseNumber) {
        if (!this.config.enabled) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/users/check-license/${encodeURIComponent(licenseNumber)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to check license');
            }

            const data = await response.json();
            return data.exists || false;
        } catch (error) {
            console.error('Error checking license:', error);
            return false;
        }
    },

    // ===================================
    // DISEASE BY ORGANIZATION API FUNCTIONS
    // ===================================

    /**
     * Get all diseases created by hospital specialists in a specific organization
     * @param {string} organizationName - The organization name to filter by
     * @returns {Promise<Array>} Array of diseases with creator info
     */
    async getDiseasesByOrganization(organizationName) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty diseases list');
            return [];
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/diseases/by-organization/${encodeURIComponent(organizationName)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch diseases by organization');
            }

            const data = await response.json();
            
            // Normalize the response for frontend use
            const diseases = (data.diseases || []).map(d => ({
                id: d.id,
                diseaseName: d.disease_name,
                diseaseCode: d.disease_code,
                description: d.description,
                constant: d.constant,
                geneSymbols: d.gene_symbols || [],
                geneCount: (d.gene_symbols || []).length,
                creatorFirstName: d.creator_first_name,
                creatorLastName: d.creator_last_name,
                creatorEmail: d.creator_email,
                creatorName: `${d.creator_first_name || ''} ${d.creator_last_name || ''}`.trim() || 'Unknown',
                organizationName: d.organization_name,
                hospitalId: d.hospital_id,
                createdAt: d.created_at,
                updatedAt: d.updated_at
            }));

            return diseases;
        } catch (error) {
            console.error('Error fetching diseases by organization:', error);
            return [];
        }
    },

    /**
     * Search diseases within an organization
     * @param {string} organizationName - The organization name
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Array of matching diseases
     */
    async searchDiseasesByOrganization(organizationName, searchTerm) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty diseases list');
            return [];
        }

        try {
            let url = `${this.config.baseURL}/api/diseases/by-organization/${encodeURIComponent(organizationName)}/search`;
            
            if (searchTerm) {
                url += `?q=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to search diseases');
            }

            const data = await response.json();
            
            // Normalize the response for frontend use
            const diseases = (data.diseases || []).map(d => ({
                id: d.id,
                diseaseName: d.disease_name,
                diseaseCode: d.disease_code,
                description: d.description,
                constant: d.constant,
                geneSymbols: d.gene_symbols || [],
                geneCount: (d.gene_symbols || []).length,
                creatorFirstName: d.creator_first_name,
                creatorLastName: d.creator_last_name,
                creatorEmail: d.creator_email,
                creatorName: `${d.creator_first_name || ''} ${d.creator_last_name || ''}`.trim() || 'Unknown',
                organizationName: d.organization_name,
                hospitalId: d.hospital_id,
                createdAt: d.created_at,
                updatedAt: d.updated_at
            }));

            return diseases;
        } catch (error) {
            console.error('Error searching diseases by organization:', error);
            return [];
        }
    },

    /**
     * Get disease count for a specific hospital specialist
     * @param {string} hospitalId - Hospital specialist user ID
     * @returns {Promise<number>} Disease count
     */
    async getSpecialistDiseaseCount(hospitalId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning 0');
            return 0;
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/diseases/specialist-count/${hospitalId}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch specialist disease count');
            }

            const data = await response.json();
            return data.count || 0;
        } catch (error) {
            console.error('Error fetching specialist disease count:', error);
            return 0;
        }
    },

    /**
     * Get total disease count for an organization
     * @param {string} organizationName - Organization name
     * @returns {Promise<number>} Disease count
     */
    async getOrganizationDiseaseCount(organizationName) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning 0');
            return 0;
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/diseases/organization-count/${encodeURIComponent(organizationName)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch organization disease count');
            }

            const data = await response.json();
            return data.count || 0;
        } catch (error) {
            console.error('Error fetching organization disease count:', error);
            return 0;
        }
    },

    /**
     * Get recently uploaded/updated diseases by organization
     * @param {string} organizationName - Organization name
     * @param {number} days - Number of days to look back (default 3)
     * @returns {Promise<Array>} Array of recent diseases
     */
    async getRecentDiseasesByOrganization(organizationName, days = 3) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty array');
            return [];
        }

        try {
            const url = `${this.config.baseURL}/api/diseases/recent/${encodeURIComponent(organizationName)}?days=${days}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch recent diseases');
            }

            const data = await response.json();
            
            // Normalize the response for frontend use
            const diseases = (data.diseases || []).map(d => ({
                id: d.id,
                diseaseName: d.disease_name,
                diseaseCode: d.disease_code,
                description: d.description,
                constant: d.constant,
                geneSymbols: d.gene_symbols || [],
                geneCount: (d.gene_symbols || []).length,
                creatorFirstName: d.creator_first_name,
                creatorLastName: d.creator_last_name,
                creatorEmail: d.creator_email,
                creatorName: `${d.creator_first_name || ''} ${d.creator_last_name || ''}`.trim() || 'Unknown',
                organizationName: d.organization_name,
                hospitalId: d.hospital_id,
                createdAt: d.created_at,
                updatedAt: d.updated_at
            }));

            return diseases;
        } catch (error) {
            console.error('Error fetching recent diseases:', error);
            return [];
        }
    },

    // ===================================
    // DISEASE MANAGEMENT (Hospital)
    // ===================================

    /**
     * Get all diseases for a hospital
     * @param {string} hospitalId - Hospital ID
     * @returns {Promise<Array>} Array of diseases
     */
    async getDiseases(hospitalId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty diseases');
            return [];
        }

        try {
            const url = hospitalId 
                ? `${this.config.baseURL}/api/diseases?hospital_id=${encodeURIComponent(hospitalId)}`
                : `${this.config.baseURL}/api/diseases`;
                
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get diseases');
            }

            const data = await response.json();
            return data.diseases || [];
        } catch (error) {
            console.error('Error fetching diseases:', error);
            throw error;
        }
    },

    /**
     * Get unique diseases for a hospital
     * @param {string} hospitalId - Hospital ID
     * @returns {Promise<Array>} Array of unique diseases
     */
    async getUniqueDiseases(hospitalId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty diseases');
            return [];
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/diseases/unique?hospital_id=${encodeURIComponent(hospitalId)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to get unique diseases');
            }

            const data = await response.json();
            return data.diseases || [];
        } catch (error) {
            console.error('Error fetching unique diseases:', error);
            throw error;
        }
    },

    /**
     * Search diseases
     * @param {string} hospitalId - Hospital ID
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Array of matching diseases
     */
    async searchDiseases(hospitalId, searchTerm) {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/diseases/search?hospital_id=${encodeURIComponent(hospitalId)}&q=${encodeURIComponent(searchTerm)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to search diseases');
            }

            const data = await response.json();
            return data.diseases || [];
        } catch (error) {
            console.error('Error searching diseases:', error);
            throw error;
        }
    },

    /**
     * Get a single disease by ID
     * @param {string} id - Disease ID
     * @returns {Promise<Object>} Disease
     */
    async getDisease(id) {
        if (!this.config.enabled) {
            throw new Error('Backend disabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/diseases/${id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get disease');
            }

            const data = await response.json();
            return data.disease;
        } catch (error) {
            console.error('Error fetching disease:', error);
            throw error;
        }
    },

    /**
     * Create a new disease
     * @param {Object} data - Disease data
     * @returns {Promise<Object>} Created disease
     */
    async createDisease(data) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping disease creation');
            return { success: false };
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/diseases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create disease');
            }

            const result = await response.json();
            console.log('Disease created:', result);
            return result;
        } catch (error) {
            console.error('Error creating disease:', error);
            throw error;
        }
    },

    /**
     * Update a disease
     * @param {string} id - Disease ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object>} Updated disease
     */
    async updateDisease(id, data) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping disease update');
            return { success: false };
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/diseases/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update disease');
            }

            const result = await response.json();
            console.log('Disease updated:', result);
            return result;
        } catch (error) {
            console.error('Error updating disease:', error);
            throw error;
        }
    },

    /**
     * Delete a disease
     * @param {string} id - Disease ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteDisease(id) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping disease deletion');
            return { success: false };
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/diseases/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete disease');
            }

            const result = await response.json();
            console.log('Disease deleted:', result);
            return result;
        } catch (error) {
            console.error('Error deleting disease:', error);
            throw error;
        }
    },

    /**
     * Upload CSV file with diseases
     * @param {File} file - CSV file
     * @param {string} hospitalId - Hospital ID
     * @returns {Promise<Object>} Upload result with inserted/skipped counts
     */
    async uploadDiseasesCSV(file, hospitalId) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping CSV upload');
            return { success: false };
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('hospital_id', hospitalId);

            const response = await fetch(`${this.config.baseURL}/api/diseases/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload CSV');
            }

            const result = await response.json();
            console.log('CSV upload result:', result);
            return result;
        } catch (error) {
            console.error('Error uploading CSV:', error);
            throw error;
        }
    },

    /**
     * Generate SHA-256 hash preview for a gene symbol (client-side)
     * This is the same algorithm used by the backend
     * @param {string} geneSymbol - Gene symbol to hash
     * @returns {Promise<string>} SHA-256 hash
     */
    async generateHashPreview(geneSymbol) {
        const encoder = new TextEncoder();
        const data = encoder.encode(geneSymbol.toUpperCase());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ===================================
    // RESEARCHER ANALYTICS
    // ===================================

    /**
     * Get disease statistics for researchers (from consented users only)
     * @param {string} searchTerm - Optional search term
     * @returns {Promise<Array>} Array of disease statistics
     */
    async getDiseaseStatistics(searchTerm = '') {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            let url = `${this.config.baseURL}/api/researcher/disease-statistics`;
            if (searchTerm && searchTerm.trim()) {
                url += `?search=${encodeURIComponent(searchTerm.trim())}`;
            }

            const user = this.getCurrentUser();
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'researcher'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch disease statistics');
            }

            const data = await response.json();
            return data.diseases || [];
        } catch (error) {
            console.error('Error fetching disease statistics:', error);
            return [];
        }
    },

    /**
     * Get detailed analytics for a specific disease
     * @param {string} diseaseId - Disease ID
     * @returns {Promise<Object>} Disease analytics
     */
    async getDiseaseAnalytics(diseaseId) {
        if (!this.config.enabled) {
            throw new Error('Backend disabled');
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(
                `${this.config.baseURL}/api/researcher/disease-analytics/${encodeURIComponent(diseaseId)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Role': user?.role || 'researcher'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch disease analytics');
            }

            const data = await response.json();
            return data.analytics;
        } catch (error) {
            console.error('Error fetching disease analytics:', error);
            throw error;
        }
    },

    /**
     * Get recent assessments for researcher dashboard
     * @param {number} limit - Number of assessments to fetch
     * @returns {Promise<Array>} Array of recent assessments
     */
    async getRecentAssessmentsForResearcher(limit = 6) {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(
                `${this.config.baseURL}/api/researcher/recent-assessments?limit=${limit}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Role': user?.role || 'researcher'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch recent assessments');
            }

            const data = await response.json();
            return data.assessments || [];
        } catch (error) {
            console.error('Error fetching recent assessments:', error);
            return [];
        }
    },

    /**
     * Get all assessments from consented users
     * @returns {Promise<Array>} Array of assessments
     */
    async getConsentedAssessments() {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/researcher/consented-assessments`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'researcher'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch consented assessments');
            }

            const data = await response.json();
            return data.assessments || [];
        } catch (error) {
            console.error('Error fetching consented assessments:', error);
            return [];
        }
    },


    // ===================================
    // RESEARCHER DATASETS
    // ===================================
    /**
     * Get anonymized assessments for datasets export
     * Includes date of birth for age grouping but NO personal identifiers
     * @returns {Promise<Array>} Array of anonymized assessments
     */
    async getAnonymizedAssessmentsForDatasets() {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/researcher/datasets/assessments`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch dataset assessments');
            }

            const data = await response.json();
            return data.assessments || [];
        } catch (error) {
            console.error('Error fetching dataset assessments:', error);
            return [];
        }
    },

    /**
     * Get complete disease statistics for datasets export
     * @returns {Promise<Array>} Array of disease statistics with full metrics
     */
    async getCompleteDiseaseStatisticsForDatasets() {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/researcher/datasets/disease-stats`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch disease statistics');
            }

            const data = await response.json();
            return data.diseases || [];
        } catch (error) {
            console.error('Error fetching disease statistics:', error);
            return [];
        }
    },

    /**
     * Get monthly trends for datasets export
     * @returns {Promise<Array>} Array of monthly trend data
     */
    async getMonthlyTrendsForDatasets() {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return [];
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/researcher/datasets/trends`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch trends');
            }

            const data = await response.json();
            return data.trends || [];
        } catch (error) {
            console.error('Error fetching trends:', error);
            return [];
        }
    },

    /**
     * Get aggregate statistics for datasets export
     * @returns {Promise<Object>} Aggregate statistics object
     */
    async getAggregateStatisticsForDatasets() {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return null;
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/researcher/datasets/aggregate-stats`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch aggregate statistics');
            }

            const data = await response.json();
            return data.statistics || null;
        } catch (error) {
            console.error('Error fetching aggregate statistics:', error);
            return null;
        }
    },

    // ===================================
    // AUDIT LOG FUNCTIONS
    // ===================================

    /**
     * Get audit logs with optional filters (system_admin only)
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of audit logs
     */
    async getAuditLogs(filters = {}) {
        if (!this.config.enabled) {
            console.log('Backend disabled, returning empty logs');
            return [];
        }

        try {
            let url = `${this.config.baseURL}/api/audit-logs`;
            const params = new URLSearchParams();

            if (filters.userEmail) params.append('userEmail', filters.userEmail);
            if (filters.userId) params.append('userId', filters.userId);
            if (filters.userRole) params.append('userRole', filters.userRole);
            if (filters.action) params.append('action', filters.action);
            if (filters.resourceType) params.append('resourceType', filters.resourceType);
            if (filters.status) params.append('status', filters.status);
            if (filters.severity) params.append('severity', filters.severity);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.limit) params.append('limit', filters.limit);
            if (filters.offset) params.append('offset', filters.offset);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const user = this.getCurrentUser();
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Audit logs API error:', errorData);
                throw new Error(errorData.error || 'Failed to fetch audit logs');
            }

            const data = await response.json();
            
            // Map backend to frontend
            const logs = (data.logs || []).map(log => ({
                id: log.id,
                timestamp: log.timestamp,
                userId: log.user_id,
                userEmail: log.user_email,
                userRole: log.user_role,
                action: log.action,
                resourceType: log.resource_type,
                resourceId: log.resource_id,
                ipAddress: log.ip_address,
                userAgent: log.user_agent,
                status: log.status,
                severity: log.severity,
                details: typeof log.details === 'object' ? JSON.stringify(log.details) : log.details,
                sessionId: log.session_id,
                createdAt: log.created_at
            }));
            
            return logs;
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            return [];
        }
    },

    /**
     * Get audit log statistics (system_admin only)
     * @returns {Promise<Object>} Statistics object
     */
    async getAuditStatistics() {
        if (!this.config.enabled) {
            console.log('Backend disabled');
            return null;
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/audit-logs/statistics`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': this.getCurrentUser()?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch audit statistics');
            }

            const data = await response.json();
            return data.statistics;
        } catch (error) {
            console.error('Error fetching audit statistics:', error);
            return null;
        }
    },

    /**
     * Create an audit log entry
     * @param {Object} logData - Log data
     * @returns {Promise<Object>} Created log
     */
    async createAuditLog(logData) {
        if (!this.config.enabled) {
            console.log('Backend disabled, skipping audit log');
            return null;
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/audit-logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData)
            });

            if (!response.ok) {
                throw new Error('Failed to create audit log');
            }

            const data = await response.json();
            return data.log;
        } catch (error) {
            console.error('Error creating audit log:', error);
            return null;
        }
    },

    /**
     * Get audit logs for a specific user
     * @param {string} userId - User ID
     * @param {number} limit - Maximum number of logs
     * @returns {Promise<Array>} Array of audit logs
     */
    async getAuditLogsByUser(userId, limit = 50) {
        if (!this.config.enabled) {
            return [];
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/audit-logs/user/${encodeURIComponent(userId)}?limit=${limit}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Role': this.getCurrentUser()?.role || 'system_admin'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch user audit logs');
            }

            const data = await response.json();
            return data.logs || [];
        } catch (error) {
            console.error('Error fetching user audit logs:', error);
            return [];
        }
    },

    /**
     * Delete old audit logs (retention policy)
     * @param {number} daysToKeep - Number of days to retain
     * @returns {Promise<Object>} Deletion result
     */
    async cleanupAuditLogs(daysToKeep = 90) {
        if (!this.config.enabled) {
            return { success: false };
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/audit-logs/cleanup?days=${daysToKeep}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Role': this.getCurrentUser()?.role || 'system_admin'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to cleanup audit logs');
            }

            return await response.json();
        } catch (error) {
            console.error('Error cleaning up audit logs:', error);
            return { success: false, error: error.message };
        }
    },

    // ===================================
    // ORGANIZATION MANAGEMENT
    // ===================================

    /**
     * Get pending organization registrations
     * @returns {Promise<Array>} Array of pending registrations
     */
    async getPendingOrganizations() {
        if (!this.config.enabled) {
            console.log('Backend disabled, falling back to localStorage');
            const users = Storage.get('users') || [];
            return users.filter(u =>
                (u.role === 'admin' || u.role === 'hospital' || u.role === 'doctor' || u.role === 'hospital_admin') &&
                u.status === 'pending_approval'
            );
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/pending`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch pending organizations');
            }

            const data = await response.json();
            return data.registrations || [];
        } catch (error) {
            console.error('Error fetching pending organizations:', error);
            return [];
        }
    },

    /**
     * Get all active organizations
     * @returns {Promise<Array>} Array of organizations
     */
    async getActiveOrganizations() {
        if (!this.config.enabled) {
            console.log('Backend disabled, falling back to localStorage');
            const users = Storage.get('users') || [];
            
            // Group by organization
            const orgsMap = {};
            users.filter(u => 
                (u.role === 'admin' || u.role === 'hospital' || u.role === 'doctor' || u.role === 'hospital_admin') && 
                u.status === 'active'
            ).forEach(u => {
                const orgName = u.organization || u.organizationName || 'Unknown';
                if (!orgsMap[orgName]) {
                    orgsMap[orgName] = {
                        name: orgName,
                        type: u.role === 'hospital' ? 'Hospital' : 'Organization',
                        adminEmail: u.email,
                        userCount: 0,
                        joinedDate: u.createdAt
                    };
                }
                orgsMap[orgName].userCount++;
            });
            
            return Object.values(orgsMap);
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch organizations');
            }

            const data = await response.json();
            return data.organizations || [];
        } catch (error) {
            console.error('Error fetching organizations:', error);
            return [];
        }
    },

    /**
     * Get organization statistics
     * @returns {Promise<Object>} Organization statistics
     */
    async getOrganizationStatistics() {
        if (!this.config.enabled) {
            return null;
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/statistics`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch organization statistics');
            }

            const data = await response.json();
            return data.statistics || null;
        } catch (error) {
            console.error('Error fetching organization statistics:', error);
            return null;
        }
    },

    /**
     * Get organization details by name
     * @param {string} orgName - Organization name
     * @returns {Promise<Object>} Organization details
     */
    async getOrganizationByName(orgName) {
        if (!this.config.enabled) {
            return null;
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/${encodeURIComponent(orgName)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error('Failed to fetch organization');
            }

            const data = await response.json();
            return data.organization || null;
        } catch (error) {
            console.error('Error fetching organization:', error);
            return null;
        }
    },

    /**
     * Approve an organization registration
     * @param {string} userId - User ID to approve
     * @returns {Promise<Object>} Approved user
     */
    async approveOrganization(userId) {
        if (!this.config.enabled) {
            // Fallback to localStorage
            const users = Storage.get('users') || [];
            const user = users.find(u => u.id === userId);
            if (user) {
                user.status = 'active';
                Storage.set('users', users);
            }
            return user;
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/approve/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to approve organization');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error approving organization:', error);
            throw error;
        }
    },

    /**
     * Reject an organization registration
     * @param {string} userId - User ID to reject
     * @returns {Promise<boolean>} Success status
     */
    async rejectOrganization(userId) {
        if (!this.config.enabled) {
            // Fallback to localStorage
            Storage.deleteUser(userId);
            return true;
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/reject/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to reject organization');
            }

            return true;
        } catch (error) {
            console.error('Error rejecting organization:', error);
            throw error;
        }
    },

    /**
     * Suspend an organization (all members)
     * @param {string} orgName - Organization name
     * @returns {Promise<Object>} Result with users affected count
     */
    async suspendOrganization(orgName) {
        if (!this.config.enabled) {
            return { success: false };
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/${encodeURIComponent(orgName)}/suspend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to suspend organization');
            }

            return await response.json();
        } catch (error) {
            console.error('Error suspending organization:', error);
            throw error;
        }
    },

    /**
     * Activate an organization (all members)
     * @param {string} orgName - Organization name
     * @returns {Promise<Object>} Result with users affected count
     */
    async activateOrganization(orgName) {
        if (!this.config.enabled) {
            return { success: false };
        }

        try {
            const user = this.getCurrentUser();
            const response = await fetch(`${this.config.baseURL}/api/organizations/${encodeURIComponent(orgName)}/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role': user?.role || 'system_admin'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to activate organization');
            }

            return await response.json();
        } catch (error) {
            console.error('Error activating organization:', error);
            throw error;
        }
    },

    // ===================================
    // CAREGIVER ACCESS METHODS
    // ===================================

    /**
     * Check if a caregiver exists by email
     * @param {string} email - Caregiver's email
     * @returns {Promise<Object>} Result with caregiver info if found
     */
    async checkCaregiverByEmail(email) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/caregiver-access/check-caregiver?email=${encodeURIComponent(email)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    found: false,
                    message: data.message || 'Caregiver not found'
                };
            }

            return data;
        } catch (error) {
            console.error('Error checking caregiver:', error);
            throw error;
        }
    },

    /**
     * Send caregiver invitation (patient invites caregiver)
     * @param {Object} data - { patientId, caregiverEmail, relationship }
     * @returns {Promise<Object>} Created access record
     */
    async inviteCaregiver(data) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/caregiver-access/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || 'Failed to send invitation');
            }

            return result;
        } catch (error) {
            console.error('Error inviting caregiver:', error);
            throw error;
        }
    },

    /**
     * Get all caregivers for a patient
     * @param {string} patientId - Patient's ID
     * @param {string} [status] - Optional filter by status (active, pending, revoked)
     * @returns {Promise<Object>} Caregivers list and counts
     */
    async getCaregiversForPatient(patientId, status = null) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            let url = `${this.config.baseURL}/api/caregiver-access/patient/${patientId}`;
            if (status) {
                url += `?status=${status}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch caregivers');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching caregivers for patient:', error);
            throw error;
        }
    },

    /**
     * Get all patients for a caregiver
     * @param {string} caregiverId - Caregiver's ID
     * @param {string} [status] - Optional filter by status (active, pending)
     * @returns {Promise<Object>} Patients list and counts
     */
    async getPatientsForCaregiver(caregiverId, status = null) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            let url = `${this.config.baseURL}/api/caregiver-access/caregiver/${caregiverId}`;
            if (status) {
                url += `?status=${status}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch patients');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching patients for caregiver:', error);
            throw error;
        }
    },

    /**
     * Accept a caregiver invitation
     * @param {string} accessId - Access record ID
     * @param {string} caregiverId - Caregiver's ID
     * @returns {Promise<Object>} Updated access record
     */
    async acceptCaregiverInvitation(accessId, caregiverId) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/caregiver-access/${accessId}/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ caregiverId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to accept invitation');
            }

            return result;
        } catch (error) {
            console.error('Error accepting invitation:', error);
            throw error;
        }
    },

    /**
     * Decline a caregiver invitation
     * @param {string} accessId - Access record ID
     * @param {string} caregiverId - Caregiver's ID
     * @returns {Promise<Object>} Updated access record
     */
    async declineCaregiverInvitation(accessId, caregiverId) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/caregiver-access/${accessId}/decline`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ caregiverId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to decline invitation');
            }

            return result;
        } catch (error) {
            console.error('Error declining invitation:', error);
            throw error;
        }
    },

    /**
     * Revoke caregiver access (patient revokes)
     * @param {string} accessId - Access record ID
     * @param {string} patientId - Patient's ID
     * @returns {Promise<Object>} Updated access record
     */
    async revokeCaregiverAccess(accessId, patientId) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/caregiver-access/${accessId}/revoke`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ patientId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to revoke access');
            }

            return result;
        } catch (error) {
            console.error('Error revoking access:', error);
            throw error;
        }
    },

    /**
     * Cancel a pending invitation (patient cancels)
     * @param {string} accessId - Access record ID
     * @param {string} patientId - Patient's ID
     * @returns {Promise<Object>} Result
     */
    async cancelCaregiverInvitation(accessId, patientId) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(`${this.config.baseURL}/api/caregiver-access/${accessId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ patientId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to cancel invitation');
            }

            return result;
        } catch (error) {
            console.error('Error cancelling invitation:', error);
            throw error;
        }
    },

    /**
     * Get patient's risk assessments (for caregiver view)
     * @param {string} patientId - Patient's ID
     * @param {string} caregiverId - Caregiver's ID (for access verification)
     * @returns {Promise<Object>} Assessments list
     */
    async getPatientAssessmentsForCaregiver(patientId, caregiverId) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/caregiver-access/patient/${patientId}/assessments?caregiverId=${caregiverId}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch assessments');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching patient assessments:', error);
            throw error;
        }
    },

    /**
     * Get comprehensive patient data for caregiver view
     * Includes patient info, access record, assessments, and disease reference
     * @param {string} patientId - Patient's ID
     * @param {string} caregiverId - Caregiver's ID (for access verification)
     * @returns {Promise<Object>} Full patient view data
     */
    async getPatientFullView(patientId, caregiverId) {
        if (!this.config.enabled) {
            throw new Error('Backend not enabled');
        }

        try {
            const response = await fetch(
                `${this.config.baseURL}/api/caregiver-access/patient/${patientId}/full-view?caregiverId=${caregiverId}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch patient data');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching patient full view:', error);
            throw error;
        }
    },

    /**
     * Caregiver runs risk assessment on behalf of patient
     */
    async caregiverRunAssessment(patientId, diseaseId, matchCount, matchedGenes, riskPercentage) {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }

        const response = await fetch(`${this.config.baseURL}/api/caregiver/run-assessment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Role': user.role,
                'X-User-Id': user.id
            },
            body: JSON.stringify({
                patientId,
                diseaseId,
                matchCount,
                matchedGenes,
                riskPercentage
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to run assessment for patient');
        }

        return await response.json();
    },

    /**
     * Verify caregiver has active access to patient
     */
    async verifyCaregiverAccess(patientId) {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }

        const response = await fetch(`${this.config.baseURL}/api/caregiver/verify-access/${patientId}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-Role': user.role,
                'X-User-Id': user.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to verify access');
        }

        return await response.json();
    },

    async updateCaregiverAssessmentPermission(accessId, canRunAssessments) {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }

        const response = await fetch(`${this.config.baseURL}/api/caregiver-access/${accessId}/assessment-permission`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Role': user.role,
                'X-User-Id': user.id
            },
            body: JSON.stringify({
                canRunAssessments
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update assessment permission');
        }

        return await response.json();
    }

};



// Make it available as both BackendAPI and API for compatibility
window.BackendAPI = BackendAPI;
window.API = BackendAPI;