// ===================================
// PRIVAGENE - GENE UTILITIES
// Client-side gene data handling (privacy-preserving)
// ===================================

const GeneUtils = {
    /**
     * Parse gene file (client-side only)
     * @param {File} file - The gene data file
     * @param {number} maxGenes - Maximum allowed genes
     * @returns {Promise<{valid: Array, invalid: Array, exceededLimit: boolean}>}
     */
    async parseGeneFile(file, maxGenes = 700) {
        const text = await file.text();

        const valid = [];
        const invalid = [];

        let exceededLimit = false;

        const lines = text.split(/\r?\n/);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (exceededLimit) break;

            let line = lines[lineIndex].trim();

            // Skip empty lines or comments
            if (!line || line.startsWith("#")) continue;

            // Normalize separators
            let normalized = line
                .replace(/,/g, " ")
                .replace(/\t/g, " ")
                .replace(/ +/g, " ")
                .trim();

            const tokens = normalized.split(" ");

            for (let t = 0; t < tokens.length; t++) {
                if (exceededLimit) break;

                const token = tokens[t];
                if (token === "") continue;

                // Validate gene symbol
                if (/^[A-Za-z0-9\-_.]+$/.test(token)) {
                    valid.push(token.toUpperCase());

                    if (valid.length > maxGenes) {
                        exceededLimit = true;
                        invalid.push({
                            lineNumber: lineIndex + 1,
                            value: token,
                            reason: `Gene limit exceeded (max ${maxGenes})`
                        });
                        break;
                    }
                } else {
                    invalid.push({
                        lineNumber: lineIndex + 1,
                        value: token,
                        reason: "Invalid characters in gene symbol"
                    });
                }
            }
        }

        // Remove duplicates
        const seen = new Set();
        const uniqueValid = valid.filter(g => {
            if (seen.has(g)) return false;
            seen.add(g);
            return true;
        });

        if (uniqueValid.length > maxGenes) {
            uniqueValid.length = maxGenes;
        }

        return { valid: uniqueValid, invalid, exceededLimit };
    },

    /**
     * Store gene symbols in browser (no backend)
     * @param {Array<string>} geneSymbols - Array of gene symbols
     * @param {string} fileName - Original file name
     * @param {number} fileSize - File size
     */
    storeGeneData(geneSymbols, fileName, fileSize) {
        const uploadRecord = {
            fileName,
            fileSize,
            geneCount: geneSymbols.length,
            uploadedAt: Date.now(),
            status: "Uploaded"
        };

        // Store gene symbols separately (for PSI computation)
        localStorage.setItem("mappedGeneSymbols", JSON.stringify(geneSymbols));
        
        // Store upload metadata (for UI display)
        localStorage.setItem("geneUploads", JSON.stringify([uploadRecord]));

        console.log(`Stored ${geneSymbols.length} genes in browser`);
    },

    /**
     * Get stored gene symbols
     * @returns {Array<string>|null} Gene symbols or null if not found
     */
    getStoredGenes() {
        const stored = localStorage.getItem("mappedGeneSymbols");
        return stored ? JSON.parse(stored) : null;
    },

    /**
     * Get upload history
     * @returns {Array} Upload records
     */
    getUploadHistory() {
        const stored = localStorage.getItem("geneUploads");
        return stored ? JSON.parse(stored) : [];
    },

    /**
     * Clear stored gene data
     */
    clearGeneData() {
        localStorage.removeItem("mappedGeneSymbols");
        localStorage.removeItem("geneUploads");
        console.log("Gene data cleared from browser");
    }
};

// Export globally
window.GeneUtils = GeneUtils;