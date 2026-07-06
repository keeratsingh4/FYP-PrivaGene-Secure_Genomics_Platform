// platformAnalyticsService.js
// System-wide analytics for System Admin dashboard pages
const { get, all } = require('../../DBMS/db/db');

const platformAnalyticsService = {
  async getPlatformAnalytics() {
    const [
      totalUsersRow,
      totalAssessmentsRow,
      roleStatusRows,
      activeOrgsRow,
      pendingOrgsRow,
      usersByMonthRows,
      assessmentsByMonthRows
    ] = await Promise.all([
      get(`SELECT COUNT(*) as count FROM users`),
      get(`SELECT COUNT(*) as count FROM risk_assessments`),
      all(`
        SELECT
          role,
          COALESCE(status, 'active') as status,
          COUNT(*) as count
        FROM users
        GROUP BY role, COALESCE(status, 'active')
      `),
      get(`
        SELECT COUNT(DISTINCT organization_name) as count
        FROM users
        WHERE organization_name IS NOT NULL
          AND TRIM(organization_name) <> ''
          AND COALESCE(status, 'active') = 'active'
      `),
      get(`
        SELECT COUNT(DISTINCT organization_name) as count
        FROM users
        WHERE organization_name IS NOT NULL
          AND TRIM(organization_name) <> ''
          AND COALESCE(status, 'active') = 'pending_approval'
      `),
      all(`
        SELECT
          substr(created_at, 1, 7) as month,
          COUNT(*) as count
        FROM users
        WHERE created_at IS NOT NULL
        GROUP BY substr(created_at, 1, 7)
        ORDER BY month ASC
      `),
      all(`
        SELECT
          substr(created_at, 1, 7) as month,
          COUNT(*) as count
        FROM risk_assessments
        WHERE created_at IS NOT NULL
        GROUP BY substr(created_at, 1, 7)
        ORDER BY month ASC
      `)
    ]);

    // Aggregate role distribution into { role, active, pending, suspended, total }
    const roleMap = new Map();
    for (const row of roleStatusRows) {
      const role = row.role || 'unknown';
      const status = (row.status || 'active').toLowerCase();
      const count = Number(row.count || 0);

      if (!roleMap.has(role)) {
        roleMap.set(role, { role, active: 0, pending: 0, suspended: 0, total: 0 });
      }

      const agg = roleMap.get(role);
      agg.total += count;

      if (status === 'pending_approval') agg.pending += count;
      else if (status === 'suspended') agg.suspended += count;
      else agg.active += count;
    }

    // Stable ordering for UI
    const preferredOrder = [
      'patient',
      'caregiver',
      'hospital',
      'doctor',
      'hospital_admin',
      'researcher',
      'system_admin',
      'security_admin',
      'admin'
    ];

    const roleDistribution = Array.from(roleMap.values()).sort((a, b) => {
      const ai = preferredOrder.indexOf(a.role);
      const bi = preferredOrder.indexOf(b.role);
      if (ai === -1 && bi === -1) return a.role.localeCompare(b.role);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return {
      metrics: {
        totalUsers: Number(totalUsersRow?.count || 0),
        totalAssessments: Number(totalAssessmentsRow?.count || 0),
        activeOrganizations: Number(activeOrgsRow?.count || 0),
        pendingOrganizations: Number(pendingOrgsRow?.count || 0)
      },
      roleDistribution,
      trends: {
        usersByMonth: usersByMonthRows.map(r => ({ month: r.month, count: Number(r.count || 0) })),
        assessmentsByMonth: assessmentsByMonthRows.map(r => ({ month: r.month, count: Number(r.count || 0) }))
      }
    };
  }
};

module.exports = platformAnalyticsService;


