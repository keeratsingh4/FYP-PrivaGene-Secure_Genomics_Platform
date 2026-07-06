// ===================================
// PRIVAGENE - CONFIGURATION
// Centralized configuration for the application
// ===================================

// Detect environment and set API URL accordingly
const getBackendURL = () => {
    // If running locally (file:// or localhost), use localhost
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:') {
        return 'http://localhost:3001';
    }
    
    // Production backend URL
    return 'https://fyp-prototype.onrender.com';
};

const Config = {
    // Backend API settings
    backend: {
        enabled: true, // Set to false to use only localStorage (offline mode)
        baseURL: getBackendURL(),
        timeout: 30000 // 30 seconds
    },

    // File upload settings
    upload: {
        maxFileSize: 50 * 1024 * 1024, // 50 MB
        allowedTypes: [
            // Document formats
            'application/pdf',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

            // Text formats
            'text/plain',
            'text/html',
            'application/json',

            // Genetic data formats
            'text/x-vcard', // VCF files
            'application/octet-stream' // Generic binary (for FASTA, etc.)
        ],
        allowedExtensions: [
            '.pdf', '.csv', '.txt', '.json', '.html',
            '.vcf', '.fasta', '.fa', '.fastq', '.fq',
            '.xlsx', '.xls', '.doc', '.docx'
        ]
    },

    // Feature flags
    features: {
        backendIntegration: true,
        offlineMode: false,
        debugMode: false
    },

    // Application metadata
    app: {
        name: 'PrivaGene',
        version: '1.0.0',
        environment: window.location.hostname === 'localhost' ? 'development' : 'production'
    }
};

// Helper function to check if backend is enabled
Config.isBackendEnabled = function () {
    return this.backend.enabled && this.features.backendIntegration;
};

// Helper function to validate file type
Config.isFileTypeAllowed = function (file) {
    // Check file extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const extAllowed = this.upload.allowedExtensions.includes(ext);

    // Check MIME type
    const mimeAllowed = this.upload.allowedTypes.includes(file.type);

    // Allow if either extension or MIME type matches
    return extAllowed || mimeAllowed;
};

// Helper function to validate file size
Config.isFileSizeValid = function (file) {
    return file.size <= this.upload.maxFileSize;
};

// Export for use in other scripts
window.Config = Config;
