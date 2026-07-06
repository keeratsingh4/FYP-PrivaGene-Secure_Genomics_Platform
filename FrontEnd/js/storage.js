// NOTE: 
// This file is only in case backend database fails
// If backend fails, it will fall back to this localStorage

// ===================================
// PRIVAGENE - STORAGE UTILITIES
// LocalStorage wrapper for mock database
// ===================================

/*
const Storage = {
    // Initialize default data structure
    init() {
        if (!this.get('privagene_initialized')) {
            // Initialize with default data
            this.set('users', []);
            this.set('appointments', []);
            this.set('gene_uploads', []);
            this.set('risk_assessments', []);
            this.set('organizations', []);
            this.set('genes_database', []);
            this.set('disease_categories', []);
            this.set('analytics_data', []);
            this.set('privagene_initialized', true);

            // Add some default test users for development
            this.addDefaultUsers();
        }
    },

    // Generic get/set operations
    get(key) {
        const data = localStorage.getItem(`privagene_${key}`);
        return data ? JSON.parse(data) : null;
    },

    set(key, value) {
        localStorage.setItem(`privagene_${key}`, JSON.stringify(value));
    },

    remove(key) {
        localStorage.removeItem(`privagene_${key}`);
    },

    clear() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('privagene_')) {
                localStorage.removeItem(key);
            }
        });
    },

    // User operations
    addUser(user) {
        const users = this.get('users') || [];
        const newUser = {
            id: this.generateId(),
            ...user,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        users.push(newUser);
        this.set('users', users);
        return newUser;
    },

    getUser(email) {
        const users = this.get('users') || [];
        return users.find(u => u.email === email);
    },

    getUserById(id) {
        const users = this.get('users') || [];
        return users.find(u => u.id === id);
    },

    updateUser(id, updates) {
        const users = this.get('users') || [];
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index] = {
                ...users[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.set('users', users);
            return users[index];
        }
        return null;
    },

    deleteUser(id) {
        const users = this.get('users') || [];
        const filtered = users.filter(u => u.id !== id);
        this.set('users', filtered);
    },

    getCurrentUser() {
        const userJson = sessionStorage.getItem('privagene_current_user');
        return userJson ? JSON.parse(userJson) : null;
    },

    // Appointment operations
    addAppointment(appointment) {
        const appointments = this.get('appointments') || [];
        const newAppointment = {
            id: this.generateId(),
            ...appointment,
            createdAt: new Date().toISOString()
        };
        appointments.push(newAppointment);
        this.set('appointments', appointments);
        return newAppointment;
    },

    getAppointments(userId, role) {
        const appointments = this.get('appointments') || [];
        if (role === 'patient') {
            return appointments.filter(a => a.patientId === userId);
        } else if (role === 'hospital') {
            return appointments.filter(a => a.hospitalId === userId);
        }
        return appointments;
    },

    updateAppointment(id, updates) {
        const appointments = this.get('appointments') || [];
        const index = appointments.findIndex(a => a.id === id);
        if (index !== -1) {
            appointments[index] = { ...appointments[index], ...updates };
            this.set('appointments', appointments);
            return appointments[index];
        }
        return null;
    },

    deleteAppointment(id) {
        const appointments = this.get('appointments') || [];
        const filtered = appointments.filter(a => a.id !== id);
        this.set('appointments', filtered);
    },

    // Gene operations
    addGene(gene) {
        const genes = this.get('genes_database') || [];
        const newGene = {
            id: this.generateId(),
            ...gene,
            createdAt: new Date().toISOString()
        };
        genes.push(newGene);
        this.set('genes_database', genes);
        return newGene;
    },

    getGenes() {
        return this.get('genes_database') || [];
    },

    updateGene(id, updates) {
        const genes = this.get('genes_database') || [];
        const index = genes.findIndex(g => g.id === id);
        if (index !== -1) {
            genes[index] = { ...genes[index], ...updates };
            this.set('genes_database', genes);
            return genes[index];
        }
        return null;
    },

    deleteGene(id) {
        const genes = this.get('genes_database') || [];
        const filtered = genes.filter(g => g.id !== id);
        this.set('genes_database', filtered);
    },

    // Gene upload operations (patient files)
    addGeneUpload(upload) {
        const uploads = this.get('gene_uploads') || [];
        const newUpload = {
            id: this.generateId(),
            ...upload,
            uploadedAt: new Date().toISOString()
        };
        uploads.push(newUpload);
        this.set('gene_uploads', uploads);
        return newUpload;
    },

    getGeneUploads(userId) {
        const uploads = this.get('gene_uploads') || [];
        return uploads.filter(u => u.userId === userId);
    },

    // Risk assessment operations
    addRiskAssessment(assessment) {
        const assessments = this.get('risk_assessments') || [];
        const newAssessment = {
            id: this.generateId(),
            ...assessment,
            createdAt: new Date().toISOString()
        };
        assessments.push(newAssessment);
        this.set('risk_assessments', assessments);
        return newAssessment;
    },

    getRiskAssessments(userId) {
        const assessments = this.get('risk_assessments') || [];
        return assessments.filter(a => a.userId === userId);
    },

    updateRiskAssessment(id, updates) {
        const assessments = this.get('risk_assessments') || [];
        const index = assessments.findIndex(a => a.id === id);
        if (index !== -1) {
            assessments[index] = { ...assessments[index], ...updates };
            this.set('risk_assessments', assessments);
            return assessments[index];
        }
        return null;
    },

    // Organization operations
    addOrganization(org) {
        const orgs = this.get('organizations') || [];
        const newOrg = {
            id: this.generateId(),
            ...org,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        orgs.push(newOrg);
        this.set('organizations', orgs);
        return newOrg;
    },

    getOrganizations() {
        return this.get('organizations') || [];
    },

    updateOrganization(id, updates) {
        const orgs = this.get('organizations') || [];
        const index = orgs.findIndex(o => o.id === id);
        if (index !== -1) {
            orgs[index] = { ...orgs[index], ...updates };
            this.set('organizations', orgs);
            return orgs[index];
        }
        return null;
    },

    // Analytics operations
    addAnalyticsData(data) {
        const analytics = this.get('analytics_data') || [];
        analytics.push({
            id: this.generateId(),
            ...data,
            timestamp: new Date().toISOString()
        });
        this.set('analytics_data', analytics);
    },

    getAnalyticsData(filters = {}) {
        let data = this.get('analytics_data') || [];

        // Apply filters
        if (filters.ageMin) {
            data = data.filter(d => d.age >= filters.ageMin);
        }
        if (filters.ageMax) {
            data = data.filter(d => d.age <= filters.ageMax);
        }
        if (filters.oncology) {
            data = data.filter(d => d.categories.includes('oncology'));
        }
        if (filters.dateFrom) {
            data = data.filter(d => new Date(d.timestamp) >= new Date(filters.dateFrom));
        }
        if (filters.dateTo) {
            data = data.filter(d => new Date(d.timestamp) <= new Date(filters.dateTo));
        }

        return data;
    },

    // Helper: Generate unique ID
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Add default test users
    addDefaultUsers() {
        // Only add system admin - all other users must register
        const defaultUsers = [
            {
                email: 'sysadmin@privagene.com',
                password: 'admin123', // In production, this should be hashed!
                role: 'system_admin',
                firstName: 'System',
                lastName: 'Administrator',
                status: 'active'
            }
        ];

        defaultUsers.forEach(user => this.addUser(user));

        // Add some mock genes
        const mockGenes = [
            { name: 'BRCA1', type: 'oncogene', coefficient: 0.85, categories: ['breast_cancer', 'ovarian_cancer'] },
            { name: 'BRCA2', type: 'oncogene', coefficient: 0.80, categories: ['breast_cancer', 'ovarian_cancer'] },
            { name: 'TP53', type: 'tumor_suppressor', coefficient: 0.90, categories: ['li_fraumeni_syndrome'] },
            { name: 'APOE4', type: 'risk_factor', coefficient: 0.65, categories: ['alzheimers'] },
            { name: 'HFE', type: 'mutation', coefficient: 0.70, categories: ['hemochromatosis'] }
        ];

        mockGenes.forEach(gene => this.addGene(gene));

        // Add mock disease categories
        const categories = [
            { id: 'breast_cancer', name: 'Breast Cancer', description: 'Hereditary breast cancer risk' },
            { id: 'ovarian_cancer', name: 'Ovarian Cancer', description: 'Hereditary ovarian cancer risk' },
            { id: 'alzheimers', name: "Alzheimer's Disease", description: 'Late-onset Alzheimer\'s disease risk' },
            { id: 'hemochromatosis', name: 'Hemochromatosis', description: 'Iron overload disorder' },
            { id: 'li_fraumeni_syndrome', name: 'Li-Fraumeni Syndrome', description: 'Multiple cancer risk syndrome' }
        ];

        this.set('disease_categories', categories);
    }
};

// Initialize storage on load
Storage.init();

// Export for use in other scripts
window.Storage = Storage;

*/