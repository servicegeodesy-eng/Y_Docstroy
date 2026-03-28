import { Router, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { isPortalAdmin, hasProjectAccess } from '../middleware/permissions.js';

const router = Router();
router.use(authMiddleware);

// GET /api/permissions/portal-roles
router.get('/portal-roles', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM portal_role_permissions ORDER BY role, permission');
    res.json(result.rows);
  } catch (err) {
    console.error('Get portal roles error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/permissions/portal-roles
router.put('/portal-roles', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const admin = await isPortalAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Только портальный администратор' });
      return;
    }

    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'permissions должен быть массивом' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const perm of permissions) {
        await client.query(
          `INSERT INTO portal_role_permissions (role, permission, allowed)
           VALUES ($1, $2, $3)
           ON CONFLICT (role, permission) DO UPDATE SET allowed = $3`,
          [perm.role, perm.permission, perm.allowed]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update portal roles error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/permissions/user?project_id=...&user_id=...
router.get('/user', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;
    const targetUserId = req.query.user_id as string;

    if (!projectId || !targetUserId) {
      res.status(400).json({ error: 'project_id и user_id обязательны' });
      return;
    }

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM user_permissions WHERE user_id = $1 AND project_id = $2',
      [targetUserId, projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get user permissions error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/permissions/user
router.put('/user', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, user_id, permissions } = req.body;

    if (!project_id || !user_id || !Array.isArray(permissions)) {
      res.status(400).json({ error: 'project_id, user_id и permissions обязательны' });
      return;
    }

    const admin = await isPortalAdmin(userId);
    if (!admin) {
      const { isProjectAdmin: isProjAdmin } = await import('../middleware/permissions.js');
      const projAdmin = await isProjAdmin(userId, project_id);
      if (!projAdmin) {
        res.status(403).json({ error: 'Доступ запрещён' });
        return;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const perm of permissions) {
        await client.query(
          `INSERT INTO user_permissions (user_id, project_id, permission, allowed)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, project_id, permission) DO UPDATE SET allowed = $4`,
          [user_id, project_id, perm.permission, perm.allowed]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update user permissions error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/permissions/cell-actions?project_id=...
router.get('/cell-actions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;

    if (!projectId) {
      res.status(400).json({ error: 'project_id обязателен' });
      return;
    }

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM cell_action_permissions WHERE project_id = $1',
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get cell action permissions error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/permissions/cell-actions
router.put('/cell-actions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, actions } = req.body;

    if (!project_id || !Array.isArray(actions)) {
      res.status(400).json({ error: 'project_id и actions обязательны' });
      return;
    }

    const admin = await isPortalAdmin(userId);
    if (!admin) {
      const { isProjectAdmin: isProjAdmin } = await import('../middleware/permissions.js');
      const projAdmin = await isProjAdmin(userId, project_id);
      if (!projAdmin) {
        res.status(403).json({ error: 'Доступ запрещён' });
        return;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const action of actions) {
        await client.query(
          `INSERT INTO cell_action_permissions (project_id, action, role, allowed)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, action, role) DO UPDATE SET allowed = $4`,
          [project_id, action.action, action.role, action.allowed]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update cell action permissions error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
