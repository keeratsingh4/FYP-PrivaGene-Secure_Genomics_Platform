// riskAssessmentService.js
const encryptionService = require('./encryptionService');

const { run, get, all } = require('../../DBMS/db/db');

const riskAssessmentService = {
  /**
   * Create a new risk assessment
   * @param {Object} assessmentData - Assessment data
   * @returns {Promise<Object>} Created assessment
   */
  async createAssessment(assessmentData) {
    const { userId, overallRisk, diseaseId, matchCount, matchedGenes, riskPercentage } = assessmentData;

    const id = 'risk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    const encryptedOverallRisk = encryptionService.encryptNumber(overallRisk);
    const encryptedMatchedGenes = encryptionService.encryptJSON(matchedGenes || []);
    const encryptedRiskPercentage = encryptionService.encryptNumber(riskPercentage);

    await run(`
      INSERT INTO risk_assessments (
        id, user_id, overall_risk, disease_id, match_count, 
        matched_genes, risk_percentage, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      userId,
      encryptedOverallRisk,
      diseaseId || null,
      matchCount || 0,
      encryptedMatchedGenes,
      encryptedRiskPercentage,
      createdAt
    ]);

    return {
      id,
      userId,
      overallRisk,
      diseaseId,
      matchCount,
      matchedGenes,
      riskPercentage,
      createdAt
    };
  },

  /**
   * Get all assessments for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of assessments
   */
  async getAssessmentsByUser(userId) {
    const assessments = await all(`
      SELECT 
        id,
        user_id as userId,
        overall_risk as overallRisk,
        disease_id as diseaseId,
        match_count as matchCount,
        matched_genes as matchedGenes,
        risk_percentage as riskPercentage,
        created_at as createdAt
      FROM risk_assessments
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    // Parse matched_genes JSON string back to array
    return assessments.map(a => ({
      ...a,
      overallRisk: encryptionService.decryptNumber(a.overallRisk),
      matchedGenes: encryptionService.decryptJSON(a.matchedGenes),
      riskPercentage: encryptionService.decryptNumber(a.riskPercentage)
    }));
  },

  /**
   * Get all assessments for a user - CAREGIVER VIEW (excludes matched_genes for privacy)
   * This method is specifically for caregivers who should see risk data but NOT the specific genes
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of assessments WITHOUT matched_genes
   */
  async getAssessmentsByUserForCaregiver(userId) {
    const assessments = await all(`
      SELECT 
        id,
        user_id as userId,
        overall_risk as overallRisk,
        disease_id as diseaseId,
        match_count as matchCount,
        risk_percentage as riskPercentage,
        created_at as createdAt
      FROM risk_assessments
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    // Return assessments WITHOUT matched_genes field
    // Caregivers can see the count (matchCount) but not the actual gene names
    return assessments.map(a => ({
      id: a.id,
      userId: a.userId,
      overallRisk: encryptionService.decryptNumber(a.overallRisk),
      diseaseId: a.diseaseId,
      matchCount: a.matchCount,
      riskPercentage: encryptionService.decryptNumber(a.riskPercentage),
      createdAt: a.createdAt
      // NOTE: matched_genes is intentionally excluded for caregiver privacy
    }));
  },

  /**
   * Get a specific assessment by ID
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Object|null>} Assessment or null if not found
   */
  async getAssessmentById(assessmentId) {
    const assessment = await get(`
      SELECT 
        id,
        user_id as userId,
        overall_risk as overallRisk,
        disease_id as diseaseId,
        match_count as matchCount,
        matched_genes as matchedGenes,
        risk_percentage as riskPercentage,
        created_at as createdAt
      FROM risk_assessments
      WHERE id = ?
    `, [assessmentId]);

    if (!assessment) return null;

    return {
      ...assessment,
      overallRisk: encryptionService.decryptNumber(assessment.overallRisk),
      matchedGenes: encryptionService.decryptJSON(assessment.matchedGenes),
      riskPercentage: encryptionService.decryptNumber(assessment.riskPercentage)
    };
  },

  /**
   * Delete an assessment
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteAssessment(assessmentId) {
    const result = await run('DELETE FROM risk_assessments WHERE id = ?', [assessmentId]);
    return result.changes > 0;
  },

  /**
   * Get latest assessment for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Latest assessment or null
   */
  async getLatestAssessment(userId) {
    const assessment = await get(`
      SELECT 
        id,
        user_id as userId,
        overall_risk as overallRisk,
        disease_id as diseaseId,
        match_count as matchCount,
        matched_genes as matchedGenes,
        risk_percentage as riskPercentage,
        created_at as createdAt
      FROM risk_assessments
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (!assessment) return null;

    return {
      ...assessment,
      overallRisk: encryptionService.decryptNumber(assessment.overallRisk),
      matchedGenes: encryptionService.decryptJSON(assessment.matchedGenes),
      riskPercentage: encryptionService.decryptNumber(assessment.riskPercentage)
    };
  },

  // ===================================
  // RESEARCHER ANALYTICS METHODS
  // ===================================

  // ===================================
  // UPDATED METHOD FOR riskAssessmentService.js
  // (Includes dateOfBirth for researcher age analysis)
  // ===================================

  /**
   * Get all assessments from users who have consented to research data sharing
   * Includes dateOfBirth for age grouping (anonymized - no names/emails/phones)
   * @returns {Promise<Array>} Array of assessments from consented users
   */
  async getConsentedAssessments() {
    const assessments = await all(`
      SELECT 
        ra.id,
        ra.user_id as visitorId,
        ra.overall_risk as overallRisk,
        ra.disease_id as diseaseId,
        ra.match_count as matchCount,
        ra.matched_genes as matchedGenes,
        ra.risk_percentage as riskPercentage,
        ra.created_at as createdAt,
        u.date_of_birth as dateOfBirth
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE u.research_consent = 1
      ORDER BY ra.created_at DESC
    `);

    // Return anonymized data (DECRYPTED for researcher analysis)
    // Note: visitorId is an opaque identifier, not linked to personal data
    // We don't expose email, name, phone, or address
    return assessments.map(a => ({
      id: a.id,
      visitorId: a.visitorId, // Anonymized patient identifier for counting unique patients
      overallRisk: encryptionService.decryptNumber(a.overallRisk),
      diseaseId: a.diseaseId,
      matchCount: a.matchCount,
      matchedGenes: encryptionService.decryptJSON(a.matchedGenes),
      riskPercentage: encryptionService.decryptNumber(a.riskPercentage),
      createdAt: a.createdAt,
      dateOfBirth: a.dateOfBirth // For age grouping only
    }));
  },

  /**
   * Get disease statistics with assessment counts from consented users
   * Groups by disease and includes hospital info
   * @returns {Promise<Array>} Array of disease stats
   */
  async getDiseaseStatisticsForResearch() {
    // First, get all diseases
    const diseases = await all(`
      SELECT 
        d.id as diseaseId,
        d.disease_name as diseaseName,
        d.disease_code as diseaseCode,
        d.description,
        d.hospital_id as hospitalId,
        u.organization_name as hospitalName,
        u.first_name as hospitalFirstName,
        u.last_name as hospitalLastName
      FROM diseases d
      LEFT JOIN users u ON d.hospital_id = u.id
      ORDER BY d.disease_name ASC
    `);

    // For each disease, get assessments and calculate decrypted statistics
    const stats = await Promise.all(diseases.map(async (disease) => {
      const assessments = await all(`
        SELECT ra.risk_percentage
        FROM risk_assessments ra
        INNER JOIN users u ON ra.user_id = u.id
        WHERE ra.disease_id = ?
          AND u.research_consent = 1
      `, [disease.diseaseId]);

      // Decrypt risk percentages
      const decryptedRisks = assessments
        .map(a => encryptionService.decryptNumber(a.risk_percentage))
        .filter(r => r !== null && !isNaN(r));

      const assessmentCount = decryptedRisks.length;
      const avgRiskPercentage = assessmentCount > 0
        ? Math.round((decryptedRisks.reduce((sum, r) => sum + r, 0) / assessmentCount) * 10) / 10
        : null;
      const maxRiskPercentage = assessmentCount > 0 ? Math.max(...decryptedRisks) : null;
      const minRiskPercentage = assessmentCount > 0 ? Math.min(...decryptedRisks) : null;
      const highRiskCount = decryptedRisks.filter(r => r >= 70).length;

      return {
        ...disease,
        hospitalName: disease.hospitalName || `${disease.hospitalFirstName || ''} ${disease.hospitalLastName || ''}`.trim() || 'Unknown Hospital',
        assessmentCount,
        avgRiskPercentage,
        maxRiskPercentage,
        minRiskPercentage,
        highRiskCount
      };
    }));

    // Sort by assessment count (descending), then by disease name
    return stats.sort((a, b) => {
      if (b.assessmentCount !== a.assessmentCount) {
        return b.assessmentCount - a.assessmentCount;
      }
      return a.diseaseName.localeCompare(b.diseaseName);
    });
  },

  /**
   * Get detailed analytics for a specific disease (from consented users only)
   * @param {string} diseaseId - Disease ID
   * @returns {Promise<Object>} Disease analytics
   */
  async getDiseaseAnalytics(diseaseId) {
    // Get basic disease info
    const diseaseInfo = await get(`
      SELECT 
        d.id as diseaseId,
        d.disease_name as diseaseName,
        d.disease_code as diseaseCode,
        d.description,
        d.constant,
        d.hospital_id as hospitalId,
        u.organization_name as hospitalName,
        u.first_name as hospitalFirstName,
        u.last_name as hospitalLastName
      FROM diseases d
      LEFT JOIN users u ON d.hospital_id = u.id
      WHERE d.id = ?
    `, [diseaseId]);

    if (!diseaseInfo) return null;

    // Get all assessments for this disease from consented users
    const assessments = await all(`
      SELECT 
        ra.id,
        ra.overall_risk as overallRisk,
        ra.match_count as matchCount,
        ra.matched_genes as matchedGenes,
        ra.risk_percentage as riskPercentage,
        ra.created_at as createdAt,
        u.date_of_birth as dateOfBirth
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE ra.disease_id = ?
        AND u.research_consent = 1
      ORDER BY ra.created_at DESC
    `, [diseaseId]);

    // Decrypt risk percentages before calculating statistics
    const decryptedAssessments = assessments.map(a => ({
      ...a,
      riskPercentage: encryptionService.decryptNumber(a.riskPercentage),
      matchedGenes: encryptionService.decryptJSON(a.matchedGenes)
    }));

    // Calculate statistics
    const totalAssessments = decryptedAssessments.length;
    const riskPercentages = decryptedAssessments
      .map(a => a.riskPercentage)
      .filter(r => r !== null && !isNaN(r));

    const avgRisk = riskPercentages.length > 0
      ? Math.round((riskPercentages.reduce((sum, r) => sum + r, 0) / riskPercentages.length) * 10) / 10
      : null;

    const highRiskCount = riskPercentages.filter(r => r >= 70).length;
    const mediumRiskCount = riskPercentages.filter(r => r >= 40 && r < 70).length;
    const lowRiskCount = riskPercentages.filter(r => r < 40).length;

    // Risk distribution for charts
    const riskDistribution = {
      low: lowRiskCount,
      medium: mediumRiskCount,
      high: highRiskCount
    };

    // Monthly trend data (last 6 months) - fetch and decrypt
    const monthlyData = await all(`
      SELECT 
        strftime('%Y-%m', ra.created_at) as month,
        ra.risk_percentage
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE ra.disease_id = ?
        AND u.research_consent = 1
        AND ra.created_at >= date('now', '-6 months')
      ORDER BY month ASC
    `, [diseaseId]);

    // Group by month and calculate decrypted averages
    const monthlyMap = {};
    monthlyData.forEach(row => {
      if (!monthlyMap[row.month]) {
        monthlyMap[row.month] = [];
      }
      const decrypted = encryptionService.decryptNumber(row.risk_percentage);
      if (decrypted !== null && !isNaN(decrypted)) {
        monthlyMap[row.month].push(decrypted);
      }
    });

    const monthlyTrend = Object.keys(monthlyMap).sort().map(month => ({
      month,
      count: monthlyMap[month].length,
      avgRisk: monthlyMap[month].length > 0
        ? Math.round((monthlyMap[month].reduce((sum, r) => sum + r, 0) / monthlyMap[month].length) * 10) / 10
        : 0
    }));

    return {
      ...diseaseInfo,
      hospitalName: diseaseInfo.hospitalName || `${diseaseInfo.hospitalFirstName || ''} ${diseaseInfo.hospitalLastName || ''}`.trim() || 'Unknown Hospital',
      statistics: {
        totalAssessments,
        avgRisk,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        riskDistribution
      },
      monthlyTrend: monthlyTrend.map(t => ({
        month: t.month,
        count: t.count,
        avgRisk: t.avgRisk ? Math.round(t.avgRisk * 10) / 10 : 0
      })),
      // Return anonymized assessments (no user IDs) with decrypted data
      recentAssessments: decryptedAssessments.slice(0, 20).map(a => ({
        id: a.id,
        riskPercentage: a.riskPercentage,
        matchCount: a.matchCount,
        matchedGenes: a.matchedGenes || [],
        createdAt: a.createdAt,
        dateOfBirth: a.dateOfBirth
      }))
    };
  },

  /**
   * Search disease statistics by disease name or hospital name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching disease stats
   */
  async searchDiseaseStatistics(searchTerm) {
    // First, get all diseases matching the search term
    const diseases = await all(`
      SELECT 
        d.id as diseaseId,
        d.disease_name as diseaseName,
        d.disease_code as diseaseCode,
        d.description,
        d.hospital_id as hospitalId,
        u.organization_name as hospitalName,
        u.first_name as hospitalFirstName,
        u.last_name as hospitalLastName
      FROM diseases d
      LEFT JOIN users u ON d.hospital_id = u.id
      WHERE d.disease_name LIKE ? OR u.organization_name LIKE ?
      ORDER BY d.disease_name ASC
    `, [`%${searchTerm}%`, `%${searchTerm}%`]);

    // For each disease, get assessments and calculate decrypted statistics
    const stats = await Promise.all(diseases.map(async (disease) => {
      const assessments = await all(`
        SELECT ra.risk_percentage
        FROM risk_assessments ra
        INNER JOIN users u ON ra.user_id = u.id
        WHERE ra.disease_id = ?
          AND u.research_consent = 1
      `, [disease.diseaseId]);

      // Decrypt risk percentages
      const decryptedRisks = assessments
        .map(a => encryptionService.decryptNumber(a.risk_percentage))
        .filter(r => r !== null && !isNaN(r));

      const assessmentCount = decryptedRisks.length;
      const avgRiskPercentage = assessmentCount > 0
        ? Math.round((decryptedRisks.reduce((sum, r) => sum + r, 0) / assessmentCount) * 10) / 10
        : null;
      const maxRiskPercentage = assessmentCount > 0 ? Math.max(...decryptedRisks) : null;
      const minRiskPercentage = assessmentCount > 0 ? Math.min(...decryptedRisks) : null;
      const highRiskCount = decryptedRisks.filter(r => r >= 70).length;

      return {
        ...disease,
        hospitalName: disease.hospitalName || `${disease.hospitalFirstName || ''} ${disease.hospitalLastName || ''}`.trim() || 'Unknown Hospital',
        assessmentCount,
        avgRiskPercentage,
        maxRiskPercentage,
        minRiskPercentage,
        highRiskCount
      };
    }));

    // Sort by assessment count (descending), then by disease name
    return stats.sort((a, b) => {
      if (b.assessmentCount !== a.assessmentCount) {
        return b.assessmentCount - a.assessmentCount;
      }
      return a.diseaseName.localeCompare(b.diseaseName);
    });
  },

  /**
   * Get recent assessments for researcher dashboard (from consented users only)
   * Includes disease name, hospital name, age, risk level, date
   * @param {number} limit - Number of assessments to return
   * @returns {Promise<Array>} Array of recent assessments
   */
  async getRecentAssessmentsForResearcher(limit = 6) {
    const assessments = await all(`
      SELECT 
        ra.id,
        ra.risk_percentage as riskPercentage,
        ra.match_count as matchCount,
        ra.created_at as createdAt,
        u.date_of_birth as dateOfBirth,
        d.disease_name as diseaseName,
        d.disease_code as diseaseCode,
        h.organization_name as hospitalName,
        h.first_name as hospitalFirstName,
        h.last_name as hospitalLastName
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      LEFT JOIN diseases d ON ra.disease_id = d.id
      LEFT JOIN users h ON d.hospital_id = h.id
      WHERE u.research_consent = 1
      ORDER BY ra.created_at DESC
      LIMIT ?
    `, [limit]);

    return assessments.map(a => ({
      id: a.id,
      riskPercentage: encryptionService.decryptNumber(a.riskPercentage),
      matchCount: a.matchCount,
      createdAt: a.createdAt,
      dateOfBirth: a.dateOfBirth,
      diseaseName: a.diseaseName || 'Unknown Disease',
      diseaseCode: a.diseaseCode,
      hospitalName: a.hospitalName ||
        `${a.hospitalFirstName || ''} ${a.hospitalLastName || ''}`.trim() ||
        'Unknown Hospital'
    }));
  },

  // ===================================
  // RESEARCHER DATASETS METHODS
  // ===================================
  /**
   * Get anonymized assessments for researcher datasets export
   * Includes date of birth for age grouping but NO personal identifiers
   * PRIVACY: Does not include names, emails, phone numbers, addresses
   * @returns {Promise<Array>} Array of anonymized assessments
   */
  async getAnonymizedAssessmentsForDatasets() {
    const assessments = await all(`
      SELECT 
        ra.id,
        ra.overall_risk as overallRisk,
        ra.disease_id as diseaseId,
        ra.match_count as matchCount,
        ra.risk_percentage as riskPercentage,
        ra.created_at as createdAt,
        u.date_of_birth as dateOfBirth,
        d.disease_name as diseaseName,
        d.disease_code as diseaseCode,
        h.organization_name as hospitalName,
        h.first_name as hospitalFirstName,
        h.last_name as hospitalLastName
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      LEFT JOIN diseases d ON ra.disease_id = d.id
      LEFT JOIN users h ON d.hospital_id = h.id
      WHERE u.research_consent = 1
      ORDER BY ra.created_at DESC
    `);

    // Return anonymized data - NO user_id, names, emails, phones
    return assessments.map(a => ({
      id: a.id,
      overallRisk: encryptionService.decryptNumber(a.overallRisk),
      diseaseId: a.diseaseId,
      matchCount: a.matchCount,
      riskPercentage: encryptionService.decryptNumber(a.riskPercentage),
      createdAt: a.createdAt,
      dateOfBirth: a.dateOfBirth, // For age grouping only
      diseaseName: a.diseaseName || 'Unknown Disease',
      diseaseCode: a.diseaseCode,
      hospitalName: a.hospitalName ||
        `${a.hospitalFirstName || ''} ${a.hospitalLastName || ''}`.trim() ||
        'Unknown Hospital'
    }));
  },

  /**
   * Get complete disease statistics with all metrics for datasets export
   * @returns {Promise<Array>} Array of disease statistics
   */
  async getCompleteDiseaseStatisticsForDatasets() {
    const stats = await all(`
      SELECT 
        d.id as diseaseId,
        d.disease_name as diseaseName,
        d.disease_code as diseaseCode,
        d.description,
        d.hospital_id as hospitalId,
        u.organization_name as hospitalName,
        u.first_name as hospitalFirstName,
        u.last_name as hospitalLastName,
        COUNT(ra.id) as assessmentCount,
        AVG(ra.risk_percentage) as avgRiskPercentage,
        MAX(ra.risk_percentage) as maxRiskPercentage,
        MIN(ra.risk_percentage) as minRiskPercentage,
        SUM(CASE WHEN ra.risk_percentage >= 70 THEN 1 ELSE 0 END) as highRiskCount,
        SUM(CASE WHEN ra.risk_percentage >= 40 AND ra.risk_percentage < 70 THEN 1 ELSE 0 END) as mediumRiskCount,
        SUM(CASE WHEN ra.risk_percentage < 40 THEN 1 ELSE 0 END) as lowRiskCount
      FROM diseases d
      LEFT JOIN users u ON d.hospital_id = u.id
      LEFT JOIN risk_assessments ra ON d.id = ra.disease_id
        AND ra.user_id IN (SELECT id FROM users WHERE research_consent = 1)
      GROUP BY d.id, d.disease_name, d.disease_code, d.description, 
               d.hospital_id, u.organization_name, u.first_name, u.last_name
      ORDER BY assessmentCount DESC, d.disease_name ASC
    `);

    return stats.map(s => ({
      diseaseId: s.diseaseId,
      diseaseName: s.diseaseName,
      diseaseCode: s.diseaseCode,
      description: s.description,
      hospitalName: s.hospitalName || `${s.hospitalFirstName || ''} ${s.hospitalLastName || ''}`.trim() || 'Unknown Hospital',
      assessmentCount: s.assessmentCount || 0,
      avgRiskPercentage: s.avgRiskPercentage ? Math.round(s.avgRiskPercentage * 10) / 10 : 0,
      maxRiskPercentage: s.maxRiskPercentage || 0,
      minRiskPercentage: s.minRiskPercentage || 0,
      highRiskCount: s.highRiskCount || 0,
      mediumRiskCount: s.mediumRiskCount || 0,
      lowRiskCount: s.lowRiskCount || 0
    }));
  },

  /**
   * Get monthly trends for datasets export
   * @returns {Promise<Array>} Array of monthly trend data
   */
  async getMonthlyTrendsForDatasets() {
    const trends = await all(`
      SELECT 
        strftime('%Y-%m', ra.created_at) as month,
        COUNT(*) as assessmentCount,
        AVG(ra.risk_percentage) as avgRiskPercentage,
        SUM(CASE WHEN ra.risk_percentage >= 70 THEN 1 ELSE 0 END) as highRiskCount,
        SUM(CASE WHEN ra.risk_percentage >= 40 AND ra.risk_percentage < 70 THEN 1 ELSE 0 END) as mediumRiskCount,
        SUM(CASE WHEN ra.risk_percentage < 40 THEN 1 ELSE 0 END) as lowRiskCount
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE u.research_consent = 1
      GROUP BY strftime('%Y-%m', ra.created_at)
      ORDER BY month DESC
    `);

    return trends.map(t => ({
      month: t.month,
      assessmentCount: t.assessmentCount,
      avgRiskPercentage: t.avgRiskPercentage ? Math.round(t.avgRiskPercentage * 10) / 10 : 0,
      highRiskCount: t.highRiskCount || 0,
      mediumRiskCount: t.mediumRiskCount || 0,
      lowRiskCount: t.lowRiskCount || 0
    }));
  },

  /**
   * Get aggregate statistics for datasets export
   * @returns {Promise<Object>} Aggregate statistics object
   */
  async getAggregateStatisticsForDatasets() {
    // Get basic counts
    const basicStats = await get(`
      SELECT 
        COUNT(*) as totalAssessments,
        AVG(ra.risk_percentage) as meanRiskScore,
        MIN(ra.risk_percentage) as minRiskScore,
        MAX(ra.risk_percentage) as maxRiskScore,
        SUM(CASE WHEN ra.risk_percentage >= 70 THEN 1 ELSE 0 END) as highRiskCount,
        SUM(CASE WHEN ra.risk_percentage >= 40 AND ra.risk_percentage < 70 THEN 1 ELSE 0 END) as mediumRiskCount,
        SUM(CASE WHEN ra.risk_percentage < 40 THEN 1 ELSE 0 END) as lowRiskCount
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE u.research_consent = 1
    `);

    // Get unique patient count
    const patientCount = await get(`
      SELECT COUNT(DISTINCT ra.user_id) as uniquePatients
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE u.research_consent = 1
    `);

    // Get disease category count
    const diseaseCount = await get(`
      SELECT COUNT(DISTINCT d.id) as diseaseCount
      FROM diseases d
    `);

    // Calculate median (SQLite doesn't have built-in median, so we do it manually)
    const allRisks = await all(`
      SELECT ra.risk_percentage
      FROM risk_assessments ra
      INNER JOIN users u ON ra.user_id = u.id
      WHERE u.research_consent = 1
      ORDER BY ra.risk_percentage ASC
    `);

    let medianRiskScore = 0;
    if (allRisks.length > 0) {
      const mid = Math.floor(allRisks.length / 2);
      medianRiskScore = allRisks.length % 2 === 0
        ? (allRisks[mid - 1].risk_percentage + allRisks[mid].risk_percentage) / 2
        : allRisks[mid].risk_percentage;
    }

    // Calculate standard deviation
    let stdDevRisk = 0;
    if (allRisks.length > 0 && basicStats.meanRiskScore) {
      const variance = allRisks.reduce((sum, r) => {
        return sum + Math.pow(r.risk_percentage - basicStats.meanRiskScore, 2);
      }, 0) / allRisks.length;
      stdDevRisk = Math.sqrt(variance);
    }

    const total = basicStats.totalAssessments || 1; // Avoid division by zero

    return {
      totalAssessments: basicStats.totalAssessments || 0,
      meanRiskScore: basicStats.meanRiskScore ? Math.round(basicStats.meanRiskScore * 10) / 10 : 0,
      medianRiskScore: Math.round(medianRiskScore * 10) / 10,
      stdDevRisk: Math.round(stdDevRisk * 10) / 10,
      minRiskScore: basicStats.minRiskScore || 0,
      maxRiskScore: basicStats.maxRiskScore || 0,
      highRiskCount: basicStats.highRiskCount || 0,
      mediumRiskCount: basicStats.mediumRiskCount || 0,
      lowRiskCount: basicStats.lowRiskCount || 0,
      highRiskPercentage: Math.round((basicStats.highRiskCount / total) * 1000) / 10,
      mediumRiskPercentage: Math.round((basicStats.mediumRiskCount / total) * 1000) / 10,
      lowRiskPercentage: Math.round((basicStats.lowRiskCount / total) * 1000) / 10,
      uniquePatients: patientCount.uniquePatients || 0,
      diseaseCategoriesAnalyzed: diseaseCount.diseaseCount || 0,
      avgAssessmentsPerDisease: diseaseCount.diseaseCount > 0
        ? Math.round((basicStats.totalAssessments / diseaseCount.diseaseCount) * 10) / 10
        : 0
    };
  }

};

module.exports = riskAssessmentService;