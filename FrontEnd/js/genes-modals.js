/**
 * Modal Manager - Handles all modal interactions for gene management
 */
class ModalManager {
    constructor(geneManager) {
        this.geneManager = geneManager;
        this.selectedFile = null;
        this.deleteEntryId = null;
        
        this.initializeEventListeners();
    }

    /**
     * Initialize all modal event listeners
     */
    initializeEventListeners() {
        // Gene Modal
        this.setupGeneModal();
        
        // Upload Modal
        this.setupUploadModal();
        
        // Delete Modal
        this.setupDeleteModal();
        
        // Close modals on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Close modals on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    /**
     * Setup Gene Modal (Add/Edit)
     */
    setupGeneModal() {
        const modal = document.getElementById('geneModal');
        const form = document.getElementById('geneForm');
        const closeBtn = document.getElementById('closeGeneModal');
        const cancelBtn = document.getElementById('cancelGeneBtn');
        const geneSymbolInput = document.getElementById('geneSymbolInput');

        // Close handlers
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeGeneModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeGeneModal());

        // Form submission
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleGeneFormSubmit();
            });
        }

        // Real-time hash preview
        if (geneSymbolInput) {
            geneSymbolInput.addEventListener('input', async (e) => {
                const symbol = e.target.value.trim();
                await this.updateHashPreview(symbol);
            });
        }
    }

    /**
     * Setup Upload Modal
     */
    setupUploadModal() {
        const dropZone = document.getElementById('fileDropZone');
        const fileInput = document.getElementById('csvFileInput');
        const closeBtn = document.getElementById('closeUploadModal');
        const cancelBtn = document.getElementById('cancelUploadBtn');
        const processBtn = document.getElementById('processUploadBtn');
        const clearFileBtn = document.getElementById('clearFileBtn');

        // Close handlers
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeUploadModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeUploadModal());

        // File drop zone
        if (dropZone) {
            dropZone.addEventListener('click', () => fileInput?.click());
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelection(files[0]);
                }
            });
        }

        // File input change
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelection(e.target.files[0]);
                }
            });
        }

        // Clear file
        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', () => this.clearSelectedFile());
        }

        // Process upload
        if (processBtn) {
            processBtn.addEventListener('click', () => this.handleCSVUpload());
        }
    }

    /**
     * Setup Delete Confirmation Modal
     */
    setupDeleteModal() {
        const closeBtn = document.getElementById('closeDeleteModal');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        const confirmBtn = document.getElementById('confirmDeleteBtn');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDeleteModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeDeleteModal());
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.handleDeleteConfirm());
    }

    /**
     * Open gene modal for add/edit
     * @param {string|null} entryId - Entry ID for edit, null for new
     */
    openGeneModal(entryId = null) {
        const modal = document.getElementById('geneModal');
        const title = document.getElementById('geneModalTitle');
        const editIdInput = document.getElementById('editGeneId');
        const saveText = document.getElementById('saveGeneText');

        // Reset form
        document.getElementById('geneForm').reset();
        document.getElementById('hashPreview').innerHTML = '<em style="color: var(--text-tertiary);">Enter gene symbols to see their hashes</em>';

        if (entryId) {
            // Edit mode
            const entry = this.geneManager.getEntryById(entryId);
            if (!entry) {
                this.geneManager.showNotification('Entry not found', 'error');
                return;
            }

            title.textContent = 'Edit Disease';
            saveText.textContent = 'Update Entry';
            editIdInput.value = entryId;

            // Populate form
            // NOTE: api-backend.js transforms snake_case to camelCase
            document.getElementById('diseaseNameInput').value = entry.diseaseName || entry.disease_name || '';
            document.getElementById('diseaseCodeInput').value = entry.diseaseCode || entry.disease_code || '';
            
            // Handle gene symbols - convert array to comma-separated string
            let geneSymbolsStr = '';
            if (entry.geneSymbols && Array.isArray(entry.geneSymbols)) {
                geneSymbolsStr = entry.geneSymbols.join(', ');
            } else if (entry.gene_symbols && Array.isArray(entry.gene_symbols)) {
                // Fallback for snake_case format
                geneSymbolsStr = entry.gene_symbols.join(', ');
            } else if (entry.geneSymbol) {
                // Fallback for old single gene format (camelCase)
                geneSymbolsStr = entry.geneSymbol;
            } else if (entry.gene_symbol) {
                // Fallback for old single gene format (snake_case)
                geneSymbolsStr = entry.gene_symbol;
            }
            document.getElementById('geneSymbolInput').value = geneSymbolsStr;
            
            document.getElementById('descriptionInput').value = entry.description || '';
            
            // Populate constant field
            const constantInput = document.getElementById('constantInput');
            if (constantInput) {
                constantInput.value = entry.constant !== undefined ? entry.constant : '';
            }

            // Update hash preview
            this.updateHashPreview(geneSymbolsStr);
        } else {
            // Add mode
            title.textContent = 'Add Disease';
            saveText.textContent = 'Save Entry';
            editIdInput.value = '';
        }

        modal.style.display = 'flex';
    }

    /**
     * Close gene modal
     */
    closeGeneModal() {
        const modal = document.getElementById('geneModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Handle gene form submission
     */
    async handleGeneFormSubmit() {
        const editId = document.getElementById('editGeneId').value;
        const saveBtn = document.getElementById('saveGeneBtn');
        const saveText = document.getElementById('saveGeneText');
        const saveSpinner = document.getElementById('saveGeneSpinner');

        // Get form values
        const data = {
            disease_name: document.getElementById('diseaseNameInput').value.trim(),
            disease_code: document.getElementById('diseaseCodeInput').value.trim(),
            gene_symbol: document.getElementById('geneSymbolInput').value.trim(),
            description: document.getElementById('descriptionInput').value.trim(),
            constant: document.getElementById('constantInput').value.trim()
        };

        // Validation
        if (!data.disease_name || !data.disease_code || !data.gene_symbol) {
            this.geneManager.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Validate constant
        if (!data.constant) {
            this.geneManager.showNotification('Please enter a constant value', 'error');
            return;
        }

        const constantNum = parseFloat(data.constant);
        if (isNaN(constantNum) || constantNum <= 0 || constantNum > 100) {
            this.geneManager.showNotification('Constant must be a number greater than 0 and less than or equal to 100', 'error');
            return;
        }

        // Show loading
        saveBtn.disabled = true;
        saveText.style.display = 'none';
        saveSpinner.style.display = 'inline-block';

        try {
            if (editId) {
                await this.geneManager.updateEntry(editId, data);
            } else {
                await this.geneManager.addEntry(data);
            }
            
            // Success - close the modal
            const modal = document.getElementById('geneModal');
            if (modal) {
                modal.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Form submit error:', error);
            // Keep modal open on error so user can fix the issue
            this.geneManager.showNotification(error.message || 'Failed to save entry', 'error');
        } finally {
            // Always re-enable the button
            saveBtn.disabled = false;
            saveText.style.display = 'inline';
            saveSpinner.style.display = 'none';
        }
    }

    /**
     * Update hash preview for multiple gene symbols
     * @param {string} geneSymbolsStr - Comma-separated gene symbols
     */
    async updateHashPreview(geneSymbolsStr) {
        const preview = document.getElementById('hashPreview');
        if (!preview) return;

        if (!geneSymbolsStr || geneSymbolsStr.trim() === '') {
            preview.innerHTML = '<em style="color: var(--text-tertiary);">Enter gene symbols to see their hashes</em>';
            return;
        }

        try {
            // Split and clean gene symbols
            const symbols = geneSymbolsStr
                .split(',')
                .map(s => s.trim().toUpperCase())
                .filter(s => s);

            if (symbols.length === 0) {
                preview.innerHTML = '<em style="color: var(--text-tertiary);">Enter gene symbols to see their hashes</em>';
                return;
            }

            // Generate hashes for all symbols
            const hashPromises = symbols.map(async symbol => {
                const hash = await BackendAPI.generateHashPreview(symbol);
                return { symbol, hash };
            });

            const results = await Promise.all(hashPromises);

            // Display all hashes
            preview.innerHTML = `
                <div style="max-height: 150px; overflow-y: auto;">
                    ${results.map(({ symbol, hash }) => `
                        <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 4px;">
                                ${symbol}
                            </div>
                            <div style="word-break: break-all; font-size: 11px; color: var(--text-secondary);">
                                ${hash}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: var(--text-tertiary);">
                    ${symbols.length} gene symbol${symbols.length > 1 ? 's' : ''} will be added
                </div>
            `;
        } catch (error) {
            preview.innerHTML = '<em style="color: var(--error-color);">Error generating hashes</em>';
        }
    }

    /**
     * Open upload modal
     */
    openUploadModal() {
        const modal = document.getElementById('uploadModal');
        
        // Reset state
        this.clearSelectedFile();
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadSummary').style.display = 'none';
        
        modal.style.display = 'flex';
    }

    /**
     * Close upload modal
     */
    closeUploadModal() {
        const modal = document.getElementById('uploadModal');
        if (modal) modal.style.display = 'none';
        this.clearSelectedFile();
    }

    /**
     * Handle file selection
     * @param {File} file - Selected file
     */
    handleFileSelection(file) {
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.geneManager.showNotification('Please select a CSV file', 'error');
            return;
        }

        this.selectedFile = file;

        // Update UI
        const fileInfo = document.getElementById('selectedFileInfo');
        const fileName = document.getElementById('selectedFileName');
        const fileSize = document.getElementById('selectedFileSize');
        const dropZone = document.getElementById('fileDropZone');
        const processBtn = document.getElementById('processUploadBtn');

        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
        if (fileInfo) fileInfo.style.display = 'flex';
        if (dropZone) dropZone.style.display = 'none';
        if (processBtn) processBtn.disabled = false;

        // Reset summary if visible
        document.getElementById('uploadSummary').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'none';
    }

    /**
     * Clear selected file
     */
    clearSelectedFile() {
        this.selectedFile = null;

        const fileInfo = document.getElementById('selectedFileInfo');
        const dropZone = document.getElementById('fileDropZone');
        const processBtn = document.getElementById('processUploadBtn');
        const fileInput = document.getElementById('csvFileInput');

        if (fileInfo) fileInfo.style.display = 'none';
        if (dropZone) dropZone.style.display = 'block';
        if (processBtn) processBtn.disabled = true;
        if (fileInput) fileInput.value = '';
    }

    /**
     * Handle CSV upload
     */
    async handleCSVUpload() {
        if (!this.selectedFile) {
            this.geneManager.showNotification('Please select a file first', 'error');
            return;
        }

        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        const statusText = document.getElementById('uploadStatusText');
        const summaryDiv = document.getElementById('uploadSummary');
        const processBtn = document.getElementById('processUploadBtn');
        const uploadBtnText = document.getElementById('uploadBtnText');
        const uploadBtnSpinner = document.getElementById('uploadBtnSpinner');

        // Show progress
        progressDiv.style.display = 'block';
        summaryDiv.style.display = 'none';
        processBtn.disabled = true;
        uploadBtnText.style.display = 'none';
        uploadBtnSpinner.style.display = 'inline-block';

        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 10, 90);
            progressBar.style.width = `${progress}%`;
        }, 200);

        try {
            statusText.textContent = 'Processing CSV file...';
            
            const result = await this.geneManager.uploadCSV(this.selectedFile);
            
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            
            // Show summary
            setTimeout(() => {
                progressDiv.style.display = 'none';
                summaryDiv.style.display = 'block';
                
                document.getElementById('insertedCount').textContent = result.inserted || 0;
                document.getElementById('skippedCount').textContent = result.skipped || 0;
                
                // Show errors if any
                const errorsDiv = document.getElementById('uploadErrors');
                if (result.errors && result.errors.length > 0) {
                    errorsDiv.innerHTML = `
                        <div style="font-weight: 500; margin-bottom: 8px; color: var(--warning-color);">Issues:</div>
                        ${result.errors.slice(0, 5).map(err => `
                            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">
                                • ${this.escapeHtml(err.reason || 'Unknown error')}
                            </div>
                        `).join('')}
                        ${result.errors.length > 5 ? `<div style="font-size: 12px; color: var(--text-tertiary);">...and ${result.errors.length - 5} more</div>` : ''}
                    `;
                    errorsDiv.style.display = 'block';
                } else {
                    errorsDiv.style.display = 'none';
                }
                
                if (result.inserted > 0) {
                    this.geneManager.showNotification(`Successfully imported ${result.inserted} gene entries`, 'success');
                }
            }, 500);
            
        } catch (error) {
            clearInterval(progressInterval);
            console.error('Upload error:', error);
            this.geneManager.showNotification(error.message || 'Upload failed', 'error');
            progressDiv.style.display = 'none';
        } finally {
            processBtn.disabled = false;
            uploadBtnText.style.display = 'inline';
            uploadBtnSpinner.style.display = 'none';
        }
    }

    /**
     * Open delete confirmation modal
     * @param {string} entryId - Entry ID to delete
     */
    openDeleteModal(entryId) {
        const modal = document.getElementById('deleteModal');
        const infoDiv = document.getElementById('deleteEntryInfo');

        const entry = this.geneManager.getEntryById(entryId);
        if (!entry) {
            this.geneManager.showNotification('Entry not found', 'error');
            return;
        }

        this.deleteEntryId = entryId;

        // Handle gene symbols display
        let geneDisplay = '';
        if (entry.gene_symbols && Array.isArray(entry.gene_symbols)) {
            geneDisplay = entry.gene_symbols.map(s => `<span class="gene-tag">${this.escapeHtml(s)}</span>`).join(' ');
        } else if (entry.gene_symbol) {
            geneDisplay = `<span class="gene-tag">${this.escapeHtml(entry.gene_symbol)}</span>`;
        }

        // Show entry info including constant
        infoDiv.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>Disease:</strong> ${this.escapeHtml(entry.disease_name)}
            </div>
            <div style="margin-bottom: 8px;">
                <strong>Code:</strong> <code>${this.escapeHtml(entry.disease_code)}</code>
            </div>
            <div style="margin-bottom: 8px;">
                <strong>Genes:</strong> ${geneDisplay}
            </div>
            <div>
                <strong>Constant:</strong> ${entry.constant !== undefined ? entry.constant + '%' : 'N/A'}
            </div>
        `;

        modal.style.display = 'flex';
    }

    /**
     * Close delete modal
     */
    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.style.display = 'none';
        this.deleteEntryId = null;
    }

    /**
     * Handle delete confirmation
     */
    async handleDeleteConfirm() {
        if (!this.deleteEntryId) return;

        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const deleteText = document.getElementById('deleteText');
        const deleteSpinner = document.getElementById('deleteSpinner');

        // Show loading
        confirmBtn.disabled = true;
        deleteText.style.display = 'none';
        deleteSpinner.style.display = 'inline-block';

        try {
            await this.geneManager.deleteEntry(this.deleteEntryId);
            this.closeDeleteModal();
        } catch (error) {
            console.error('Delete error:', error);
        } finally {
            confirmBtn.disabled = false;
            deleteText.style.display = 'inline';
            deleteSpinner.style.display = 'none';
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        this.closeGeneModal();
        this.closeUploadModal();
        this.closeDeleteModal();
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
window.ModalManager = ModalManager;