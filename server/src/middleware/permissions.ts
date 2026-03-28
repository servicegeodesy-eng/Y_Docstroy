import pool from '../config/db';

export async function getUserProjectIds(userId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT project_id FROM project_members WHERE user_id = $1',
    [userId]
  );
  return result.rows.map((r: { project_id: string }) => r.project_id);
}

export async function isPortalAdmin(userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_portal_admin FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.is_portal_admin === true;
}

export async function isGlobalReader(userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_global_reader FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.is_global_reader === true;
}

export async function isProjectAdmin(userId: string, projectId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM project_members WHERE user_id = $1 AND project_id = $2 AND role = 'admin'",
    [userId, projectId]
  );
  return result.rows.length > 0;
}

export async function hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const admin = await isPortalAdmin(userId);
  if (admin) return true;

  const global = await isGlobalReader(userId);
  if (global) return true;

  const result = await pool.query(
    'SELECT id FROM project_members WHERE user_id = $1 AND project_id = $2',
    [userId, projectId]
  );
  return result.rows.length > 0;
}

export async function hasPermission(userId: string, projectId: string, permission: string): Promise<boolean> {
  const admin = await isPortalAdmin(userId);
  if (admin) return true;

  // Check user-level permission override first
  const userPerm = await pool.query(
    'SELECT allowed FROM user_permissions WHERE user_id = $1 AND project_id = $2 AND permission = $3',
    [userId, projectId, permission]
  );
  if (userPerm.rows.length > 0) {
    return userPerm.rows[0].allowed === true;
  }

  // Fall back to role-based permission
  const rolePerm = await pool.query(
    `SELECT prp.allowed FROM portal_role_permissions prp
     JOIN project_members pm ON pm.role = prp.role
     WHERE pm.user_id = $1 AND pm.project_id = $2 AND prp.permission = $3`,
    [userId, projectId, permission]
  );
  return rolePerm.rows[0]?.allowed === true;
}
