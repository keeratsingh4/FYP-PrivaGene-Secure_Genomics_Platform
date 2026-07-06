// caregiverAccessService.js
// Service for managing caregiver-patient access relationships

const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../../DBMS/db/db');

/**
 * Caregiver Access Service - handles caregiver-patient relationships
 */

// Create a new caregiver access invitation
async function createAccess(data) {
    const { patientId, caregiverId, relationship } = data;
    
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
        INSERT INTO caregiver_access (id, patient_id, caregiver_id, relationship, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `;

    await run(sql, [id, patientId, caregiverId, relationship, now, now]);

    return {
        id,
        patient_id: patientId,
        caregiver_id: caregiverId,
        relationship,
        status: 'pending',
        created_at: now,
        updated_at: now
    };
}

// Get access record by ID
async function getAccessById(accessId) {
    const sql = 'SELECT * FROM caregiver_access WHERE id = ?';
    return await get(sql, [accessId]);
}

// Get all caregivers for a patient (with user details)
async function getCaregiversForPatient(patientId, status = null) {
    let sql = `
        SELECT 
            ca.id,
            ca.patient_id,
            ca.caregiver_id,
            ca.relationship,
            ca.status,
            ca.created_at,
            ca.updated_at,
            ca.accepted_at,
            ca.revoked_at,
            ca.can_run_assessments,
            u.email as caregiver_email,
            u.first_name as caregiver_first_name,
            u.last_name as caregiver_last_name,
            u.phone as caregiver_phone
        FROM caregiver_access ca
        JOIN users u ON ca.caregiver_id = u.id
        WHERE ca.patient_id = ?
    `;
    
    const params = [patientId];
    
    if (status) {
        sql += ' AND ca.status = ?';
        params.push(status);
    }
    
    sql += ' ORDER BY ca.created_at DESC';
    
    return await all(sql, params);
}

// Get all patients for a caregiver (with user details)
async function getPatientsForCaregiver(caregiverId, status = null) {
    let sql = `
        SELECT 
            ca.id,
            ca.patient_id,
            ca.caregiver_id,
            ca.relationship,
            ca.status,
            ca.created_at,
            ca.updated_at,
            ca.accepted_at,
            ca.revoked_at,
            ca.can_run_assessments,
            u.email as patient_email,
            u.first_name as patient_first_name,
            u.last_name as patient_last_name,
            u.phone as patient_phone,
            u.date_of_birth as patient_dob
        FROM caregiver_access ca
        JOIN users u ON ca.patient_id = u.id
        WHERE ca.caregiver_id = ?
    `;
    
    const params = [caregiverId];
    
    if (status) {
        sql += ' AND ca.status = ?';
        params.push(status);
    }
    
    sql += ' ORDER BY ca.created_at DESC';
    
    return await all(sql, params);
}

// Check if an access relationship already exists (any status)
async function accessExists(patientId, caregiverId) {
    const sql = `
        SELECT id, status FROM caregiver_access 
        WHERE patient_id = ? AND caregiver_id = ?
    `;
    return await get(sql, [patientId, caregiverId]);
}


async function activeOrPendingAccessExists(patientId, caregiverId) {
    const sql = `
        SELECT id, status, can_run_assessments FROM caregiver_access 
        WHERE patient_id = ? AND caregiver_id = ? 
        AND status IN ('active', 'pending')
    `;
    return await get(sql, [patientId, caregiverId]);
}

// Accept an invitation (caregiver accepts)
async function acceptAccess(accessId, caregiverId) {
    const now = new Date().toISOString();
    
    // Verify the access belongs to this caregiver and is pending
    const access = await get(
        'SELECT * FROM caregiver_access WHERE id = ? AND caregiver_id = ? AND status = ?',
        [accessId, caregiverId, 'pending']
    );
    
    if (!access) {
        throw new Error('Invitation not found or already processed');
    }
    
    const sql = `
        UPDATE caregiver_access 
        SET status = 'active', accepted_at = ?, updated_at = ?
        WHERE id = ?
    `;
    
    await run(sql, [now, now, accessId]);
    
    return await getAccessById(accessId);
}

// Decline an invitation (caregiver declines)
async function declineAccess(accessId, caregiverId) {
    const now = new Date().toISOString();
    
    // Verify the access belongs to this caregiver and is pending
    const access = await get(
        'SELECT * FROM caregiver_access WHERE id = ? AND caregiver_id = ? AND status = ?',
        [accessId, caregiverId, 'pending']
    );
    
    if (!access) {
        throw new Error('Invitation not found or already processed');
    }
    
    const sql = `
        UPDATE caregiver_access 
        SET status = 'declined', updated_at = ?
        WHERE id = ?
    `;
    
    await run(sql, [now, accessId]);
    
    return await getAccessById(accessId);
}

// Revoke access (patient revokes)
async function revokeAccess(accessId, patientId) {
    const now = new Date().toISOString();
    
    // Verify the access belongs to this patient
    const access = await get(
        'SELECT * FROM caregiver_access WHERE id = ? AND patient_id = ?',
        [accessId, patientId]
    );
    
    if (!access) {
        throw new Error('Access record not found');
    }
    
    const sql = `
        UPDATE caregiver_access 
        SET status = 'revoked', revoked_at = ?, updated_at = ?
        WHERE id = ?
    `;
    
    await run(sql, [now, now, accessId]);
    
    return await getAccessById(accessId);
}

// Cancel a pending invitation (patient cancels)
async function cancelAccess(accessId, patientId) {
    // Verify the access belongs to this patient and is pending
    const access = await get(
        'SELECT * FROM caregiver_access WHERE id = ? AND patient_id = ? AND status = ?',
        [accessId, patientId, 'pending']
    );
    
    if (!access) {
        throw new Error('Pending invitation not found');
    }
    
    const sql = 'DELETE FROM caregiver_access WHERE id = ?';
    await run(sql, [accessId]);
    
    return { deleted: true, id: accessId };
}

// Update relationship type
async function updateRelationship(accessId, patientId, newRelationship) {
    const now = new Date().toISOString();
    
    // Verify the access belongs to this patient
    const access = await get(
        'SELECT * FROM caregiver_access WHERE id = ? AND patient_id = ?',
        [accessId, patientId]
    );
    
    if (!access) {
        throw new Error('Access record not found');
    }
    
    const sql = `
        UPDATE caregiver_access 
        SET relationship = ?, updated_at = ?
        WHERE id = ?
    `;
    
    await run(sql, [newRelationship, now, accessId]);
    
    return await getAccessById(accessId);
}

// Get counts for a patient's caregivers
async function getCaregiverCountsForPatient(patientId) {
    const sql = `
        SELECT 
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked_count
        FROM caregiver_access
        WHERE patient_id = ?
    `;
    
    return await get(sql, [patientId]);
}

// Get counts for a caregiver's patients
async function getPatientCountsForCaregiver(caregiverId) {
    const sql = `
        SELECT 
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
        FROM caregiver_access
        WHERE caregiver_id = ?
    `;
    
    return await get(sql, [caregiverId]);
}

// Re-invite a previously revoked caregiver
async function reInviteCaregiver(patientId, caregiverId, relationship) {
    const now = new Date().toISOString();
    
    // Check if there's a revoked or declined record
    const existing = await get(
        `SELECT * FROM caregiver_access 
         WHERE patient_id = ? AND caregiver_id = ? AND status IN ('revoked', 'declined')`,
        [patientId, caregiverId]
    );
    
    if (existing) {
        // Update the existing record back to pending
        const sql = `
            UPDATE caregiver_access 
            SET status = 'pending', relationship = ?, 
                revoked_at = NULL, accepted_at = NULL, updated_at = ?
            WHERE id = ?
        `;
        await run(sql, [relationship, now, existing.id]);
        return await getAccessById(existing.id);
    } else {
        // Create new record
        return await createAccess({ patientId, caregiverId, relationship });
    }
}

async function updateAssessmentPermission(accessId, patientId, canRunAssessments) {
    const now = new Date().toISOString();
    
    const access = await get(
        'SELECT * FROM caregiver_access WHERE id = ? AND patient_id = ?',
        [accessId, patientId]
    );
    
    if (!access) {
        throw new Error('Access record not found');
    }
    
    const sql = `
        UPDATE caregiver_access 
        SET can_run_assessments = ?, updated_at = ?
        WHERE id = ?
    `;
    
    await run(sql, [canRunAssessments ? 1 : 0, now, accessId]);
    
    return await getAccessById(accessId);
}

module.exports = {
    createAccess,
    getAccessById,
    getCaregiversForPatient,
    getPatientsForCaregiver,
    accessExists,
    activeOrPendingAccessExists,
    acceptAccess,
    declineAccess,
    revokeAccess,
    cancelAccess,
    updateRelationship,
    getCaregiverCountsForPatient,
    getPatientCountsForCaregiver,
    reInviteCaregiver,
    updateAssessmentPermission
};