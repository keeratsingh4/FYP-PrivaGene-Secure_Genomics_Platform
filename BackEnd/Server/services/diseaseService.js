// diseaseService.js
// Service for managing diseases and their associated genes in the database

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { run, get, all } = require('../../DBMS/db/db');

const diseaseService = {
  /**
   * Generate SHA-256 hash for a gene symbol
   * @param {string} geneSymbol - The gene symbol to hash
   * @returns {string} - Hex-encoded SHA-256 hash
   */
  generateHash(geneSymbol) {
    return crypto.createHash('sha256').update(geneSymbol.toUpperCase()).digest('hex');
  },

  /**
   * Validate constant value (must be > 0 and <= 100)
   * @param {number} constant - The constant value to validate
   * @returns {boolean} - True if valid
   */
  validateConstant(constant) {
    const num = parseFloat(constant);
    return !isNaN(num) && num > 0 && num <= 100;
  },

  /**
   * Create a new disease and its associated gene symbols
   * @param {Object} data - Disease data including gene_symbols array and constant
   * @returns {Promise<Object>} - Created disease
   */
  async createDisease(data) {
    // Validate constant
    if (!this.validateConstant(data.constant)) {
      throw new Error('Constant must be a number greater than 0 and less than or equal to 100');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // 1. Insert into diseases table (Disease metadata)
    const diseaseSql = `
      INSERT INTO diseases (
        id, hospital_id, disease_name, disease_code, 
        description, constant, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await run(diseaseSql, [
      id,
      data.hospital_id,
      data.disease_name,
      data.disease_code,
      data.description || '',
      parseFloat(data.constant),
      now,
      now
    ]);
    
    // 2. Insert into disease_genes (Gene symbols)
    if (data.gene_symbols && Array.isArray(data.gene_symbols)) {
        for (const symbol of data.gene_symbols) {
            if (symbol && typeof symbol === 'string') {
                await this.insertGeneSymbol(id, symbol);
            }
        }
    }

    return this.getDiseaseById(id);
  },

  /**
   * Internal helper to insert a single gene symbol and its hash.
   * @param {string} diseaseId - ID of the parent disease
   * @param {string} geneSymbol - The gene symbol string (e.g., 'BRCA1')
   */
  async insertGeneSymbol(diseaseId, geneSymbol) {
    const geneSymbolUpper = geneSymbol.toUpperCase();
    const hashValue = this.generateHash(geneSymbolUpper);
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO disease_genes (
        id, disease_id, gene_symbol, hash_value, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await run(sql, [
      id,
      diseaseId,
      geneSymbolUpper,
      hashValue,
      now,
      now
    ]);
  },

  /**
   * Get disease by ID, including all associated gene symbols
   * @param {string} id - Disease ID
   * @returns {Promise<Object|null>} - Disease or null
   */
  async getDiseaseById(id) {
    // 1. Get the main disease
    const diseaseSql = 'SELECT * FROM diseases WHERE id = ?';
    const disease = await get(diseaseSql, [id]);
    
    if (!disease) return null;
    
    // 2. Get all associated gene symbols
    const genesSql = `
      SELECT gene_symbol, hash_value, id as gene_id 
      FROM disease_genes 
      WHERE disease_id = ?
      ORDER BY gene_symbol ASC
    `;
    const geneDetails = await all(genesSql, [id]);

    // 3. Combine results
    disease.gene_symbols = geneDetails.map(g => g.gene_symbol);
    disease.gene_details = geneDetails; // Keep details for hash/ID access
    
    return disease;
  },

  /**
   * Internal helper to fetch all gene symbols for an array of diseases
   */
  async processDiseases(diseases) {
      if (diseases.length === 0) return [];
      
      const diseaseIds = diseases.map(d => d.id);
      
      // Get all genes for all fetched disease IDs in one go
      const genesSql = `
          SELECT disease_id, gene_symbol 
          FROM disease_genes 
          WHERE disease_id IN (${diseaseIds.map(() => '?').join(', ')})
          ORDER BY disease_id, gene_symbol ASC
      `;
      const allGenes = await all(genesSql, diseaseIds);
      
      // Group genes by disease ID
      const genesMap = allGenes.reduce((acc, gene) => {
          if (!acc[gene.disease_id]) {
              acc[gene.disease_id] = [];
          }
          acc[gene.disease_id].push(gene.gene_symbol);
          return acc;
      }, {});
      
      // Attach gene symbols to their respective diseases
      return diseases.map(disease => ({
          ...disease,
          gene_symbols: genesMap[disease.id] || []
      }));
  },

  /**
   * Get all diseases for a hospital
   * @param {string} hospitalId - Hospital ID
   * @returns {Promise<Array>} - Array of diseases
   */
  async getDiseasesByHospital(hospitalId) {
    const sql = `
      SELECT * FROM diseases 
      WHERE hospital_id = ? 
      ORDER BY created_at DESC
    `;
    const diseases = await all(sql, [hospitalId]);
    return this.processDiseases(diseases);
  },

  /**
   * Get all diseases created by hospital specialists belonging to a specific organization
   * @param {string} organizationName - Organization name (e.g., "Singapore General Hospital")
   * @returns {Promise<Array>} - Array of diseases with creator info
   */
  async getDiseasesByOrganization(organizationName) {
    // Get all diseases where the creator (hospital_id) belongs to the given organization
    const sql = `
      SELECT d.*, 
             u.first_name as creator_first_name, 
             u.last_name as creator_last_name,
             u.email as creator_email,
             u.organization_name
      FROM diseases d
      INNER JOIN users u ON d.hospital_id = u.id
      WHERE u.organization_name = ? AND u.role = 'hospital'
      ORDER BY d.created_at DESC
    `;
    const diseases = await all(sql, [organizationName]);
    return this.processDiseases(diseases);
  },

  /**
   * Get all diseases (admin view)
   * @returns {Promise<Array>} - Array of all diseases
   */
  async getAllDiseases() {
    const sql = `
      SELECT d.*, 
            u.organization_name as hospital_name,
            u.first_name as hospital_first_name,
            u.last_name as hospital_last_name
      FROM diseases d
      LEFT JOIN users u ON d.hospital_id = u.id
      ORDER BY d.created_at DESC
    `;
    const diseases = await all(sql);
    return this.processDiseases(diseases);
  },

  /**
   * Get diseases by disease code
   * @param {string} diseaseCode - Disease code
   * @param {string} hospitalId - Hospital ID (optional)
   * @returns {Promise<Array>} - Array of diseases
   */
  async getDiseasesByCode(diseaseCode, hospitalId = null) {
    let sql = 'SELECT * FROM diseases WHERE disease_code = ?';
    const params = [diseaseCode];
    
    if (hospitalId) {
      sql += ' AND hospital_id = ?';
      params.push(hospitalId);
    }
    
    sql += ' ORDER BY disease_name ASC';
    const diseases = await all(sql, params);
    
    return this.processDiseases(diseases);
  },

  /**
   * Get all diseases with hospital names (for patient disease selection)
   * @returns {Promise<Array>} - Array of all diseases with hospital info
   */
  async getAllDiseasesWithHospitalNames() {
      const sql = `
          SELECT d.*, u.organization_name as hospital_name, 
                u.first_name as hospital_first_name, 
                u.last_name as hospital_last_name
          FROM diseases d
          LEFT JOIN users u ON d.hospital_id = u.id
          ORDER BY d.created_at DESC
      `;
      const diseases = await all(sql);
      
      // Use organization_name, or fall back to first_name + last_name
      return diseases.map(d => ({
          ...d,
          hospital_name: d.hospital_name || 
              `${d.hospital_first_name || ''} ${d.hospital_last_name || ''}`.trim() || 
              'Unknown Hospital'
      }));
  },

  /**
   * Update a disease (metadata only)
   * @param {string} id - Disease ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object|null>} - Updated disease or null
   */
  async updateDisease(id, data) {
    const existing = await this.getDiseaseById(id);
    if (!existing) return null;

    const updates = [];
    const params = [];
    const now = new Date().toISOString();

    if (data.disease_name !== undefined) {
      updates.push('disease_name = ?');
      params.push(data.disease_name);
    }

    if (data.disease_code !== undefined) {
      updates.push('disease_code = ?');
      params.push(data.disease_code);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.constant !== undefined) {
      // Validate constant before updating
      if (!this.validateConstant(data.constant)) {
        throw new Error('Constant must be a number greater than 0 and less than or equal to 100');
      }
      updates.push('constant = ?');
      params.push(parseFloat(data.constant));
    }

    if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(id);

        const sql = `UPDATE diseases SET ${updates.join(', ')} WHERE id = ?`;
        await run(sql, params);
    }

    // If gene_symbols were provided, update them
    // This requires deleting existing and re-inserting
    if (data.gene_symbols && Array.isArray(data.gene_symbols)) {
        // Delete existing genes
        await run('DELETE FROM disease_genes WHERE disease_id = ?', [id]);
        
        // Insert new genes
        for (const symbol of data.gene_symbols) {
            if (symbol && typeof symbol === 'string') {
                await this.insertGeneSymbol(id, symbol);
            }
        }
    }

    return this.getDiseaseById(id);
  },

  /**
   * Delete a disease
   * @param {string} id - Disease ID
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteDisease(id) {
    const existing = await this.getDiseaseById(id);
    if (!existing) return false;

    const sql = 'DELETE FROM diseases WHERE id = ?';
    await run(sql, [id]);
    return true;
  },

  /**
   * Bulk insert diseases from CSV data
   * @param {Array} entries - Array of disease objects
   * @param {string} hospitalId - Hospital ID
   * @returns {Promise<Object>} - Summary of inserted/skipped entries
   */
  async bulkInsertDiseases(entries, hospitalId) {
    const results = {
      inserted: 0,
      skipped: 0,
      errors: []
    };

    for (const entry of entries) {
      try {
        if (!entry.disease_name || !entry.disease_code || !entry.gene_symbol) {
          results.skipped++;
          results.errors.push({
            entry: entry,
            reason: 'Missing required fields (disease_name, disease_code, gene_symbol)'
          });
          continue;
        }

        // Validate constant if provided, otherwise use default
        let constantValue = 50.0; // Default value
        if (entry.constant !== undefined && entry.constant !== '') {
          if (!this.validateConstant(entry.constant)) {
            results.skipped++;
            results.errors.push({
              entry: entry,
              reason: 'Invalid constant value (must be > 0 and <= 100)'
            });
            continue;
          }
          constantValue = parseFloat(entry.constant);
        }

        // 1. Check if the disease already exists (by hospitalId and disease_code)
        const existingDisease = await get('SELECT id, description FROM diseases WHERE hospital_id = ? AND disease_code = ?', 
                                        [hospitalId, entry.disease_code]);
        
        let diseaseId;
        
        if (existingDisease) {
            // Disease exists, use its ID
            diseaseId = existingDisease.id;
        } else {
            // 2. Disease does not exist, create it
            const id = uuidv4();
            const now = new Date().toISOString();
            const diseaseSql = `
              INSERT INTO diseases (
                id, hospital_id, disease_name, disease_code, description, constant, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await run(diseaseSql, [
              id,
              hospitalId,
              entry.disease_name,
              entry.disease_code,
              entry.description || '',
              constantValue,
              now,
              now
            ]);
            diseaseId = id;
        }

        // 3. Check if the specific gene symbol already exists for this disease
        const isDuplicateGene = await get('SELECT id FROM disease_genes WHERE disease_id = ? AND gene_symbol = ?', 
                                          [diseaseId, entry.gene_symbol.toUpperCase()]);

        if (isDuplicateGene) {
            results.skipped++;
            results.errors.push({
                entry: entry,
                reason: `Duplicate gene symbol: ${entry.gene_symbol} for disease code ${entry.disease_code}`
            });
            continue;
        }

        // 4. Insert the gene symbol (in disease_genes table)
        await this.insertGeneSymbol(diseaseId, entry.gene_symbol);

        results.inserted++;
      } catch (err) {
        results.skipped++;
        results.errors.push({
          entry: entry,
          reason: err.message
        });
      }
    }

    return results;
  },

  /**
   * Check if a duplicate disease exists (based on disease_code and hospitalId)
   * @param {string} hospitalId - Hospital ID
   * @param {string} diseaseCode - Disease code
   * @returns {Promise<boolean>} - True if duplicate disease exists
   */
  async checkDuplicateDisease(hospitalId, diseaseCode) {
    const sql = `
      SELECT id FROM diseases 
      WHERE hospital_id = ? AND disease_code = ?
    `;
    const result = await get(sql, [hospitalId, diseaseCode]);
    return !!result;
  },

  /**
   * Get unique diseases for a hospital
   * @param {string} hospitalId - Hospital ID
   * @returns {Promise<Array>} - Array of unique disease names/codes
   */
  async getUniqueDiseases(hospitalId) {
    const sql = `
      SELECT DISTINCT disease_name, disease_code, 
             COUNT(*) as gene_count,
             MIN(description) as description,
             MIN(constant) as constant,
             MIN(created_at) as created_at
      FROM diseases 
      WHERE hospital_id = ?
      GROUP BY disease_name, disease_code
      ORDER BY disease_name ASC
    `;
    return all(sql, [hospitalId]);
  },

  /**
   * Search diseases
   * @param {string} hospitalId - Hospital ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Matching diseases
   */
  async searchDiseases(hospitalId, searchTerm) {
    const term = `%${searchTerm}%`;
    
    // First search in diseases table
    const diseaseSql = `
      SELECT DISTINCT d.* 
      FROM diseases d
      LEFT JOIN disease_genes dg ON d.id = dg.disease_id
      WHERE d.hospital_id = ? 
        AND (d.disease_name LIKE ? 
             OR d.disease_code LIKE ? 
             OR d.description LIKE ?
             OR dg.gene_symbol LIKE ?)
      ORDER BY d.disease_name ASC
    `;
    
    const diseases = await all(diseaseSql, [hospitalId, term, term, term, term]);
    return this.processDiseases(diseases);
  },

  /**
   * Search diseases by organization name
   * @param {string} organizationName - Organization name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Matching diseases
   */
  async searchDiseasesByOrganization(organizationName, searchTerm) {
    const term = `%${searchTerm}%`;
    
    const sql = `
      SELECT DISTINCT d.*, 
             u.first_name as creator_first_name, 
             u.last_name as creator_last_name,
             u.email as creator_email,
             u.organization_name
      FROM diseases d
      INNER JOIN users u ON d.hospital_id = u.id
      LEFT JOIN disease_genes dg ON d.id = dg.disease_id
      WHERE u.organization_name = ? AND u.role = 'hospital'
        AND (d.disease_name LIKE ? 
             OR d.disease_code LIKE ? 
             OR d.description LIKE ?
             OR dg.gene_symbol LIKE ?)
      ORDER BY d.disease_name ASC
    `;
    
    const diseases = await all(sql, [organizationName, term, term, term, term]);
    return this.processDiseases(diseases);
  },

  /**
   * Get disease count uploaded by a specific hospital specialist
   * @param {string} hospitalId - Hospital specialist user ID
   * @returns {Promise<number>} - Count of diseases uploaded by this specialist
   */
  async getDiseaseCountBySpecialist(hospitalId) {
    const sql = 'SELECT COUNT(DISTINCT id) as count FROM diseases WHERE hospital_id = ?';
    const result = await get(sql, [hospitalId]);
    return result ? result.count : 0;
  },

  /**
   * Get total disease count for an organization
   * @param {string} organizationName - Organization name
   * @returns {Promise<number>} - Total count of diseases for the organization
   */
  async getDiseaseCountByOrganization(organizationName) {
    const sql = `
      SELECT COUNT(DISTINCT d.id) as count
      FROM diseases d
      INNER JOIN users u ON d.hospital_id = u.id
      WHERE u.organization_name = ? AND u.role = 'hospital'
    `;
    const result = await get(sql, [organizationName]);
    return result ? result.count : 0;
  },

  /**
   * Get recently uploaded/updated diseases by organization within a time period
   * @param {string} organizationName - Organization name
   * @param {number} days - Number of days to look back (default 3)
   * @returns {Promise<Array>} - Array of recently uploaded/updated diseases with creator info
   */
  async getRecentDiseasesByOrganization(organizationName, days = 3) {
    // Calculate the date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const thresholdISO = dateThreshold.toISOString();

    const sql = `
      SELECT d.*, 
             u.first_name as creator_first_name, 
             u.last_name as creator_last_name,
             u.email as creator_email,
             u.organization_name
      FROM diseases d
      INNER JOIN users u ON d.hospital_id = u.id
      WHERE u.organization_name = ? 
        AND u.role = 'hospital'
        AND (d.created_at >= ? OR d.updated_at >= ?)
      ORDER BY 
        CASE 
          WHEN d.updated_at >= ? THEN d.updated_at 
          ELSE d.created_at 
        END DESC
      LIMIT 10
    `;
    
    const diseases = await all(sql, [organizationName, thresholdISO, thresholdISO, thresholdISO]);
    return this.processDiseases(diseases);
  }
};

module.exports = diseaseService;