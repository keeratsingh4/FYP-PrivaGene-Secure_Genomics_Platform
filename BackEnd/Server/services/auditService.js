// auditService.js
// Audit logging service for tracking all system activity

const { run, get, all } = require('../../DBMS/db/db');

const auditService = {
  /**
   * Create a new audit log entry
   * @param {Object} logData - Audit log data
   * @returns {Promise<Object>} Created log entry
   */
  async createLog(logData) {
    const {
      userId,
      userEmail,
      userRole,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      status = 'success',
      severity = 'info',
      details,
      sessionId
    } = logData;

    const id = 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toISOString();
    const createdAt = timestamp;

    // Convert details to JSON string if it's an object
    const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : details) : null;

    await run(`
      INSERT INTO audit_logs (
        id, timestamp, user_id, user_email, user_role, action,
        resource_type, resource_id, ip_address, user_agent,
        status, severity, details, session_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      timestamp,
      userId || null,
      userEmail || null,
      userRole || null,
      action,
      resourceType || null,
      resourceId || null,
      ipAddress || null,
      userAgent || null,
      status,
      severity,
      detailsStr,
      sessionId || null,
      createdAt
    ]);

    return {
      id,
      timestamp,
      userId,
      userEmail,
      userRole,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      status,
      severity,
      details: detailsStr,
      sessionId,
      createdAt
    };
  },

  /**
   * Get audit logs with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of audit logs
   */
  async getLogs(filters = {}) {
    const {
      userEmail,
      userId,
      userRole,
      action,
      resourceType,
      status,
      severity,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (userEmail) {
      sql += ' AND user_email LIKE ?';
      params.push(`%${userEmail}%`);
    }

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    if (userRole) {
      sql += ' AND user_role = ?';
      params.push(userRole);
    }

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (resourceType) {
      sql += ' AND resource_type = ?';
      params.push(resourceType);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }

    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate + 'T23:59:59.999Z');
    }

    sql += ' ORDER BY timestamp DESC';
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await all(sql, params);

    // Parse details JSON for each log
    return logs.map(log => ({
      ...log,
      details: log.details ? this.safeParseJSON(log.details) : null
    }));
  },

  /**
   * Get a single audit log by ID
   * @param {string} id - Log ID
   * @returns {Promise<Object|null>} Audit log or null
   */
  async getLogById(id) {
    const log = await get('SELECT * FROM audit_logs WHERE id = ?', [id]);
    
    if (log && log.details) {
      log.details = this.safeParseJSON(log.details);
    }
    
    return log;
  },

  /**
   * Get audit logs for a specific user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of logs
   * @returns {Promise<Array>} Array of audit logs
   */
  async getLogsByUser(userId, limit = 50) {
    const logs = await all(
      'SELECT * FROM audit_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
      [userId, limit]
    );

    return logs.map(log => ({
      ...log,
      details: log.details ? this.safeParseJSON(log.details) : null
    }));
  },

  /**
   * Get audit logs for a specific resource
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @returns {Promise<Array>} Array of audit logs
   */
  async getLogsByResource(resourceType, resourceId) {
    const logs = await all(
      'SELECT * FROM audit_logs WHERE resource_type = ? AND resource_id = ? ORDER BY timestamp DESC',
      [resourceType, resourceId]
    );

    return logs.map(log => ({
      ...log,
      details: log.details ? this.safeParseJSON(log.details) : null
    }));
  },

  /**
   * Get count of logs matching filters
   * @param {Object} filters - Filter options
   * @returns {Promise<number>} Count of matching logs
   */
  async getLogsCount(filters = {}) {
    const {
      userEmail,
      userId,
      userRole,
      action,
      resourceType,
      status,
      severity,
      startDate,
      endDate
    } = filters;

    let sql = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params = [];

    if (userEmail) {
      sql += ' AND user_email LIKE ?';
      params.push(`%${userEmail}%`);
    }

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    if (userRole) {
      sql += ' AND user_role = ?';
      params.push(userRole);
    }

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (resourceType) {
      sql += ' AND resource_type = ?';
      params.push(resourceType);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }

    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate + 'T23:59:59.999Z');
    }

    const result = await get(sql, params);
    return result ? result.count : 0;
  },

  /**
   * Get summary statistics for audit logs
   * @returns {Promise<Object>} Summary statistics
   */
  async getStatistics() {
    const totalLogs = await get('SELECT COUNT(*) as count FROM audit_logs');
    const todayLogs = await get(
      "SELECT COUNT(*) as count FROM audit_logs WHERE date(timestamp) = date('now')"
    );
    const failedActions = await get(
      "SELECT COUNT(*) as count FROM audit_logs WHERE status = 'failure'"
    );
    const criticalEvents = await get(
      "SELECT COUNT(*) as count FROM audit_logs WHERE severity = 'critical'"
    );

    // Get action breakdown
    const actionBreakdown = await all(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Get recent activity by hour (last 24 hours)
    const hourlyActivity = await all(`
      SELECT 
        strftime('%H', timestamp) as hour,
        COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= datetime('now', '-24 hours')
      GROUP BY strftime('%H', timestamp)
      ORDER BY hour
    `);

    return {
      totalLogs: totalLogs?.count || 0,
      todayLogs: todayLogs?.count || 0,
      failedActions: failedActions?.count || 0,
      criticalEvents: criticalEvents?.count || 0,
      actionBreakdown,
      hourlyActivity
    };
  },

  /**
   * Delete old audit logs (for retention policy)
   * @param {number} daysToKeep - Number of days to retain logs
   * @returns {Promise<number>} Number of deleted logs
   */
  async deleteOldLogs(daysToKeep = 90) {
    const result = await run(
      `DELETE FROM audit_logs WHERE timestamp < datetime('now', '-' || ? || ' days')`,
      [daysToKeep]
    );
    return result.changes || 0;
  },

  /**
   * Helper: Safely parse JSON string
   * @param {string} jsonStr - JSON string
   * @returns {Object|string} Parsed object or original string
   */
  safeParseJSON(jsonStr) {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return jsonStr;
    }
  },

  // ===================================
  // CONVENIENCE METHODS FOR COMMON ACTIONS
  // ===================================

  /**
   * Log a login event
   */
  async logLogin(userData, ipAddress, userAgent, success = true) {
    return this.createLog({
      userId: userData.id,
      userEmail: userData.email,
      userRole: userData.role,
      action: 'login',
      resourceType: 'session',
      ipAddress,
      userAgent,
      status: success ? 'success' : 'failure',
      severity: success ? 'info' : 'warning',
      details: success ? { message: 'User logged in successfully' } : { message: 'Login attempt failed' }
    });
  },

  /**
   * Log a logout event
   */
  async logLogout(userData, ipAddress, userAgent) {
    return this.createLog({
      userId: userData.id,
      userEmail: userData.email,
      userRole: userData.role,
      action: 'logout',
      resourceType: 'session',
      ipAddress,
      userAgent,
      status: 'success',
      severity: 'info',
      details: { message: 'User logged out' }
    });
  },

  /**
   * Log a gene file upload
   */
  async logGeneUpload(userData, documentId, fileName, ipAddress) {
    return this.createLog({
      userId: userData.id,
      userEmail: userData.email,
      userRole: userData.role,
      action: 'upload_gene',
      resourceType: 'document',
      resourceId: documentId,
      ipAddress,
      status: 'success',
      severity: 'info',
      details: { fileName, message: 'Gene file uploaded' }
    });
  },

  /**
   * Log a risk computation
   */
  async logRiskComputation(userData, assessmentId, diseaseId, ipAddress) {
    return this.createLog({
      userId: userData.id,
      userEmail: userData.email,
      userRole: userData.role,
      action: 'compute_risk',
      resourceType: 'risk_assessment',
      resourceId: assessmentId,
      ipAddress,
      status: 'success',
      severity: 'info',
      details: { diseaseId, message: 'Risk assessment computed' }
    });
  },

  /**
   * Log a profile update
   */
  async logProfileUpdate(userData, updatedFields, ipAddress) {
    return this.createLog({
      userId: userData.id,
      userEmail: userData.email,
      userRole: userData.role,
      action: 'update_profile',
      resourceType: 'user',
      resourceId: userData.id,
      ipAddress,
      status: 'success',
      severity: 'info',
      details: { updatedFields, message: 'Profile updated' }
    });
  },

  /**
   * Log user management actions (admin)
   */
  async logUserManagement(adminData, targetUserId, action, ipAddress, details = {}) {
    return this.createLog({
      userId: adminData.id,
      userEmail: adminData.email,
      userRole: adminData.role,
      action: action, // e.g., 'user_created', 'user_suspended', 'user_deleted'
      resourceType: 'user',
      resourceId: targetUserId,
      ipAddress,
      status: 'success',
      severity: 'warning',
      details: { ...details, message: `User ${action.replace('user_', '')}` }
    });
  },

  /**
   * Log data export events
   */
  async logDataExport(userData, exportType, ipAddress) {
    return this.createLog({
      userId: userData.id,
      userEmail: userData.email,
      userRole: userData.role,
      action: 'data_export',
      resourceType: 'export',
      ipAddress,
      status: 'success',
      severity: 'warning',
      details: { exportType, message: 'Data exported' }
    });
  }
};

module.exports = auditService;

