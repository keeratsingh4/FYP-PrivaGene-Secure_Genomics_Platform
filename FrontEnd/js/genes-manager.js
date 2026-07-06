/**
 * Gene Manager - Handles gene entry CRUD operations
 * Uses BackendAPI for server communication
 */
class GeneManager {
    constructor(user) {
        this.user = user;
        this.entries = [];
        this.filteredEntries = [];
        this.isLoading = false;
        this.useBackend = true; // Will be set to false if backend is unavailable
    }

    /**
     * Load gene entries from backend (with localStorage fallback)
     */
    async loadData() {
        this.showLoading();

        try {
            // Try backend first
            const backendHealthy = await BackendAPI.checkHealth();
            
            if (backendHealthy) {
                // ✅ CHANGED: Fetch by organization instead of user ID
                this.entries = await BackendAPI.getDiseasesByOrganization(this.user.organization_name);
                this.useBackend = true;
            } else {
                // Fallback to localStorage
                console.log('Backend not available, using localStorage');
                this.entries = this.loadFromStorage();
                this.useBackend = false;
            }
            
            this.filteredEntries = [...this.entries];
            this.renderTable();
            this.updateStats();
            this.hideLoading();
            
            console.log(`Loaded ${this.entries.length} gene entries for organization: ${this.user.organization_name} (backend: ${this.useBackend})`);
        } catch (error) {
            console.error('Error loading gene entries:', error);
            
            // Fallback to localStorage on error
            console.log('Falling back to localStorage');
            this.entries = this.loadFromStorage();
            this.useBackend = false;
            this.filteredEntries = [...this.entries];
            this.renderTable();
            this.updateStats();
            this.hideLoading();
        }
    }

    /**
     * Load entries from localStorage
     */
    loadFromStorage() {
        const stored = localStorage.getItem('diseases_' + this.user.id);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Save entries to localStorage
     */
    saveToStorage() {
        localStorage.setItem('diseases_' + this.user.id, JSON.stringify(this.entries));
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const totalEl = document.getElementById('totalEntries');
        const diseasesEl = document.getElementById('uniqueDiseases');
        const genesEl = document.getElementById('uniqueGenes');

        if (totalEl) totalEl.textContent = this.entries.length;

        // Count unique diseases
        const uniqueDiseases = new Set(this.entries.map(e => e.diseaseCode));
        if (diseasesEl) diseasesEl.textContent = uniqueDiseases.size;

        // Count unique genes (now handling arrays)
        const uniqueGenes = new Set();
        this.entries.forEach(entry => {
            if (entry.geneSymbols && Array.isArray(entry.geneSymbols)) {
                entry.geneSymbols.forEach(symbol => uniqueGenes.add(symbol));
            } else if (entry.geneSymbol) {
                // Fallback for old single gene format
                uniqueGenes.add(entry.geneSymbol);
            }
        });
        if (genesEl) genesEl.textContent = uniqueGenes.size;
    }

    /**
     * Validate constant value
     * @param {number|string} constant - The constant to validate
     * @returns {boolean} - True if valid
     */
    validateConstant(constant) {
        const num = parseFloat(constant);
        return !isNaN(num) && num > 0 && num <= 100;
    }

    /**
     * Add a new gene entry
     * @param {Object} data - Entry data
     * @returns {Promise<Object>} Created entry
     */
    async addEntry(data) {
        try {
            // Parse gene symbols from the input (comma-separated string to array)
            // Handle both gene_symbol (snake_case from form) and geneSymbol (camelCase)
            let geneSymbolsArray = [];
            const geneSymbolInput = data.gene_symbol || data.geneSymbol;
            if (geneSymbolInput) {
                // Split by comma and clean up each symbol
                geneSymbolsArray = geneSymbolInput
                    .split(',')
                    .map(s => s.trim().toUpperCase())
                    .filter(s => s); // Remove empty strings
            }

            if (geneSymbolsArray.length === 0) {
                throw new Error('Please provide at least one gene symbol');
            }

            // Validate constant
            if (!this.validateConstant(data.constant)) {
                throw new Error('Constant must be a number greater than 0 and less than or equal to 100');
            }
            
            if (this.useBackend) {
                

                // Use backend API - handle both naming conventions
                const entryData = {
                    hospital_id: this.user.id,
                    disease_name: data.disease_name || data.diseaseName,
                    disease_code: data.disease_code || data.diseaseCode,
                    gene_symbols: geneSymbolsArray,
                    description: data.description || '',
                    constant: parseFloat(data.constant)
                };
                
                
                console.log('Sending to backend:', entryData);
                
                const result = await BackendAPI.createDisease(entryData);
                
                console.log('Backend response:', result);
                
                // Handle different possible response formats from the backend
                let backendEntry = null;
                
                // Format 1: { success: true, entry: {...} }
                if (result.success && result.entry) {
                    backendEntry = result.entry;
                }
                // Format 2: { success: true, disease: {...} }
                else if (result.success && result.disease) {
                    backendEntry = result.disease;
                }
                // Format 3: Direct entry object with id
                else if (result.id && (result.diseaseName || result.disease_name)) {
                    backendEntry = result;
                }
                // Format 4: { disease: {...} } without success flag
                else if (result.disease && result.disease.id) {
                    backendEntry = result.disease;
                }
                
                // Check if we got a valid entry
                if (!backendEntry || !backendEntry.id) {
                    console.error('Invalid response format:', result);
                    throw new Error('Invalid response from server. Expected entry with id.');
                }
                
                // Transform backend response (snake_case) to frontend format (camelCase)
                const entry = {
                    id: backendEntry.id,
                    diseaseName: backendEntry.disease_name || backendEntry.diseaseName,
                    diseaseCode: backendEntry.disease_code || backendEntry.diseaseCode,
                    geneSymbols: backendEntry.gene_symbols || backendEntry.geneSymbols || [],
                    description: backendEntry.description,
                    constant: backendEntry.constant,
                    hospitalId: backendEntry.hospital_id || backendEntry.hospitalId,
                    createdAt: backendEntry.created_at || backendEntry.createdAt,
                    updatedAt: backendEntry.updated_at || backendEntry.updatedAt
                };
                
                // Success - add to local array and update UI
                this.entries.unshift(entry);
                this.filteredEntries = [...this.entries];
                this.renderTable();
                this.updateStats();
                this.showNotification('Gene entry added successfully', 'success');
                return entry;
                
            } else {
                // Use localStorage fallback
                const now = new Date().toISOString();
                const newEntry = {
                    id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    hospital_id: this.user.id,
                    disease_name: data.disease_name || data.diseaseName,
                    disease_code: data.disease_code || data.diseaseCode,
                    gene_symbols: geneSymbolsArray,
                    description: data.description || '',
                    constant: parseFloat(data.constant),
                    created_at: now,
                    updated_at: now
                };
                
                this.entries.unshift(newEntry);
                this.saveToStorage();
                this.filteredEntries = [...this.entries];
                this.renderTable();
                this.updateStats();
                this.showNotification('Gene entry added (saved locally)', 'success');
                return newEntry;
            }
        } catch (error) {
            console.error('Error adding entry:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            
            // Provide helpful error messages
            let errorMessage = error.message || 'Failed to add entry';
            
            // Check for common errors
            if (error.message && error.message.includes('fetch')) {
                errorMessage = 'Network error: Could not connect to backend server at ' + BackendAPI.config.baseURL;
            } else if (error.message && error.message.includes('JSON')) {
                errorMessage = 'Server returned invalid response format';
            } else if (error.message && error.message.includes('Failed to create disease')) {
                errorMessage = 'Server rejected the request: ' + error.message;
            }
            
            this.showNotification(errorMessage, 'error');
            throw error;
        }
    }

/**
     * Update an existing gene entry
     * @param {string} id - Entry ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object>} Updated entry
     */
    async updateEntry(id, data) {
        try {
            // Parse gene symbols - handle both gene_symbol (from form) and geneSymbol (camelCase)
            let geneSymbolsArray = [];
            const geneSymbolInput = data.gene_symbol || data.geneSymbol;
            if (geneSymbolInput) {
                geneSymbolsArray = geneSymbolInput
                    .split(',')
                    .map(s => s.trim().toUpperCase())
                    .filter(s => s);
            }

            // Validate constant
            if (!this.validateConstant(data.constant)) {
                throw new Error('Constant must be a number greater than 0 and less than or equal to 100');
            }
            
            if (this.useBackend) {
                // Use backend API - backend expects snake_case
                const updateData = {
                    disease_name: data.disease_name || data.diseaseName,
                    disease_code: data.disease_code || data.diseaseCode,
                    gene_symbols: geneSymbolsArray,
                    description: data.description || '',
                    constant: parseFloat(data.constant)
                };

                console.log('Sending update to backend:', updateData);
                
                const result = await BackendAPI.updateDisease(id, updateData);
                
                console.log('Backend update response:', result);
                
                if (result.success && (result.entry || result.disease)) {
                    // Backend returns snake_case, transform to camelCase for frontend consistency
                    const backendEntry = result.entry || result.disease;
                    const entry = {
                        id: backendEntry.id,
                        diseaseName: backendEntry.disease_name,
                        diseaseCode: backendEntry.disease_code,
                        geneSymbols: backendEntry.gene_symbols || [],
                        description: backendEntry.description,
                        constant: backendEntry.constant,
                        hospitalId: backendEntry.hospital_id,
                        createdAt: backendEntry.created_at,
                        updatedAt: backendEntry.updated_at
                    };
                    
                    const index = this.entries.findIndex(e => e.id === id);
                    if (index !== -1) {
                        this.entries[index] = entry;
                    }
                    this.filteredEntries = [...this.entries];
                    this.renderTable();
                    this.updateStats();
                    this.showNotification('Gene entry updated successfully', 'success');
                    return entry;
                }
                
                throw new Error('Failed to update entry');
            } else {
                // Use localStorage fallback
                const index = this.entries.findIndex(e => e.id === id);
                if (index === -1) {
                    throw new Error('Entry not found');
                }
                
                const updatedEntry = {
                    ...this.entries[index],
                    disease_name: data.diseaseName,
                    disease_code: data.diseaseCode,
                    gene_symbols: geneSymbolsArray,
                    description: data.description || '',
                    constant: parseFloat(data.constant),
                    updated_at: new Date().toISOString()
                };
                
                this.entries[index] = updatedEntry;
                this.saveToStorage();
                this.filteredEntries = [...this.entries];
                this.renderTable();
                this.updateStats();
                this.showNotification('Gene entry updated (saved locally)', 'success');
                return updatedEntry;
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            this.showNotification(error.message || 'Failed to update entry', 'error');
            throw error;
        }
    }

    /**
     * Delete a gene entry
     * @param {string} id - Entry ID
     * @returns {Promise<boolean>}
     */
    async deleteEntry(id) {
        try {
            if (this.useBackend) {
                // Use backend API
                const result = await BackendAPI.deleteDisease(id);
                
                if (result.success) {
                    this.entries = this.entries.filter(e => e.id !== id);
                    this.filteredEntries = this.filteredEntries.filter(e => e.id !== id);
                    this.renderTable();
                    this.updateStats();
                    this.showNotification('Gene entry deleted successfully', 'success');
                    return true;
                }
                
                throw new Error('Failed to delete entry');
            } else {
                // Use localStorage fallback
                this.entries = this.entries.filter(e => e.id !== id);
                this.saveToStorage();
                this.filteredEntries = this.filteredEntries.filter(e => e.id !== id);
                this.renderTable();
                this.updateStats();
                this.showNotification('Gene entry deleted (from local storage)', 'success');
                return true;
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            this.showNotification(error.message || 'Failed to delete entry', 'error');
            throw error;
        }
    }

/**
     * Upload CSV file
     * @param {File} file - CSV file
     * @returns {Promise<Object>} Upload result
     */
    async uploadCSV(file) {
        try {
            if (this.useBackend) {
                // Use backend API
                const result = await BackendAPI.uploadDiseasesCSV(file, this.user.id);
                
                if (result.success) {
                    await this.loadData();
                    return result;
                }
                
                throw new Error(result.error || 'Upload failed');
            } else {
                // Process CSV locally
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(line => line.trim());
                
                if (lines.length < 2) {
                    throw new Error('CSV must have header and at least one data row');
                }
                
                // Parse header
                const header = lines[0].split(',').map(h => h.trim().toLowerCase());
                const requiredCols = ['disease_name', 'disease_code', 'gene_symbol', 'constant'];
                const missing = requiredCols.filter(col => !header.includes(col));
                
                if (missing.length > 0) {
                    throw new Error(`Missing required columns: ${missing.join(', ')}`);
                }
                
                // Parse rows
                let inserted = 0;
                let skipped = 0;
                const errors = [];
                
                for (let i = 1; i < lines.length; i++) {
                    const values = this.parseCSVLine(lines[i]);
                    if (values.length === 0) continue;
                    
                    const entry = {};
                    header.forEach((col, idx) => {
                        entry[col] = values[idx] || '';
                    });
                    
                    if (!entry.disease_name || !entry.disease_code || !entry.gene_symbol) {
                        skipped++;
                        errors.push({ reason: `Row ${i}: Missing required fields` });
                        continue;
                    }

                    // Validate constant
                    if (!this.validateConstant(entry.constant)) {
                        skipped++;
                        errors.push({ reason: `Row ${i}: Invalid constant value (must be > 0 and <= 100)` });
                        continue;
                    }
                    
                    // Check for duplicates
                    const geneSymbol = entry.gene_symbol.toUpperCase();
                    const exists = this.entries.some(e => 
                        e.diseaseCode === entry.disease_code && 
                        e.geneSymbols && e.geneSymbols.includes(geneSymbol)
                    );
                    
                    if (exists) {
                        skipped++;
                        errors.push({ reason: `Row ${i}: Duplicate entry ${entry.disease_code}/${geneSymbol}` });
                        continue;
                    }
                    
                    // Create entry
                    const newEntry = {
                        id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        hospital_id: this.user.id,
                        disease_name: entry.disease_name,
                        disease_code: entry.disease_code,
                        gene_symbols: [geneSymbol],
                        description: entry.description || '',
                        constant: parseFloat(entry.constant),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    this.entries.unshift(newEntry);
                    inserted++;
                }
                
                this.saveToStorage();
                this.filteredEntries = [...this.entries];
                this.renderTable();
                this.updateStats();
                
                return {
                    success: true,
                    inserted,
                    skipped,
                    total: lines.length - 1,
                    errors
                };
            }
        } catch (error) {
            console.error('Error uploading CSV:', error);
            throw error;
        }
    }

    /**
     * Parse a CSV line (handles quoted values)
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    /**
     * Search entries locally
     * @param {string} searchTerm - Search term
     */
    searchEntries(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            this.filteredEntries = [...this.entries];
        } else {
            const term = searchTerm.toLowerCase().trim();
            this.filteredEntries = this.entries.filter(entry => {
                const matchDisease = entry.diseaseName.toLowerCase().includes(term) ||
                                    entry.diseaseCode.toLowerCase().includes(term);
                
                const matchDescription = entry.description && 
                                        entry.description.toLowerCase().includes(term);
                
                // Check gene symbols (handle both array and single formats)
                let matchGene = false;
                if (entry.geneSymbols && Array.isArray(entry.geneSymbols)) {
                    matchGene = entry.geneSymbols.some(symbol => 
                        symbol.toLowerCase().includes(term)
                    );
                } else if (entry.geneSymbol) {
                    matchGene = entry.geneSymbol.toLowerCase().includes(term);
                }

                // Check constant
                const matchConstant = entry.constant && 
                                     entry.constant.toString().includes(term);
                
                return matchDisease || matchGene || matchDescription || matchConstant;
            });
        }
        
        this.renderTable();
    }

    /**
     * Get entry by ID
     * @param {string} id - Entry ID
     * @returns {Object|null} Entry or null
     */
    getEntryById(id) {
        return this.entries.find(e => e.id === id) || null;
    }

    /**
     * Render the entries table
     */
    renderTable() {
        const tableContainer = document.getElementById('tableContainer');
        const tableBody = document.getElementById('geneTableBody');
        const emptyState = document.getElementById('emptyState');

        if (!tableContainer || !tableBody || !emptyState) return;

        if (this.filteredEntries.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        tableBody.innerHTML = this.filteredEntries.map(entry => {
            // Handle both array and single gene formats
            let geneSymbolsDisplay = '';
            if (entry.geneSymbols && Array.isArray(entry.geneSymbols)) {
                geneSymbolsDisplay = entry.geneSymbols.map(symbol => 
                    `<span class="gene-tag">${this.escapeHtml(symbol)}</span>`
                ).join(' ');
            } else if (entry.geneSymbol) {
                // Fallback for old format
                geneSymbolsDisplay = `<span class="gene-tag">${this.escapeHtml(entry.geneSymbol)}</span>`;
            }

            // Format constant display
            const constantDisplay = entry.constant !== undefined && entry.constant !== null
                ? `<span style="font-weight: 500; color: var(--primary-color);">${parseFloat(entry.constant).toFixed(2)}%</span>`
                : '<em style="color: var(--text-tertiary);">N/A</em>';

            return `
                <tr>
                    <td><strong>${this.escapeHtml(entry.diseaseName)}</strong></td>
                    <td><code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">${this.escapeHtml(entry.diseaseCode)}</code></td>
                    <td style="max-width: 300px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${geneSymbolsDisplay}
                        </div>
                    </td>
                    <td>${constantDisplay}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(entry.description || '')}">
                        ${this.escapeHtml(entry.description) || '<em style="color: var(--text-tertiary);">No description</em>'}
                    </td>
                    <td style="white-space: nowrap;">${this.formatDate(entry.createdAt)}</td>
                    <td>
                        <div class="action-buttons">
                            <button onclick="modalManager.openGeneModal('${entry.id}')" 
                                    class="btn btn-small btn-outline" title="Edit">
                                ✏️
                            </button>
                            <button onclick="modalManager.openDeleteModal('${entry.id}')" 
                                    class="btn btn-small btn-danger" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tableContainer.style.display = 'block';
        emptyState.style.display = 'none';
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;
        const spinner = document.getElementById('loadingSpinner');
        const tableContainer = document.getElementById('tableContainer');
        const emptyState = document.getElementById('emptyState');

        if (spinner) spinner.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.isLoading = false;
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.style.display = 'none';
    }

    /**
     * Show notification toast
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        // Use UI utility if available, otherwise create simple notification
        if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert(message, type);
            return;
        }

        // Fallback notification
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 14px 24px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            font-weight: 500;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(20px)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export globally
window.GeneManager = GeneManager;