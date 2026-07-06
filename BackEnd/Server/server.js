// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { runMigrations } = require('../DBMS/db/db');
const documentService = require('./services/documentService');
const userService = require('./services/userService');
const { requireRole } = require('../DBMS/middleware/auth');
const corsMiddleware = require('../DBMS/middleware/cors');

const auditService = require('./services/auditService');

// For disease category
const psiService = require('./services/psiService');
const diseaseService = require('./services/diseaseService');

// For risk assessment
const riskAssessmentService = require('./services/riskAssessmentService');

// For caregiver access
const caregiverAccessService = require('./services/caregiverAccessService');

// For system admin platform analytics
const platformAnalyticsService = require('./services/platformAnalyticsService');



const app = express();
const PORT = process.env.PORT || 3001;

// Apply CORS middleware FIRST
app.use(corsMiddleware);

// Run migrations at startup (safe no-op if already applied) - don't exit server
runMigrations(false);

// multer: memory storage to compute checksum then write via service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PrivaGene Document Storage API',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// ===================================
// SYSTEM ADMIN - PLATFORM ANALYTICS
// ===================================
app.get('/api/admin/platform-analytics', requireRole(['admin']), async (req, res) => {
  try {
    const analytics = await platformAnalyticsService.getPlatformAnalytics();
    return res.json({ success: true, analytics });
  } catch (err) {
    console.error('Platform analytics error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve platform analytics',
      message: err.message
    });
  }
});

// ===================================
// USER MANAGEMENT ENDPOINTS
// ===================================

// Register new user
app.post('/api/users/register', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'role']
      });
    }

    // Check if user already exists
    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: 'User already exists',
        email: email
      });
    }

    // Determine status based on role
    let status = 'active';
    if (role === 'hospital' || role === 'doctor' || role === 'admin' || role === 'hospital_admin') {
      status = 'pending_approval';
    }

    const userData = {
      ...req.body,
      status
    };

    const user = await userService.createUser(userData);

    // Log user registration
    await auditService.createLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { 
        accountStatus: status,
        message: status === 'pending_approval' 
          ? 'New user registered (pending approval)' 
          : 'New user registered'
      }
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      message: status === 'pending_approval'
        ? 'Registration successful. Awaiting admin approval.'
        : 'Registration successful.'
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      error: 'Registration failed',
      message: err.message
    });
  }
});

app.post('/api/users/login', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password']
      });
    }

    // SECURE: Use authenticateUser instead of manual password comparison
    let user;
    try {
      user = await userService.authenticateUser(email, password);
    } catch (authError) {
      // Handle specific authentication errors (deleted/suspended accounts)
      await auditService.createLog({
        userEmail: email,
        action: 'login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: authError.message }
      });
      return res.status(403).json({
        error: 'Authentication failed',
        message: authError.message
      });
    }

    if (!user) {
      // Either user doesn't exist OR password is wrong
      // Log failed login (don't reveal which one for security)
      await auditService.createLog({
        userEmail: email,
        action: 'login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'Invalid credentials' }
      });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password incorrect'
      });
    }

    // Check if user is approved
    if (user.status === 'pending_approval') {
      await auditService.createLog({
        userId: user.id,
        userEmail: email,
        userRole: user.role,
        action: 'login',
        status: 'failure',
        severity: 'info',
        ipAddress,
        userAgent,
        details: { reason: 'Account pending approval' }
      });
      return res.status(403).json({
        error: 'Account pending approval',
        message: 'Your account is awaiting admin approval'
      });
    }

    if (user.status !== 'active') {
      await auditService.createLog({
        userId: user.id,
        userEmail: email,
        userRole: user.role,
        action: 'login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'Account inactive/suspended' }
      });
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated'
      });
    }

    // Log successful login
    await auditService.createLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'login',
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { message: 'User logged in successfully' }
    });

    // Return user data (password_hash already excluded by authenticateUser)
    return res.json({
      success: true,
      user: user,
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: 'Login failed',
      message: err.message
    });
  }
});

// Change password for authenticated user
app.put('/api/users/:id/password', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['currentPassword', 'newPassword']
      });
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get user from database
    const user = await userService.getUserById(id);
    if (!user) {
      await auditService.createLog({
        userId: id,
        action: 'password_change',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'User not found' }
      });
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Verify current password using bcrypt
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      await auditService.createLog({
        userId: id,
        userEmail: user.email,
        userRole: user.role,
        action: 'password_change',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'Invalid current password' }
      });
      return res.status(401).json({
        error: 'Invalid current password',
        message: 'The current password you entered is incorrect'
      });
    }

    // Change password (will hash the new password)
    await userService.changePassword(id, newPassword);

    // Log successful password change
    await auditService.createLog({
      userId: id,
      userEmail: user.email,
      userRole: user.role,
      action: 'password_change',
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { message: 'Password changed successfully' }
    });

    return res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (err) {
    console.error('Password change error:', err);
    await auditService.createLog({
      userId: req.params.id,
      action: 'password_change',
      status: 'failure',
      severity: 'error',
      ipAddress,
      userAgent,
      details: { error: err.message }
    });
    return res.status(500).json({
      error: 'Failed to change password',
      message: err.message
    });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const { password: _, ...userData } = user;
    return res.json({
      success: true,
      user: userData
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve user',
      message: err.message
    });
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const { password: _, ...userData } = user;
    return res.json({
      success: true,
      user: userData,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({
      error: 'Failed to update user',
      message: err.message
    });
  }
});

// Delete user account
app.delete('/api/users/:id', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    // Get user info before deleting for logging
    const userToDelete = await userService.getUserById(req.params.id);
    
    await userService.deleteUser(req.params.id);

    // Log user deletion
    if (userToDelete) {
      await auditService.createLog({
        userEmail: userToDelete.email,
        userRole: userToDelete.role,
        action: 'user_deleted',
        resourceType: 'user',
        resourceId: req.params.id,
        status: 'success',
        severity: 'critical',
        ipAddress,
        userAgent,
        details: { 
          deletedUserEmail: userToDelete.email,
          deletedUserRole: userToDelete.role,
          message: 'User account deleted'
        }
      });
    }

    return res.json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({
      error: 'Failed to delete user',
      message: err.message
    });
  }
});

// Permanently delete user (hard delete) - Admin only, for GDPR compliance
app.delete('/api/users/:id/permanent', requireRole(['admin']), async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    // Get user info before deleting for logging
    const userToDelete = await userService.getUserById(req.params.id);
    
    if (!userToDelete) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Permanently delete from database
    await userService.hardDeleteUser(req.params.id);

    // Log permanent deletion
    await auditService.createLog({
      userEmail: userToDelete.email,
      userRole: userToDelete.role,
      action: 'user_permanently_deleted',
      resourceType: 'user',
      resourceId: req.params.id,
      status: 'success',
      severity: 'critical',
      ipAddress,
      userAgent,
      details: { 
        message: 'User permanently removed from database',
        deletedEmail: userToDelete.email,
        deletedRole: userToDelete.role
      }
    });

    return res.json({
      success: true,
      message: 'User permanently deleted'
    });
  } catch (err) {
    console.error('Permanent delete user error:', err);
    return res.status(500).json({
      error: 'Failed to permanently delete user',
      message: err.message
    });
  }
});

// List all users (with optional filters)
app.get('/api/users', async (req, res) => {
  try {
    const filters = {};
    if (req.query.role) filters.role = req.query.role;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.includeDeleted === 'true') filters.includeDeleted = true;

    const users = await userService.getUsers(filters);

    // Remove passwords from response
    const usersWithoutPasswords = users.map(({ password: _, ...user }) => user);

    return res.json({
      success: true,
      count: usersWithoutPasswords.length,
      users: usersWithoutPasswords
    });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve users',
      message: err.message
    });
  }
});

// Update user status (for admin approval)
app.patch('/api/users/:id/status', requireRole(['admin', 'system_admin']), async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const adminRole = req.context?.originalRole || 'system_admin';
  
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Missing status field'
      });
    }

    // Get user before update to know previous status
    const userBefore = await userService.getUserById(req.params.id);
    const user = await userService.updateUserStatus(req.params.id, status);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Determine action type based on status change
    let action = 'user_status_updated';
    let severity = 'info';
    if (status === 'active' && userBefore?.status === 'pending_approval') {
      action = 'user_approved';
    } else if (status === 'suspended') {
      action = 'user_suspended';
      severity = 'warning';
    } else if (status === 'active' && userBefore?.status === 'suspended') {
      action = 'user_activated';
    }

    // Log user status change
    await auditService.createLog({
      userRole: adminRole,
      action,
      resourceType: 'user',
      resourceId: req.params.id,
      status: 'success',
      severity,
      ipAddress,
      userAgent,
      details: { 
        targetUserEmail: user.email,
        targetUserRole: user.role,
        previousStatus: userBefore?.status,
        newStatus: status,
        message: `User status changed to ${status}`
      }
    });

    const { password: _, ...userData } = user;
    return res.json({
      success: true,
      user: userData,
      message: 'User status updated successfully'
    });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({
      error: 'Failed to update status',
      message: err.message
    });
  }
});


// ===================================
// ORGANIZATION MANAGEMENT ENDPOINTS
// ===================================

const organizationService = require('./services/organizationService');

// Get pending organization registrations (system_admin only)
app.get('/api/organizations/pending', requireRole(['admin', 'system_admin']), async (req, res) => {
    try {
        const pending = await organizationService.getPendingRegistrations();
        
        return res.json({
            success: true,
            count: pending.length,
            registrations: pending
        });
    } catch (err) {
        console.error('Get pending registrations error:', err);
        return res.status(500).json({
            error: 'Failed to retrieve pending registrations',
            message: err.message
        });
    }
});

// Get all active organizations (system_admin only)
app.get('/api/organizations', requireRole(['admin', 'system_admin']), async (req, res) => {
    try {
        const organizations = await organizationService.getActiveOrganizations();
        
        return res.json({
            success: true,
            count: organizations.length,
            organizations
        });
    } catch (err) {
        console.error('Get organizations error:', err);
        return res.status(500).json({
            error: 'Failed to retrieve organizations',
            message: err.message
        });
    }
});

// Get organization statistics (system_admin only)
app.get('/api/organizations/statistics', requireRole(['admin', 'system_admin']), async (req, res) => {
    try {
        const statistics = await organizationService.getOrganizationStatistics();
        
        return res.json({
            success: true,
            statistics
        });
    } catch (err) {
        console.error('Get organization statistics error:', err);
        return res.status(500).json({
            error: 'Failed to retrieve organization statistics',
            message: err.message
        });
    }
});

// Get organization details by name (system_admin only)
app.get('/api/organizations/:name', requireRole(['admin', 'system_admin']), async (req, res) => {
    try {
        const orgName = decodeURIComponent(req.params.name);
        const organization = await organizationService.getOrganizationByName(orgName);
        
        if (!organization) {
            return res.status(404).json({
                error: 'Organization not found'
            });
        }
        
        return res.json({
            success: true,
            organization
        });
    } catch (err) {
        console.error('Get organization error:', err);
        return res.status(500).json({
            error: 'Failed to retrieve organization',
            message: err.message
        });
    }
});

// Approve organization registration (system_admin only)
app.post('/api/organizations/approve/:userId', requireRole(['admin', 'system_admin']), async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const adminRole = req.context?.originalRole || 'system_admin';
    
    try {
        const { userId } = req.params;
        
        // Get user before approval for logging
        const userBefore = await userService.getUserById(userId);
        if (!userBefore) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        if (userBefore.status !== 'pending_approval') {
            return res.status(400).json({
                error: 'User is not pending approval',
                currentStatus: userBefore.status
            });
        }
        
        const user = await organizationService.approveRegistration(userId);
        
        // Log the approval
        await auditService.createLog({
            userRole: adminRole,
            action: 'organization_approved',
            resourceType: 'organization',
            resourceId: userId,
            status: 'success',
            severity: 'info',
            ipAddress,
            userAgent,
            details: {
                approvedUserEmail: user.email,
                approvedUserRole: user.role,
                organizationName: user.organization_name,
                message: 'Organization registration approved'
            }
        });
        
        const { password: _, ...userData } = user;
        return res.json({
            success: true,
            user: userData,
            message: 'Organization registration approved successfully'
        });
    } catch (err) {
        console.error('Approve registration error:', err);
        return res.status(500).json({
            error: 'Failed to approve registration',
            message: err.message
        });
    }
});

// Reject organization registration (system_admin only)
app.delete('/api/organizations/reject/:userId', requireRole(['admin', 'system_admin']), async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const adminRole = req.context?.originalRole || 'system_admin';
    
    try {
        const { userId } = req.params;
        
        // Get user before rejection for logging
        const userBefore = await userService.getUserById(userId);
        if (!userBefore) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        if (userBefore.status !== 'pending_approval') {
            return res.status(400).json({
                error: 'User is not pending approval',
                currentStatus: userBefore.status
            });
        }
        
        await organizationService.rejectRegistration(userId);
        
        // Log the rejection
        await auditService.createLog({
            userRole: adminRole,
            action: 'organization_rejected',
            resourceType: 'organization',
            resourceId: userId,
            status: 'success',
            severity: 'warning',
            ipAddress,
            userAgent,
            details: {
                rejectedUserEmail: userBefore.email,
                rejectedUserRole: userBefore.role,
                organizationName: userBefore.organization_name,
                message: 'Organization registration rejected'
            }
        });
        
        return res.json({
            success: true,
            message: 'Organization registration rejected'
        });
    } catch (err) {
        console.error('Reject registration error:', err);
        return res.status(500).json({
            error: 'Failed to reject registration',
            message: err.message
        });
    }
});

// Suspend an entire organization (system_admin only)
app.post('/api/organizations/:name/suspend', requireRole(['admin', 'system_admin']), async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const adminRole = req.context?.originalRole || 'system_admin';
    
    try {
        const orgName = decodeURIComponent(req.params.name);
        const suspendedCount = await organizationService.suspendOrganization(orgName);
        
        // Log the suspension
        await auditService.createLog({
            userRole: adminRole,
            action: 'organization_suspended',
            resourceType: 'organization',
            resourceId: orgName,
            status: 'success',
            severity: 'warning',
            ipAddress,
            userAgent,
            details: {
                organizationName: orgName,
                usersAffected: suspendedCount,
                message: 'Organization suspended'
            }
        });
        
        return res.json({
            success: true,
            message: `Organization suspended. ${suspendedCount} user(s) affected.`,
            usersAffected: suspendedCount
        });
    } catch (err) {
        console.error('Suspend organization error:', err);
        return res.status(500).json({
            error: 'Failed to suspend organization',
            message: err.message
        });
    }
});

// Activate an organization (system_admin only)
app.post('/api/organizations/:name/activate', requireRole(['admin', 'system_admin']), async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const adminRole = req.context?.originalRole || 'system_admin';
    
    try {
        const orgName = decodeURIComponent(req.params.name);
        const activatedCount = await organizationService.activateOrganization(orgName);
        
        // Log the activation
        await auditService.createLog({
            userRole: adminRole,
            action: 'organization_activated',
            resourceType: 'organization',
            resourceId: orgName,
            status: 'success',
            severity: 'info',
            ipAddress,
            userAgent,
            details: {
                organizationName: orgName,
                usersAffected: activatedCount,
                message: 'Organization activated'
            }
        });
        
        return res.json({
            success: true,
            message: `Organization activated. ${activatedCount} user(s) affected.`,
            usersAffected: activatedCount
        });
    } catch (err) {
        console.error('Activate organization error:', err);
        return res.status(500).json({
            error: 'Failed to activate organization',
            message: err.message
        });
    }
});

// ===================================
// DOCUMENT MANAGEMENT ENDPOINTS
// ===================================


// Upload result (patient or researcher uploads analysis files)
// Required headers: X-Role (must be 'patient' or 'researcher' or 'doctor'), X-Session-ID (session linkage)
app.post('/api/documents/upload', requireRole(['patient', 'researcher', 'doctor', 'admin']), upload.single('file'), async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        hint: 'Use multipart/form-data with field name "file"'
      });
    }

    const sessionId = req.context.sessionId || req.body.session_id;
    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID required',
        hint: 'Include X-Session-ID header or session_id form field'
      });
    }

    const result = await documentService.storeFileFromBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, sessionId);
    
    // Log document upload (gene file upload)
    await auditService.createLog({
      userRole: req.context.originalRole || req.context.role,
      action: 'upload_gene',
      resourceType: 'document',
      resourceId: result.id,
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      sessionId,
      details: { 
        fileName: result.fileName,
        fileSize: result.size,
        fileType: req.file.mimetype,
        message: 'Gene file uploaded successfully'
      }
    });
    
    return res.json({
      success: true,
      id: result.id,
      fileName: result.fileName,
      size: result.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({
      error: 'Failed to upload document',
      message: err.message
    });
  }
});

// List documents for a session (doctor/researcher)
app.get('/api/documents', requireRole(['doctor', 'researcher', 'admin']), async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.context.sessionId;
    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID required',
        hint: 'Include session_id query parameter or X-Session-ID header'
      });
    }

    const rows = await documentService.listDocumentsBySession(sessionId);
    return res.json({
      success: true,
      count: rows.length,
      documents: rows
    });
  } catch (err) {
    console.error('List error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve documents',
      message: err.message
    });
  }
});

// Download document by id (doctor/researcher)
app.get('/api/documents/:id/download', requireRole(['doctor', 'researcher', 'admin', 'patient']), async (req, res) => {
  try {
    const id = req.params.id;
    const meta = await documentService.getDocumentMeta(id);

    if (!meta) {
      return res.status(404).json({
        error: 'Document not found',
        documentId: id
      });
    }

    // Optionally enforce session header matches meta.session_id for extra safety
    const sessionId = req.context.sessionId;
    if (sessionId && sessionId !== meta.session_id) {
      return res.status(403).json({
        error: 'Access denied - session mismatch',
        hint: 'You can only access documents from your own session'
      });
    }

    return documentService.streamDocumentFile(res, meta.storage_path, meta.file_name);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({
      error: 'Failed to download document',
      message: err.message
    });
  }
});

// Delete document (admin only)
app.delete('/api/documents/:id', requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const ok = await documentService.deleteDocument(id);

    if (!ok) {
      return res.status(404).json({
        error: 'Document not found',
        documentId: id
      });
    }

    return res.json({
      success: true,
      message: 'Document deleted successfully',
      documentId: id
    });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({
      error: 'Failed to delete document',
      message: err.message
    });
  }
});


// ===================================
// HOSPITAL SPECIALIST MANAGEMENT ENDPOINTS
// ===================================

// Create hospital specialist account (hospital_admin only)
app.post('/api/users/create-hospital-specialist', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      phone, 
      licenseNumber, 
      organizationName 
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !phone || !licenseNumber || !organizationName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['email', 'password', 'firstName', 'lastName', 'phone', 'licenseNumber', 'organizationName']
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    const emailExists = await userService.emailExists(email);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        message: 'An account with this email address already exists'
      });
    }

    // Check if license number already exists
    const licenseExists = await userService.licenseNumberExists(licenseNumber);
    if (licenseExists) {
      return res.status(409).json({
        success: false,
        error: 'License number already registered',
        message: 'An account with this license number already exists'
      });
    }

    // Create the hospital specialist user
    const userData = {
      email,
      password,
      role: 'hospital',  // This is the role for hospital specialists
      firstName,
      lastName,
      phone,
      licenseNumber,
      organizationName,
      status: 'active',  // Specialists created by admin are active immediately
      researchConsent: false
    };

    const user = await userService.createUser(userData);

    // Log the creation
    await auditService.createLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'hospital_specialist_created',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { 
        organizationName,
        createdByRole: 'hospital_admin',
        message: `Hospital specialist account created for ${firstName} ${lastName}`
      }
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName,
        lastName,
        organizationName,
        status: user.status
      },
      message: 'Hospital specialist account created successfully'
    });

  } catch (err) {
    console.error('Create hospital specialist error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create hospital specialist account',
      message: err.message
    });
  }
});

// Get hospital specialists by organization name
app.get('/api/users/hospital-specialists/:organizationName', async (req, res) => {
  try {
    const { organizationName } = req.params;

    if (!organizationName) {
      return res.status(400).json({
        success: false,
        error: 'Organization name is required'
      });
    }

    const specialists = await userService.getHospitalSpecialistsByOrganization(
      decodeURIComponent(organizationName)
    );

    // Remove passwords from response
    const specialistsWithoutPasswords = specialists.map(({ password: _, ...specialist }) => specialist);

    return res.json({
      success: true,
      count: specialistsWithoutPasswords.length,
      specialists: specialistsWithoutPasswords
    });

  } catch (err) {
    console.error('Get hospital specialists error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve hospital specialists',
      message: err.message
    });
  }
});

// Check if email exists (utility endpoint)
app.get('/api/users/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const exists = await userService.emailExists(decodeURIComponent(email));

    return res.json({
      success: true,
      exists
    });
  } catch (err) {
    console.error('Check email error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to check email',
      message: err.message
    });
  }
});

// Check if license number exists (utility endpoint)
app.get('/api/users/check-license/:licenseNumber', async (req, res) => {
  try {
    const { licenseNumber } = req.params;
    const exists = await userService.licenseNumberExists(decodeURIComponent(licenseNumber));

    return res.json({
      success: true,
      exists
    });
  } catch (err) {
    console.error('Check license error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to check license number',
      message: err.message
    });
  }
});

// ===================================
// DISEASE BY ORGANIZATION ENDPOINTS
// ===================================

// Get all diseases for an organization (for hospital_admin view)
// This fetches all diseases created by hospital specialists belonging to the same organization
app.get('/api/diseases/by-organization/:organizationName', async (req, res) => {
  try {
    const { organizationName } = req.params;

    if (!organizationName) {
      return res.status(400).json({
        error: 'Organization name is required'
      });
    }

    const diseases = await diseaseService.getDiseasesByOrganization(
      decodeURIComponent(organizationName)
    );

    return res.json({
      success: true,
      count: diseases.length,
      diseases
    });
  } catch (err) {
    console.error('Get diseases by organization error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve diseases',
      message: err.message
    });
  }
});

// Search diseases within an organization
app.get('/api/diseases/by-organization/:organizationName/search', async (req, res) => {
  try {
    const { organizationName } = req.params;
    const { q } = req.query;

    if (!organizationName) {
      return res.status(400).json({
        error: 'Organization name is required'
      });
    }

    let diseases;
    if (!q) {
      // If no search term, return all diseases for the organization
      diseases = await diseaseService.getDiseasesByOrganization(
        decodeURIComponent(organizationName)
      );
    } else {
      diseases = await diseaseService.searchDiseasesByOrganization(
        decodeURIComponent(organizationName),
        q
      );
    }

    return res.json({
      success: true,
      count: diseases.length,
      diseases
    });
  } catch (err) {
    console.error('Search diseases by organization error:', err);
    return res.status(500).json({
      error: 'Failed to search diseases',
      message: err.message
    });
  }
});

// Get disease count for a specific hospital specialist
app.get('/api/diseases/specialist-count/:hospitalId', async (req, res) => {
  try {
    const { hospitalId } = req.params;

    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital specialist ID is required'
      });
    }

    const count = await diseaseService.getDiseaseCountBySpecialist(hospitalId);

    return res.json({
      success: true,
      count
    });
  } catch (err) {
    console.error('Get specialist disease count error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve disease count',
      message: err.message
    });
  }
});

// Get total disease count for an organization
app.get('/api/diseases/organization-count/:organizationName', async (req, res) => {
  try {
    const { organizationName } = req.params;

    if (!organizationName) {
      return res.status(400).json({
        error: 'Organization name is required'
      });
    }

    const count = await diseaseService.getDiseaseCountByOrganization(
      decodeURIComponent(organizationName)
    );

    return res.json({
      success: true,
      count
    });
  } catch (err) {
    console.error('Get organization disease count error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve organization disease count',
      message: err.message
    });
  }
});

// Get recently uploaded/updated diseases by organization
app.get('/api/diseases/recent/:organizationName', async (req, res) => {
  try {
    const { organizationName } = req.params;
    const { days } = req.query;

    if (!organizationName) {
      return res.status(400).json({
        error: 'Organization name is required'
      });
    }

    const daysNum = days ? parseInt(days) : 3;
    const diseases = await diseaseService.getRecentDiseasesByOrganization(
      decodeURIComponent(organizationName),
      daysNum
    );

    return res.json({
      success: true,
      count: diseases.length,
      diseases
    });
  } catch (err) {
    console.error('Get recent diseases error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve recent diseases',
      message: err.message
    });
  }
});

// ===================================
// RESEARCHER ANALYTICS ENDPOINTS (WITH ROLE PROTECTION)
// ===================================

// Get disease statistics for researchers (from consented users only)
app.get('/api/researcher/disease-statistics', requireRole(['researcher', 'admin']), async (req, res) => {
  try {
    const { search } = req.query;
    
    let stats;
    if (search && search.trim()) {
      stats = await riskAssessmentService.searchDiseaseStatistics(search.trim());
    } else {
      stats = await riskAssessmentService.getDiseaseStatisticsForResearch();
    }

    return res.json({
      success: true,
      count: stats.length,
      diseases: stats
    });
  } catch (err) {
    console.error('Get disease statistics error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve disease statistics',
      message: err.message
    });
  }
});

// Get detailed analytics for a specific disease (from consented users only)
app.get('/api/researcher/disease-analytics/:diseaseId', requireRole(['researcher', 'admin']), async (req, res) => {
  try {
    const { diseaseId } = req.params;
    
    const analytics = await riskAssessmentService.getDiseaseAnalytics(diseaseId);
    
    if (!analytics) {
      return res.status(404).json({
        error: 'Disease not found'
      });
    }

    return res.json({
      success: true,
      analytics
    });
  } catch (err) {
    console.error('Get disease analytics error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve disease analytics',
      message: err.message
    });
  }
});

// Get recent assessments for researcher dashboard
app.get('/api/researcher/recent-assessments', requireRole(['researcher', 'admin']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const assessments = await riskAssessmentService.getRecentAssessmentsForResearcher(limit);

    return res.json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (err) {
    console.error('Get recent assessments error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve recent assessments',
      message: err.message
    });
  }
});

// Get all assessments from consented users (for aggregate statistics)
app.get('/api/researcher/consented-assessments', requireRole(['researcher', 'admin']), async (req, res) => {
  try {
    const assessments = await riskAssessmentService.getConsentedAssessments();

    return res.json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (err) {
    console.error('Get consented assessments error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve consented assessments',
      message: err.message
    });
  }
});

// ===================================
// CAREGIVER ACCESS ENDPOINTS
// ===================================

// Check if a caregiver exists by email (for patient to validate before sending invitation)
app.get('/api/caregiver-access/check-caregiver', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    const user = await userService.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        found: false,
        message: 'We could not find any caregivers with that email. Please check that your entered email is correct.'
      });
    }

    if (user.role !== 'caregiver') {
      return res.status(404).json({
        success: false,
        found: false,
        message: 'We could not find any caregivers with that email. Please check that your entered email is correct.'
      });
    }

    // Return basic caregiver info (no sensitive data)
    return res.json({
      success: true,
      found: true,
      caregiver: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (err) {
    console.error('Check caregiver error:', err);
    return res.status(500).json({
      error: 'Failed to check caregiver',
      message: err.message
    });
  }
});

// Create a new caregiver access invitation (patient invites caregiver)
app.post('/api/caregiver-access/invite', async (req, res) => {
  try {
    const { patientId, caregiverEmail, relationship } = req.body;

    if (!patientId || !caregiverEmail || !relationship) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['patientId', 'caregiverEmail', 'relationship']
      });
    }

    // Find caregiver by email
    const caregiver = await userService.getUserByEmail(caregiverEmail);

    if (!caregiver || caregiver.role !== 'caregiver') {
      return res.status(404).json({
        error: 'Caregiver not found',
        message: 'We could not find any caregivers with that email. Please check that your entered email is correct.'
      });
    }

    // Check if active or pending access already exists
    const existingAccess = await caregiverAccessService.activeOrPendingAccessExists(patientId, caregiver.id);

    if (existingAccess) {
      return res.status(409).json({
        error: 'Access already exists',
        message: existingAccess.status === 'pending' 
          ? 'An invitation is already pending for this caregiver'
          : 'This caregiver already has active access to your data'
      });
    }

    // Check if there's a revoked/declined record that can be re-invited
    const previousAccess = await caregiverAccessService.accessExists(patientId, caregiver.id);

    let access;
    if (previousAccess && (previousAccess.status === 'revoked' || previousAccess.status === 'declined')) {
      // Re-invite
      access = await caregiverAccessService.reInviteCaregiver(patientId, caregiver.id, relationship);
    } else {
      // Create new
      access = await caregiverAccessService.createAccess({
        patientId,
        caregiverId: caregiver.id,
        relationship
      });
    }

    return res.status(201).json({
      success: true,
      access: {
        ...access,
        caregiverEmail: caregiver.email,
        caregiverName: `${caregiver.first_name} ${caregiver.last_name}`
      },
      message: 'Invitation sent successfully'
    });
  } catch (err) {
    console.error('Create caregiver access error:', err);
    return res.status(500).json({
      error: 'Failed to create invitation',
      message: err.message
    });
  }
});

// Get all caregivers for a patient
app.get('/api/caregiver-access/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;

    const caregivers = await caregiverAccessService.getCaregiversForPatient(patientId, status);
    const counts = await caregiverAccessService.getCaregiverCountsForPatient(patientId);

    return res.json({
      success: true,
      counts,
      caregivers
    });
  } catch (err) {
    console.error('Get caregivers for patient error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve caregivers',
      message: err.message
    });
  }
});

// Get all patients for a caregiver
app.get('/api/caregiver-access/caregiver/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const { status } = req.query;

    const patients = await caregiverAccessService.getPatientsForCaregiver(caregiverId, status);
    const counts = await caregiverAccessService.getPatientCountsForCaregiver(caregiverId);

    return res.json({
      success: true,
      counts,
      patients
    });
  } catch (err) {
    console.error('Get patients for caregiver error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve patients',
      message: err.message
    });
  }
});

// Accept an invitation (caregiver accepts)
app.post('/api/caregiver-access/:accessId/accept', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { caregiverId } = req.body;

    if (!caregiverId) {
      return res.status(400).json({
        error: 'Caregiver ID is required'
      });
    }

    const access = await caregiverAccessService.acceptAccess(accessId, caregiverId);

    return res.json({
      success: true,
      access,
      message: 'Invitation accepted successfully'
    });
  } catch (err) {
    console.error('Accept invitation error:', err);
    return res.status(400).json({
      error: 'Failed to accept invitation',
      message: err.message
    });
  }
});

// Decline an invitation (caregiver declines)
app.post('/api/caregiver-access/:accessId/decline', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { caregiverId } = req.body;

    if (!caregiverId) {
      return res.status(400).json({
        error: 'Caregiver ID is required'
      });
    }

    const access = await caregiverAccessService.declineAccess(accessId, caregiverId);

    return res.json({
      success: true,
      access,
      message: 'Invitation declined'
    });
  } catch (err) {
    console.error('Decline invitation error:', err);
    return res.status(400).json({
      error: 'Failed to decline invitation',
      message: err.message
    });
  }
});

// Revoke access (patient revokes)
app.post('/api/caregiver-access/:accessId/revoke', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'Patient ID is required'
      });
    }

    const access = await caregiverAccessService.revokeAccess(accessId, patientId);

    return res.json({
      success: true,
      access,
      message: 'Access revoked successfully'
    });
  } catch (err) {
    console.error('Revoke access error:', err);
    return res.status(400).json({
      error: 'Failed to revoke access',
      message: err.message
    });
  }
});

// Cancel a pending invitation (patient cancels)
app.delete('/api/caregiver-access/:accessId', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'Patient ID is required'
      });
    }

    const result = await caregiverAccessService.cancelAccess(accessId, patientId);

    return res.json({
      success: true,
      ...result,
      message: 'Invitation cancelled successfully'
    });
  } catch (err) {
    console.error('Cancel invitation error:', err);
    return res.status(400).json({
      error: 'Failed to cancel invitation',
      message: err.message
    });
  }
});

// Get patient's risk assessments for caregiver view (limited data)
app.get('/api/caregiver-access/patient/:patientId/assessments', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { caregiverId } = req.query;

    if (!caregiverId) {
      return res.status(400).json({
        error: 'Caregiver ID is required'
      });
    }

    // Verify the caregiver has active access to this patient
    const patients = await caregiverAccessService.getPatientsForCaregiver(caregiverId, 'active');
    const hasAccess = patients.some(p => p.patient_id === patientId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this patient\'s data'
      });
    }

    // UPDATED: Use caregiver-safe method that excludes matched_genes
    const assessments = await riskAssessmentService.getAssessmentsByUserForCaregiver(patientId);

    return res.json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (err) {
    console.error('Get patient assessments for caregiver error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve assessments',
      message: err.message
    });
  }
});

// Get comprehensive patient data for caregiver view (patient info + access record + assessments + diseases)
app.get('/api/caregiver-access/patient/:patientId/full-view', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { caregiverId } = req.query;

    if (!caregiverId) {
      return res.status(400).json({
        error: 'Caregiver ID is required'
      });
    }

    // Verify the caregiver has active access to this patient
    const patients = await caregiverAccessService.getPatientsForCaregiver(caregiverId, 'active');
    const accessRecord = patients.find(p => p.patient_id === patientId);

    if (!accessRecord) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this patient\'s data'
      });
    }

    // Get patient info (excluding sensitive fields)
    const patient = await userService.getUserById(patientId);
    if (!patient) {
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    // Remove sensitive info from patient data
    const { password, ...patientData } = patient;

    // UPDATED: Use caregiver-safe method that excludes matched_genes for privacy protection
    const assessments = await riskAssessmentService.getAssessmentsByUserForCaregiver(patientId);
    
    // Log that caregiver accessed patient data (for audit trail)
    console.log(`Caregiver ${caregiverId} accessed patient ${patientId} data (${assessments.length} assessments, matched_genes excluded for privacy)`);

    // Get all diseases for reference (to show disease names and hospital info)
    const diseases = await diseaseService.getAllDiseases();

    return res.json({
      success: true,
      patient: {
        id: patientData.id,
        firstName: patientData.first_name,
        lastName: patientData.last_name,
        email: patientData.email
      },
      accessRecord: {
        id: accessRecord.id,
        relationship: accessRecord.relationship,
        status: accessRecord.status,
        createdAt: accessRecord.created_at,
        acceptedAt: accessRecord.accepted_at
      },
      // Return caregiver-safe assessments WITHOUT matched_genes
      assessments: assessments,
      diseases: diseases.map(d => ({
        id: d.id,
        name: d.disease_name,
        code: d.disease_code,
        description: d.description,
        hospitalId: d.hospital_id,
        hospitalName: d.hospital_name || d.organization_name || 'Unknown Hospital'
      }))
    });
  } catch (err) {
    console.error('Get patient full view error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve patient data',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`PrivaGene DB service running on http://localhost:${PORT}`);
});

app.patch('/api/caregiver-access/:accessId/assessment-permission', async (req, res) => {
    try {
        const { accessId } = req.params;
        const { canRunAssessments } = req.body;
        const patientId = req.headers['x-user-id'];

        if (!patientId) {
            return res.status(401).json({ error: 'User ID not provided' });
        }

        if (typeof canRunAssessments !== 'boolean') {
            return res.status(400).json({ 
                error: 'Invalid permission value',
                message: 'canRunAssessments must be true or false'
            });
        }

        const updatedAccess = await caregiverAccessService.updateAssessmentPermission(
            accessId,
            patientId,
            canRunAssessments
        );

        console.log(`Patient ${patientId} ${canRunAssessments ? 'granted' : 'revoked'} assessment permission for access ${accessId}`);

        res.json({
            success: true,
            access: updatedAccess,
            message: `Assessment permission ${canRunAssessments ? 'granted' : 'revoked'}`
        });

    } catch (error) {
        console.error('Error updating assessment permission:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to update assessment permission' 
        });
    }
});

// ===================================
// RESEARCHER DATASETS ENDPOINTS
// ===================================

// Get anonymized assessments for datasets export (includes age data but no PII)
app.get('/api/researcher/datasets/assessments', async (req, res) => {
  try {
    const assessments = await riskAssessmentService.getAnonymizedAssessmentsForDatasets();

    return res.json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (err) {
    console.error('Get dataset assessments error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve dataset assessments',
      message: err.message
    });
  }
});

// Get complete disease statistics with all metrics for datasets
app.get('/api/researcher/datasets/disease-stats', async (req, res) => {
  try {
    const stats = await riskAssessmentService.getCompleteDiseaseStatisticsForDatasets();

    return res.json({
      success: true,
      count: stats.length,
      diseases: stats
    });
  } catch (err) {
    console.error('Get dataset disease stats error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve disease statistics',
      message: err.message
    });
  }
});

// Get monthly trends for datasets
app.get('/api/researcher/datasets/trends', async (req, res) => {
  try {
    const trends = await riskAssessmentService.getMonthlyTrendsForDatasets();

    return res.json({
      success: true,
      count: trends.length,
      trends
    });
  } catch (err) {
    console.error('Get dataset trends error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve trends',
      message: err.message
    });
  }
});

// Get aggregated statistics for datasets
app.get('/api/researcher/datasets/aggregate-stats', async (req, res) => {
  try {
    const stats = await riskAssessmentService.getAggregateStatisticsForDatasets();

    return res.json({
      success: true,
      statistics: stats
    });
  } catch (err) {
    console.error('Get aggregate stats error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve aggregate statistics',
      message: err.message
    });
  }
});


/**
 * Caregiver runs risk assessment on behalf of patient
 * POST /api/caregiver/run-assessment
 */
app.post('/api/caregiver/run-assessment', async (req, res) => {
    try {
        const { patientId, diseaseId, matchCount, matchedGenes, riskPercentage } = req.body;
        const caregiverId = req.headers['x-user-id'];

        if (!caregiverId) {
            return res.status(401).json({ error: 'User ID not provided' });
        }

        // Verify caregiver has active access to this patient
        const access = await caregiverAccessService.activeOrPendingAccessExists(patientId, caregiverId);
        
        if (!access || access.status !== 'active') {
            return res.status(403).json({ error: 'You do not have active access to this patient' });
        }

        // After verifying active access, add this:
        if (!access.can_run_assessments) {
            return res.status(403).json({ 
                error: 'Permission denied',
                message: 'The patient has not granted you permission to run assessments. Please ask them to enable this permission in their Family Access settings.'
            });
        }

        // Create risk assessment for the patient (not the caregiver)
        const assessment = await riskAssessmentService.createAssessment({
            userId: patientId,  // Store under patient's ID
            diseaseId,
            overallRisk: riskPercentage,
            matchCount,
            matchedGenes,
            riskPercentage
        });

        console.log(`Caregiver ${caregiverId} ran assessment for patient ${patientId}, disease ${diseaseId}`);

        res.json({ 
            success: true, 
            assessment,
            message: 'Risk assessment completed for patient'
        });

    } catch (error) {
        console.error('Error in caregiver run assessment:', error);
        res.status(500).json({ error: error.message || 'Failed to run assessment' });
    }
});

/**
 * Verify caregiver has active access to patient
 * GET /api/caregiver/verify-access/:patientId
 */
app.get('/api/caregiver/verify-access/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const caregiverId = req.headers['x-user-id'];

        if (!caregiverId) {
            return res.status(401).json({ error: 'User ID not provided' });
        }

        const access = await caregiverAccessService.activeOrPendingAccessExists(patientId, caregiverId);
        
        if (!access || access.status !== 'active') {
            return res.json({ hasAccess: false });
        }

        res.json({ 
            hasAccess: true,
            relationship: access.relationship,
            acceptedAt: access.accepted_at
        });

    } catch (error) {
        console.error('Error verifying caregiver access:', error);
        res.status(500).json({ error: 'Failed to verify access' });
    }
});

// ===================================
// DISEASE CATEGORY ENDPOINTS
// ===================================

// Returns disease info WITHOUT gene symbols for privacy
app.get('/api/disease-categories', async (req, res) => {
    try {
        // Get all diseases from database with hospital names
        const diseases = await diseaseService.getAllDiseasesWithHospitalNames();
        
        // Strip out sensitive gene information before sending to frontend
        const safeCategories = diseases.map(disease => ({
            id: disease.id,
            name: disease.disease_name,
            description: disease.description || '',
            hospitalId: disease.hospital_id,
            hospitalName: disease.hospital_name || 'Unknown Hospital',
            diseaseCode: disease.disease_code,
            createdAt: disease.created_at
        }));
        
        res.json(safeCategories);
    } catch (error) {
        console.error('Error fetching disease categories:', error);
        res.status(500).json({ error: 'Failed to fetch disease categories' });
    }
});

// ===================================
// PSI COMPUTATION ENDPOINT
// ===================================

// Backend PSI computation
// POST /api/backend_psi - PSI computation endpoint
app.post('/api/backend_psi', async (req, res) => {
    try {
        const { blinded_patient, disease } = req.body;

        console.log('PSI Request received:');
        console.log('  - Disease ID:', disease);
        console.log('  - Blinded patient values:', blinded_patient?.length || 0);

        // Validate input
        if (!blinded_patient || !Array.isArray(blinded_patient)) {
            return res.status(400).json({ error: 'Missing or invalid blinded_patient array' });
        }

        if (!disease) {
            return res.status(400).json({ error: 'Missing disease ID' });
        }

        // ============================================
        // Fetch disease genes from DATABASE
        // ============================================
        const diseaseData = await diseaseService.getDiseaseById(disease);
        
        if (!diseaseData) {
            console.error('Disease not found:', disease);
            return res.status(404).json({ error: `Disease not found: ${disease}` });
        }

        // Get the gene symbols array from the database result
        const diseaseGenes = diseaseData.gene_symbols;
        
        if (!diseaseGenes || diseaseGenes.length === 0) {
            console.error('No genes found for disease:', disease);
            return res.status(404).json({ error: 'No genes found for this disease' });
        }

        console.log('  - Disease genes loaded from database:', diseaseGenes.length, 'genes');

        // Run PSI computation with gene symbols
        const result = psiService.compute(blinded_patient, diseaseGenes);

        console.log('PSI computation completed successfully');
        
        res.json(result);

    } catch (error) {
        console.error('PSI computation error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'PSI computation failed: ' + error.message });
    }
});

// ===================================
// PSI RISK CALCULATION ENDPOINT
// ===================================

// POST /api/psi/calculate-risk - Calculate risk percentage using disease constant
app.post('/api/psi/calculate-risk', async (req, res) => {
    try {
        const { diseaseId, matchedCount, totalDiseaseGenes } = req.body;

        console.log('Risk calculation request:');
        console.log('  - Disease ID:', diseaseId);
        console.log('  - Matched count:', matchedCount);
        console.log('  - Total disease genes:', totalDiseaseGenes);

        // Validate input
        if (!diseaseId) {
            return res.status(400).json({ error: 'Missing diseaseId' });
        }

        if (matchedCount === undefined || totalDiseaseGenes === undefined) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['diseaseId', 'matchedCount', 'totalDiseaseGenes']
            });
        }

        // Get disease from database to retrieve constant
        const disease = await diseaseService.getDiseaseById(diseaseId);

        if (!disease) {
            return res.status(404).json({ error: `Disease not found: ${diseaseId}` });
        }

        // Get the constant value (default to 100 if not set)
        const constant = disease.constant !== undefined ? disease.constant : 100;

        console.log('  - Disease constant:', constant);

        // Calculate risk percentage: |matchedCount / totalDiseaseGenes| * constant
        let percentage = 0;
        if (totalDiseaseGenes > 0) {
            percentage = Math.abs(matchedCount / totalDiseaseGenes) * constant;
        }

        // Cap at 100% maximum
        //percentage = Math.min(percentage, 100);

        console.log('  - Calculated risk percentage:', percentage.toFixed(2) + '%');

        return res.json({
            success: true,
            diseaseId,
            constant,
            matchedCount,
            totalDiseaseGenes,
            riskPercentage: percentage
        });

    } catch (error) {
        console.error('Risk calculation error:', error);
        return res.status(500).json({ 
            error: 'Risk calculation failed',
            message: error.message 
        });
    }
});

// ===================================
// RISK ASSESSMENT STORAGE
// ===================================

// Create (store) risk assessment results
app.post('/api/risk-assessments', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    const { userId, overallRisk, diseaseId, matchCount, matchedGenes, riskPercentage } = req.body;

    if (!userId || overallRisk === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'overallRisk']
      });
    }

    // Get user info for logging
    const user = await userService.getUserById(userId);

    // Store in database using service
    const assessment = await riskAssessmentService.createAssessment({
      userId,
      overallRisk,
      diseaseId,
      matchCount,
      matchedGenes,
      riskPercentage
    });

    console.log('Risk assessment stored in database:', assessment.id);

    // Log risk computation
    await auditService.createLog({
      userId,
      userEmail: user?.email,
      userRole: user?.role || 'patient',
      action: 'compute_risk',
      resourceType: 'risk_assessment',
      resourceId: assessment.id,
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { 
        diseaseId, 
        riskPercentage: riskPercentage || overallRisk,
        matchCount: matchCount || 0,
        message: 'Risk assessment computed and stored'
      }
    });

    return res.status(201).json({
      success: true,
      assessment
    });
  } catch (err) {
    console.error('Store assessment error:', err);
    return res.status(500).json({
      error: 'Failed to store assessment',
      message: err.message
    });
  }
});

// Get all risk assessments for a user
app.get('/api/risk-assessments/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Query from database
    const assessments = await riskAssessmentService.getAssessmentsByUser(userId);

    console.log(`Retrieved ${assessments.length} assessments for user ${userId}`);

    return res.json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (err) {
    console.error('Get assessments error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve assessments',
      message: err.message
    });
  }
});

// Get a specific assessment by ID
app.get('/api/risk-assessments/assessment/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await riskAssessmentService.getAssessmentById(assessmentId);

    if (!assessment) {
      return res.status(404).json({
        error: 'Assessment not found'
      });
    }

    return res.json({
      success: true,
      assessment
    });
  } catch (err) {
    console.error('Get assessment error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve assessment',
      message: err.message
    });
  }
});

// Delete an assessment
app.delete('/api/risk-assessments/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const deleted = riskAssessmentService.deleteAssessment(assessmentId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Assessment not found'
      });
    }

    return res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (err) {
    console.error('Delete assessment error:', err);
    return res.status(500).json({
      error: 'Failed to delete assessment',
      message: err.message
    });
  }
});

// ===================================
// DISEASE MANAGEMENT ENDPOINTS 
// ===================================

// Get all diseases for a hospital
app.get('/api/diseases', async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id;
    
    let diseases;
    if (hospitalId) {
      diseases = await diseaseService.getDiseasesByHospital(hospitalId);
    } else {
      diseases = await diseaseService.getAllDiseases();
    }

    return res.json({
      success: true,
      count: diseases.length,
      diseases
    });
  } catch (err) {
    console.error('Get diseases error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve diseases',
      message: err.message
    });
  }
});

// Get unique diseases for a hospital
app.get('/api/diseases/unique', async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({
        error: 'Missing hospital_id parameter'
      });
    }

    const diseases = await diseaseService.getUniqueDiseases(hospitalId);

    return res.json({
      success: true,
      count: diseases.length,
      diseases
    });
  } catch (err) {
    console.error('Get unique diseases error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve unique diseases',
      message: err.message
    });
  }
});

// Search diseases by organization
app.get('/api/diseases/search', async (req, res) => {
  try {
    const { organization_name, q } = req.query;
    
    if (!organization_name) {
      return res.status(400).json({
        error: 'Missing organization_name parameter'
      });
    }

    if (!q) {
      // If no search term, return all diseases for organization
      const diseases = await diseaseService.getDiseasesByOrganization(organization_name);
      return res.json({
        success: true,
        count: diseases.length,
        diseases
      });
    }

    const diseases = await diseaseService.searchDiseasesByOrganization(organization_name, q);

    return res.json({
      success: true,
      count: diseases.length,
      diseases
    });
  } catch (err) {
    console.error('Search diseases error:', err);
    return res.status(500).json({
      error: 'Failed to search diseases',
      message: err.message
    });
  }
});

// Get a single disease by ID
app.get('/api/diseases/:id', async (req, res) => {
  try {
    const disease = await diseaseService.getDiseaseById(req.params.id);

    if (!disease) {
      return res.status(404).json({
        error: 'Disease not found'
      });
    }

    return res.json({
      success: true,
      disease
    });
  } catch (err) {
    console.error('Get disease error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve disease',
      message: err.message
    });
  }
});

// Create a new disease
// Create a new disease
app.post('/api/diseases', async (req, res) => {
  try {
    const { hospital_id, disease_name, disease_code, gene_symbols, gene_symbol, description, constant } = req.body;

    // Handle both gene_symbols (array) and gene_symbol (string) for backwards compatibility
    let geneSymbolsArray = [];
    
    if (gene_symbols) {
      // New format: array of symbols
      if (typeof gene_symbols === 'string') {
        // If it's a string, split by comma
        geneSymbolsArray = gene_symbols.split(',').map(s => s.trim()).filter(s => s);
      } else if (Array.isArray(gene_symbols)) {
        geneSymbolsArray = gene_symbols;
      }
    } else if (gene_symbol) {
      // Old format: single symbol or comma-separated string
      if (typeof gene_symbol === 'string') {
        geneSymbolsArray = gene_symbol.split(',').map(s => s.trim()).filter(s => s);
      }
    }

    // Validate required fields
    if (!hospital_id || !disease_name || !disease_code || geneSymbolsArray.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['hospital_id', 'disease_name', 'disease_code', 'gene_symbols (array or comma-separated string)']
      });
    }

    // Validate constant field
    if (constant === undefined || constant === null || constant === '') {
      return res.status(400).json({
        error: 'Missing required field: constant',
        hint: 'Constant must be a number greater than 0 and less than or equal to 100'
      });
    }

    const constantNum = parseFloat(constant);
    if (isNaN(constantNum) || constantNum <= 0 || constantNum > 100) {
      return res.status(400).json({
        error: 'Invalid constant value',
        message: 'Constant must be a number greater than 0 and less than or equal to 100',
        received: constant
      });
    }

    // Check if disease already exists
    const isDuplicateDisease = await diseaseService.checkDuplicateDisease(
      hospital_id,
      disease_code
    );

    if (isDuplicateDisease) {
      return res.status(409).json({
        error: 'Duplicate disease',
        message: `Disease with code ${disease_code} already exists for this hospital`
      });
    }

    // Create the disease with multiple gene symbols and constant
    const disease = await diseaseService.createDisease({
      hospital_id,
      disease_name,
      disease_code,
      gene_symbols: geneSymbolsArray,
      description,
      constant: constantNum
    });

    // Get hospital user info for logging
    const hospitalUser = await userService.getUserById(hospital_id);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Log disease creation
    await auditService.createLog({
      userId: hospital_id,
      userEmail: hospitalUser?.email,
      userRole: 'hospital',
      action: 'create_disease',
      resourceType: 'disease',
      resourceId: disease.id,
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { 
        diseaseName: disease_name,
        diseaseCode: disease_code,
        geneCount: geneSymbolsArray.length,
        message: 'Disease record created'
      }
    });

    return res.status(201).json({
      success: true,
      disease,
      message: 'Disease created successfully'
    });
  } catch (err) {
    console.error('Create disease error:', err);
    return res.status(500).json({
      error: 'Failed to create disease',
      message: err.message
    });
  }
});

// Update a disease
app.put('/api/diseases/:id', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    // Get existing disease first for logging
    const existingDisease = await diseaseService.getDiseaseById(req.params.id);
    
    const disease = await diseaseService.updateDisease(req.params.id, req.body);

    if (!disease) {
      return res.status(404).json({
        error: 'Disease not found'
      });
    }

    // Get hospital user info for logging
    const hospitalUser = existingDisease ? await userService.getUserById(existingDisease.hospital_id) : null;

    // Log disease update
    await auditService.createLog({
      userId: existingDisease?.hospital_id,
      userEmail: hospitalUser?.email,
      userRole: 'hospital',
      action: 'update_disease',
      resourceType: 'disease',
      resourceId: req.params.id,
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { 
        diseaseName: disease.disease_name,
        message: 'Disease record updated'
      }
    });

    return res.json({
      success: true,
      disease,
      message: 'Disease updated successfully'
    });
  } catch (err) {
    console.error('Update disease error:', err);
    console.error('Error stack:', err.stack);
    return res.status(500).json({
      error: 'Failed to update disease',
      message: err.message
    });
  }
});

// Delete a disease
app.delete('/api/diseases/:id', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    // Get disease info before deleting for logging
    const disease = await diseaseService.getDiseaseById(req.params.id);
    const hospitalUser = disease ? await userService.getUserById(disease.hospital_id) : null;
    
    const deleted = await diseaseService.deleteDisease(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Disease not found'
      });
    }

    // Log disease deletion
    await auditService.createLog({
      userId: disease?.hospital_id,
      userEmail: hospitalUser?.email,
      userRole: 'hospital',
      action: 'delete_disease',
      resourceType: 'disease',
      resourceId: req.params.id,
      status: 'success',
      severity: 'warning',
      ipAddress,
      userAgent,
      details: { 
        diseaseName: disease?.disease_name,
        diseaseCode: disease?.disease_code,
        message: 'Disease record deleted'
      }
    });

    return res.json({
      success: true,
      message: 'Disease deleted successfully'
    });
  } catch (err) {
    console.error('Delete disease error:', err);
    return res.status(500).json({
      error: 'Failed to delete disease',
      message: err.message
    });
  }
});

// Bulk upload diseases from CSV
app.post('/api/diseases/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        hint: 'Use multipart/form-data with field name "file"'
      });
    }

    const hospitalId = req.body.hospital_id;
    if (!hospitalId) {
      return res.status(400).json({
        error: 'Missing hospital_id',
        hint: 'Include hospital_id in form data'
      });
    }

    // Check file type
    const fileName = req.file.originalname.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      return res.status(400).json({
        error: 'Invalid file type',
        hint: 'Only CSV files are supported'
      });
    }

    // Parse CSV content
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({
        error: 'Invalid CSV file',
        hint: 'File must have a header row and at least one data row'
      });
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredColumns = ['disease_name', 'disease_code', 'gene_symbol'];
    const missingColumns = requiredColumns.filter(col => !header.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: 'Missing required columns',
        missing: missingColumns,
        hint: 'CSV must have columns: disease_name, disease_code, gene_symbol, description (optional)'
      });
    }

    // Parse data rows
    const entries = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const entry = {};
      header.forEach((col, index) => {
        entry[col] = values[index] || '';
      });

      entries.push(entry);
    }

    // Bulk insert
    const result = await diseaseService.bulkInsertDiseases(entries, hospitalId);

    return res.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      total: entries.length,
      errors: result.errors.slice(0, 10), // Limit errors in response
      message: `Successfully inserted ${result.inserted} entries, skipped ${result.skipped}`
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    return res.status(500).json({
      error: 'Failed to process CSV upload',
      message: err.message
    });
  }
});

// Generate hash preview (utility endpoint)
app.post('/api/diseases/hash-preview', (req, res) => {
  try {
    const { gene_symbol } = req.body;

    if (!gene_symbol) {
      return res.status(400).json({
        error: 'Missing gene_symbol'
      });
    }

    const hash = diseaseService.generateHash(gene_symbol);

    return res.json({
      success: true,
      gene_symbol: gene_symbol.toUpperCase(),
      hash_value: hash
    });
  } catch (err) {
    console.error('Hash preview error:', err);
    return res.status(500).json({
      error: 'Failed to generate hash',
      message: err.message
    });
  }
});

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line) {
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


// ===================================
// AUDIT LOG ENDPOINTS
// ===================================

// Get audit logs with filters (system_admin only)
app.get('/api/audit-logs', requireRole(['admin']), async (req, res) => {
  try {
    const filters = {
      userEmail: req.query.userEmail || req.query.user_email,
      userId: req.query.userId || req.query.user_id,
      userRole: req.query.userRole || req.query.user_role,
      action: req.query.action,
      resourceType: req.query.resourceType || req.query.resource_type,
      status: req.query.status,
      severity: req.query.severity,
      startDate: req.query.startDate || req.query.start_date,
      endDate: req.query.endDate || req.query.end_date,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    // Remove undefined/null filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
        delete filters[key];
      }
    });

    const logs = await auditService.getLogs(filters);
    const totalCount = await auditService.getLogsCount(filters);

    return res.json({
      success: true,
      count: logs.length,
      total: totalCount,
      logs
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve audit logs',
      message: err.message
    });
  }
});

// Get audit log statistics (system_admin only)
app.get('/api/audit-logs/statistics', requireRole(['admin']), async (req, res) => {
  try {
    const stats = await auditService.getStatistics();

    return res.json({
      success: true,
      statistics: stats
    });
  } catch (err) {
    console.error('Get audit statistics error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve audit statistics',
      message: err.message
    });
  }
});

// Get audit logs for a specific user (system_admin only)
app.get('/api/audit-logs/user/:userId', requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const logs = await auditService.getLogsByUser(userId, limit);

    return res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('Get user audit logs error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve user audit logs',
      message: err.message
    });
  }
});

// Get audit logs for a specific resource (system_admin only)
app.get('/api/audit-logs/resource/:resourceType/:resourceId', requireRole(['admin']), async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    const logs = await auditService.getLogsByResource(resourceType, resourceId);

    return res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('Get resource audit logs error:', err);
    return res.status(500).json({
      error: 'Failed to retrieve resource audit logs',
      message: err.message
    });
  }
});

// Create audit log entry (internal use, but exposed for flexibility)
app.post('/api/audit-logs', async (req, res) => {
  try {
    const logData = {
      userId: req.body.userId || req.body.user_id,
      userEmail: req.body.userEmail || req.body.user_email,
      userRole: req.body.userRole || req.body.user_role,
      action: req.body.action,
      resourceType: req.body.resourceType || req.body.resource_type,
      resourceId: req.body.resourceId || req.body.resource_id,
      ipAddress: req.body.ipAddress || req.body.ip_address || req.ip || req.headers['x-forwarded-for'],
      userAgent: req.body.userAgent || req.body.user_agent || req.headers['user-agent'],
      status: req.body.status || 'success',
      severity: req.body.severity || 'info',
      details: req.body.details,
      sessionId: req.body.sessionId || req.body.session_id
    };

    if (!logData.action) {
      return res.status(400).json({
        error: 'Missing required field: action'
      });
    }

    const log = await auditService.createLog(logData);

    return res.status(201).json({
      success: true,
      log
    });
  } catch (err) {
    console.error('Create audit log error:', err);
    return res.status(500).json({
      error: 'Failed to create audit log',
      message: err.message
    });
  }
});

// Delete old audit logs (system_admin only, for retention policy)
app.delete('/api/audit-logs/cleanup', requireRole(['admin']), async (req, res) => {
  try {
    const daysToKeep = parseInt(req.query.days) || 90;

    const deletedCount = await auditService.deleteOldLogs(daysToKeep);

    return res.json({
      success: true,
      message: `Deleted ${deletedCount} audit logs older than ${daysToKeep} days`,
      deletedCount
    });
  } catch (err) {
    console.error('Cleanup audit logs error:', err);
    return res.status(500).json({
      error: 'Failed to cleanup audit logs',
      message: err.message
    });
  }
});

// ===================================
// SECURITY ADMIN AUTHENTICATION ENDPOINTS
// ===================================

// Security Admin Login (separate from regular login)
app.post('/api/security/login', async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password'],
        message: 'Please provide both email and password'
      });
    }

    // First check if user exists and has correct role
    const existingUser = await userService.getUserByEmail(email);

    if (!existingUser) {
      await auditService.createLog({
        userEmail: email,
        action: 'security_login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'User not found', portal: 'security' }
      });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password incorrect'
      });
    }

    // IMPORTANT: Only allow security_admin role to login through this endpoint
    if (existingUser.role !== 'security_admin') {
      await auditService.createLog({
        userId: existingUser.id,
        userEmail: email,
        userRole: existingUser.role,
        action: 'security_login',
        status: 'failure',
        severity: 'critical',
        ipAddress,
        userAgent,
        details: { 
          reason: 'Unauthorized role attempted security login', 
          attemptedRole: existingUser.role,
          portal: 'security'
        }
      });
      return res.status(403).json({
        error: 'Access denied',
        message: 'This portal is restricted to security administrators only'
      });
    }

    // SECURE: Now authenticates with bcrypt
    let user;
    try {
      user = await userService.authenticateUser(email, password);
    } catch (authError) {
      await auditService.createLog({
        userId: existingUser.id,
        userEmail: email,
        userRole: existingUser.role,
        action: 'security_login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: authError.message, portal: 'security' }
      });
      return res.status(403).json({
        error: 'Authentication failed',
        message: authError.message
      });
    }

    if (!user) {
      await auditService.createLog({
        userId: existingUser.id,
        userEmail: email,
        userRole: existingUser.role,
        action: 'security_login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'Invalid password', portal: 'security' }
      });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password incorrect'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      await auditService.createLog({
        userId: user.id,
        userEmail: email,
        userRole: user.role,
        action: 'security_login',
        status: 'failure',
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { reason: 'Account not active', status: user.status, portal: 'security' }
      });
      return res.status(403).json({
        error: 'Account not active',
        message: 'Your account has been suspended or is pending approval'
      });
    }

    await auditService.createLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'security_login',
      status: 'success',
      severity: 'info',
      ipAddress,
      userAgent,
      details: { message: 'Security administrator logged in successfully', portal: 'security' }
    });

    return res.json({
      success: true,
      user: user,
      message: 'Security login successful'
    });

  } catch (err) {
    console.error('Security login error:', err);
    await auditService.createLog({
      userEmail: req.body.email,
      action: 'security_login',
      status: 'failure',
      severity: 'error',
      ipAddress,
      userAgent,
      details: { error: err.message, portal: 'security' }
    });
    return res.status(500).json({
      error: 'Login failed',
      message: 'An unexpected error occurred. Please try again.'
    });
  }
});