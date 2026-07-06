const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../../DBMS/db/db');

/**
 * Organization Service - handles organization management for system admins
 * Organizations are derived from users with organization_name field
 */

/**
 * Get all pending organization registrations
 * These are organization admin accounts (hospital_admin/admin/doctor) awaiting approval
 * Note: 'hospital' role is for specialists, not org admins
 * @returns {Promise<Array>} Array of pending organization registrations
 */
async function getPendingRegistrations() {
    const sql = `
        SELECT 
            id,
            email,
            role,
            first_name,
            last_name,
            organization_name,
            organization_id,
            license_number,
            specialty,
            institution,
            status,
            created_at,
            updated_at
        FROM users 
        WHERE status = 'pending_approval'
        AND role IN ('hospital_admin', 'admin', 'doctor')
        ORDER BY created_at DESC
    `;
    
    const users = await all(sql, []);
    
    // Normalize to camelCase for frontend
    return users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        organizationName: user.organization_name,
        organizationId: user.organization_id,
        licenseNumber: user.license_number,
        specialty: user.specialty,
        institution: user.institution,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at
    }));
}

/**
 * Get all active organizations with aggregated data
 * Shows hospital_admin/admin accounts as organization representatives
 * Counts hospital specialists (hospital role) as users under each organization
 * @returns {Promise<Array>} Array of organization objects
 */
async function getActiveOrganizations() {
    // First, get the organization admins (hospital_admin, admin, doctor roles)
    const adminsSql = `
        SELECT 
            id,
            email,
            role,
            first_name,
            last_name,
            organization_name,
            created_at
        FROM users 
        WHERE status = 'active'
        AND organization_name IS NOT NULL 
        AND organization_name != ''
        AND role IN ('hospital_admin', 'admin', 'doctor')
        ORDER BY created_at ASC
    `;
    
    const admins = await all(adminsSql, []);
    
    // Group admins by organization (take the first/oldest as primary admin)
    const orgsMap = {};
    for (const admin of admins) {
        if (!orgsMap[admin.organization_name]) {
            orgsMap[admin.organization_name] = {
                name: admin.organization_name,
                type: getOrganizationType(admin.role),
                adminEmail: admin.email,
                adminName: `${admin.first_name || ''} ${admin.last_name || ''}`.trim(),
                joinedDate: admin.created_at,
                userCount: 0
            };
        }
    }
    
    // Now count specialists (hospital role) for each organization
    const specialistsSql = `
        SELECT 
            organization_name,
            COUNT(*) as specialist_count
        FROM users 
        WHERE status = 'active'
        AND organization_name IS NOT NULL 
        AND organization_name != ''
        AND role = 'hospital'
        GROUP BY organization_name
    `;
    
    const specialists = await all(specialistsSql, []);
    
    // Add specialist counts to organizations
    for (const spec of specialists) {
        if (orgsMap[spec.organization_name]) {
            orgsMap[spec.organization_name].userCount = spec.specialist_count;
        }
    }
    
    // Convert to array and sort by join date (newest first)
    return Object.values(orgsMap).sort((a, b) => 
        new Date(b.joinedDate) - new Date(a.joinedDate)
    );
}

/**
 * Get organization details by name
 * @param {string} orgName - Organization name
 * @returns {Promise<Object>} Organization details with member list
 */
async function getOrganizationByName(orgName) {
    // Get organization admin(s)
    const adminSql = `
        SELECT 
            id,
            email,
            role,
            first_name,
            last_name,
            organization_name,
            specialty,
            status,
            created_at
        FROM users 
        WHERE organization_name = ?
        AND role IN ('hospital_admin', 'admin', 'doctor')
        ORDER BY created_at ASC
    `;
    
    const admins = await all(adminSql, [orgName]);
    
    if (admins.length === 0) {
        return null;
    }
    
    // Get specialists (hospital role)
    const specialistSql = `
        SELECT 
            id,
            email,
            role,
            first_name,
            last_name,
            specialty,
            status,
            created_at
        FROM users 
        WHERE organization_name = ?
        AND role = 'hospital'
        ORDER BY created_at ASC
    `;
    
    const specialists = await all(specialistSql, [orgName]);
    
    // Find the primary admin (first registered)
    const primaryAdmin = admins[0];
    
    return {
        name: orgName,
        type: getOrganizationType(primaryAdmin.role),
        primaryAdmin: {
            id: primaryAdmin.id,
            email: primaryAdmin.email,
            name: `${primaryAdmin.first_name || ''} ${primaryAdmin.last_name || ''}`.trim()
        },
        adminCount: admins.length,
        specialistCount: specialists.length,
        admins: admins.map(m => ({
            id: m.id,
            email: m.email,
            role: m.role,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            specialty: m.specialty,
            status: m.status,
            joinedAt: m.created_at
        })),
        specialists: specialists.map(m => ({
            id: m.id,
            email: m.email,
            role: m.role,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            specialty: m.specialty,
            status: m.status,
            joinedAt: m.created_at
        })),
        createdAt: primaryAdmin.created_at
    };
}

/**
 * Get organization statistics for dashboard
 * @returns {Promise<Object>} Organization statistics
 */
async function getOrganizationStatistics() {
    // Total active organizations (based on hospital_admin/admin/doctor accounts)
    const activeOrgsSql = `
        SELECT COUNT(DISTINCT organization_name) as count
        FROM users 
        WHERE status = 'active'
        AND organization_name IS NOT NULL 
        AND organization_name != ''
        AND role IN ('hospital_admin', 'admin', 'doctor')
    `;
    
    // Pending registrations count (organization admin accounts only)
    const pendingSql = `
        SELECT COUNT(*) as count
        FROM users 
        WHERE status = 'pending_approval'
        AND role IN ('hospital_admin', 'admin', 'doctor')
    `;
    
    // Organizations by type
    const byTypeSql = `
        SELECT 
            CASE 
                WHEN role = 'hospital_admin' THEN 'Hospital'
                WHEN role = 'admin' THEN 'Research Institution'
                WHEN role = 'doctor' THEN 'Medical Practice'
                ELSE 'Other'
            END as org_type,
            COUNT(DISTINCT organization_name) as count
        FROM users 
        WHERE status = 'active'
        AND organization_name IS NOT NULL 
        AND organization_name != ''
        AND role IN ('hospital_admin', 'admin', 'doctor')
        GROUP BY org_type
    `;
    
    // Recent registrations (last 30 days) - organization admins only
    const recentSql = `
        SELECT COUNT(*) as count
        FROM users 
        WHERE created_at >= datetime('now', '-30 days')
        AND role IN ('hospital_admin', 'admin', 'doctor')
    `;
    
    const [activeOrgs, pending, byType, recent] = await Promise.all([
        get(activeOrgsSql, []),
        get(pendingSql, []),
        all(byTypeSql, []),
        get(recentSql, [])
    ]);
    
    return {
        totalActiveOrganizations: activeOrgs?.count || 0,
        pendingRegistrations: pending?.count || 0,
        recentRegistrations: recent?.count || 0,
        byType: byType.reduce((acc, item) => {
            acc[item.org_type] = item.count;
            return acc;
        }, {})
    };
}

/**
 * Approve an organization registration
 * @param {string} userId - User ID to approve
 * @returns {Promise<Object>} Updated user
 */
async function approveRegistration(userId) {
    const sql = 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?';
    await run(sql, ['active', new Date().toISOString(), userId]);
    
    // Return the updated user
    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (user) {
        user.research_consent = user.research_consent === 1;
    }
    return user;
}

/**
 * Reject an organization registration (delete the user)
 * @param {string} userId - User ID to reject
 * @returns {Promise<boolean>} Success status
 */
async function rejectRegistration(userId) {
    const sql = 'DELETE FROM users WHERE id = ? AND status = ?';
    await run(sql, [userId, 'pending_approval']);
    return true;
}

/**
 * Suspend an organization (suspend all admins and specialists)
 * @param {string} orgName - Organization name
 * @returns {Promise<number>} Number of users suspended
 */
async function suspendOrganization(orgName) {
    const sql = `
        UPDATE users 
        SET status = 'suspended', updated_at = ?
        WHERE organization_name = ?
        AND role IN ('hospital', 'hospital_admin', 'admin', 'doctor')
    `;
    const result = await run(sql, [new Date().toISOString(), orgName]);
    return result.changes || 0;
}

/**
 * Activate an organization (activate all admins and specialists)
 * @param {string} orgName - Organization name
 * @returns {Promise<number>} Number of users activated
 */
async function activateOrganization(orgName) {
    const sql = `
        UPDATE users 
        SET status = 'active', updated_at = ?
        WHERE organization_name = ?
        AND role IN ('hospital', 'hospital_admin', 'admin', 'doctor')
    `;
    const result = await run(sql, [new Date().toISOString(), orgName]);
    return result.changes || 0;
}

/**
 * Helper function to determine organization type from role
 * Note: 'hospital' role is for specialists, not organization type
 */
function getOrganizationType(role) {
    switch (role) {
        case 'hospital_admin':
            return 'Hospital';
        case 'admin':
            return 'Research Institution';
        case 'doctor':
            return 'Medical Practice';
        default:
            return 'Organization';
    }
}

module.exports = {
    getPendingRegistrations,
    getActiveOrganizations,
    getOrganizationByName,
    getOrganizationStatistics,
    approveRegistration,
    rejectRegistration,
    suspendOrganization,
    activateOrganization
};