const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../../DBMS/db/db');
const bcrypt = require('bcrypt');

// Number of salt rounds for bcrypt (10 is a good balance of security and performance)
const SALT_ROUNDS = 10;

/**
 * User Service - handles user registration, authentication, and management
 */

// Create a new user
async function createUser(userData) {
    const {
        email,
        password,
        role,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        address,
        organizationName,
        organizationId,
        licenseNumber,
        specialty,
        institution,
        researchArea,
        researchConsent = false,  // NEW: Default to false if not provided
        status = 'active'
    } = userData;

    const id = uuidv4();
    const now = new Date().toISOString();

    // Convert boolean to integer for SQLite (0 or 1)
    const researchConsentInt = researchConsent ? 1 : 0;

    // 🔒 SECURITY: Hash the password before storing
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const sql = `
    INSERT INTO users (
      id, email, password_hash, role, first_name, last_name, phone, date_of_birth,
      address, organization_name, organization_id, license_number, specialty,
      institution, research_area, research_consent, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    await run(sql, [
        id, email, passwordHash, role, firstName, lastName, phone, dateOfBirth,
        address, organizationName, organizationId, licenseNumber, specialty,
        institution, researchArea, researchConsentInt, status, now, now
    ]);

    return { id, email, role, status, researchConsent: researchConsentInt === 1, createdAt: now };
}

// Find user by email
async function getUserByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const user = await get(sql, [email]);
    if (user) {
        // Convert research_consent from integer to boolean for consistency
        user.research_consent = user.research_consent === 1;
    }
    return user;
}

// Find user by ID
async function getUserById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const user = await get(sql, [id]);
    if (user) {
        // Convert research_consent from integer to boolean for consistency
        user.research_consent = user.research_consent === 1;
    }
    return user;
}

// 🔒 NEW: Authenticate user with email and password (for login)
async function authenticateUser(email, password) {
    const user = await getUserByEmail(email);
    
    if (!user) {
        return null; // User not found
    }

    // Check if account is deleted
    if (user.status === 'deleted') {
        throw new Error('This account has been deleted');
    }

    // Check if account is suspended
    if (user.status === 'suspended') {
        throw new Error('This account has been suspended. Please contact support.');
    }

    // 🔒 SECURITY: Compare plaintext password with stored hash
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
        return null; // Invalid password
    }

    // 🔒 SECURITY: Remove password_hash before returning user object
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

// Check if email already exists (including deleted users to prevent re-registration)
async function emailExists(email) {
    const sql = 'SELECT id FROM users WHERE email = ?';
    const user = await get(sql, [email]);
    return !!user;
}

// Check if license number already exists
async function licenseNumberExists(licenseNumber) {
    const sql = 'SELECT id FROM users WHERE license_number = ?';
    const user = await get(sql, [licenseNumber]);
    return !!user;
}

// Get all hospital specialists (role = 'hospital') by organization name
async function getHospitalSpecialistsByOrganization(organizationName) {
    const sql = `
        SELECT * FROM users 
        WHERE role = 'hospital' AND organization_name = ?
        ORDER BY created_at DESC
    `;
    const users = await all(sql, [organizationName]);
    
    return users.map(user => ({
        ...user,
        research_consent: user.research_consent === 1
    }));
}

// Update user
async function updateUser(id, updates) {
    const allowedFields = [
        'first_name', 'last_name', 'phone', 'date_of_birth', 'address',
        'organization_name', 'license_number', 'specialty', 'institution',
        'research_area', 'research_consent', 'status'
    ];

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(snakeKey)) {
            fields.push(`${snakeKey} = ?`);
            // Handle boolean to integer conversion for research_consent
            if (snakeKey === 'research_consent') {
                values.push(updates[key] ? 1 : 0);
            } else {
                values.push(updates[key]);
            }
        }
    });

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await run(sql, values);

    return await getUserById(id);
}

// Soft delete user - marks as deleted but keeps record
async function deleteUser(id, reason = 'Account deleted by user request') {
    const now = new Date().toISOString();
    
    // Get user before soft delete to return their info
    const user = await getUserById(id);
    if (!user) {
        throw new Error('User not found');
    }
    
    const sql = `
        UPDATE users 
        SET status = 'deleted',
            deleted_at = ?,
            deletion_reason = ?,
            updated_at = ?
        WHERE id = ?
    `;
    
    await run(sql, [now, reason, now, id]);
    return true;
}

// Hard delete user - permanently removes from database (admin only, for GDPR compliance)
async function hardDeleteUser(id) {
    const sql = 'DELETE FROM users WHERE id = ?';
    await run(sql, [id]);
    return true;
}

// Get all users (filtered by role or status if provided)
async function getUsers(filters = {}) {
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    // Exclude deleted users by default unless explicitly requested
    if (filters.includeDeleted !== true) {
        sql += ' AND status != ?';
        params.push('deleted');
    }

    if (filters.role) {
        sql += ' AND role = ?';
        params.push(filters.role);
    }

    if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
    }

    // NEW: Filter by research consent
    if (filters.researchConsent !== undefined) {
        sql += ' AND research_consent = ?';
        params.push(filters.researchConsent ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';

    const users = await all(sql, params);
    
    // Convert research_consent from integer to boolean for all users
    return users.map(user => ({
        ...user,
        research_consent: user.research_consent === 1
    }));
}

// NEW: Get users who have consented to research data sharing (exclude deleted)
async function getConsentedUsers() {
    const sql = `
        SELECT * FROM users 
        WHERE research_consent = 1 
        AND role = ? 
        AND status != ?
    `;
    const users = await all(sql, ['patient', 'deleted']);
    
    return users.map(user => ({
        ...user,
        research_consent: true
    }));
}

// 🔒 UPDATED: Change password (now hashes the new password)
async function changePassword(id, newPassword) {
    // Hash the new password before storing
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const sql = 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?';
    await run(sql, [passwordHash, new Date().toISOString(), id]);
    return true;
}

// Update user status (for admin approval workflow)
async function updateUserStatus(id, status) {
    const sql = 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?';
    await run(sql, [status, new Date().toISOString(), id]);
    return await getUserById(id);
}

// NEW: Update research consent preference
async function updateResearchConsent(id, consent) {
    const sql = 'UPDATE users SET research_consent = ?, updated_at = ? WHERE id = ?';
    await run(sql, [consent ? 1 : 0, new Date().toISOString(), id]);
    return await getUserById(id);
}

// NEW: Restore a soft-deleted user (admin only)
async function restoreUser(id) {
    const sql = `
        UPDATE users 
        SET status = 'active',
            deleted_at = NULL,
            deletion_reason = NULL,
            updated_at = ?
        WHERE id = ? AND status = 'deleted'
    `;
    await run(sql, [new Date().toISOString(), id]);
    return await getUserById(id);
}

module.exports = {
    createUser,
    getUserByEmail,
    getUserById,
    authenticateUser,        // 🔒 NEW: For secure login
    emailExists,
    licenseNumberExists,
    getHospitalSpecialistsByOrganization,
    updateUser,
    deleteUser,              // Now uses soft delete
    hardDeleteUser,          // NEW: For permanent deletion (GDPR)
    getUsers,
    getConsentedUsers,
    changePassword,
    updateUserStatus,
    updateResearchConsent,
    restoreUser              // NEW: Restore deleted users
};