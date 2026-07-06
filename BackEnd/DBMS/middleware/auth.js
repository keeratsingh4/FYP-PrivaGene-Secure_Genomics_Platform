// middleware/auth.js
// Simple header-based role check used for submission. Replace with real auth as needed.
// Roles mapping:
// Frontend: patient, doctor, hospital_admin, researcher, system_admin, security_admin
// Backend: patient, doctor, researcher, admin

function requireRole(allowedRoles = []) {
  return function (req, res, next) {
    let role = (req.header('X-Role') || '').toLowerCase();

    if (!role) {
      return res.status(401).json({
        error: 'Missing X-Role header',
        hint: 'Include X-Role header with value: patient, doctor, hospital_admin, researcher, system_admin, or security_admin'
      });
    }

    // Map frontend roles to backend roles
    const roleMapping = {
      'patient': 'patient',
      'doctor': 'doctor',
      'hospital_admin': 'admin',
      'researcher': 'researcher',
      'system_admin': 'admin',
      'security_admin': 'admin'
    };

    const mappedRole = roleMapping[role] || role;

    if (allowedRoles.length && !allowedRoles.includes(mappedRole)) {
      return res.status(403).json({
        error: 'Forbidden for role',
        providedRole: role,
        mappedRole: mappedRole,
        allowedRoles: allowedRoles
      });
    }

    // session id header optionally required for write/read scoping
    req.context = {
      role: mappedRole,
      originalRole: role,
      sessionId: req.header('X-Session-ID') || null
    };
    next();
  };
}

module.exports = { requireRole };