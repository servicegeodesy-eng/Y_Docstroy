import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess, isProjectAdmin, isPortalAdmin } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

// GET /api/users?project_id=...
router.get('/', async (req: AuthRequest, res: Response) => {
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
      `SELECT pm.id AS membership_id, pm.role, pm.project_role, pm.project_id,
              u.id, u.email, u.last_name, u.first_name, u.middle_name, u.display_name,
              u.structure, u.organization, u.position, u.phone
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.last_name, u.first_name`,
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/users/project-member
router.post('/project-member', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, user_id, role, project_role } = req.body;

    if (!project_id || !user_id) {
      res.status(400).json({ error: 'project_id и user_id обязательны' });
      return;
    }

    const admin = await isPortalAdmin(userId);
    const projAdmin = await isProjectAdmin(userId, project_id);

    if (!admin && !projAdmin) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const existing = await pool.query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [project_id, user_id]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Пользователь уже в проекте' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO project_members (project_id, user_id, role, project_role) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, user_id, role || 'member', project_role || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add project member error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/users/project-member/:id
router.patch('/project-member/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const membershipId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM project_members WHERE id = $1', [membershipId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Членство не найдено' });
      return;
    }

    const admin = await isPortalAdmin(userId);
    const projAdmin = await isProjectAdmin(userId, existing.rows[0].project_id);

    if (!admin && !projAdmin) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const { role, project_role } = req.body;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (role !== undefined) { fields.push(`role = $${idx++}`); values.push(role); }
    if (project_role !== undefined) { fields.push(`project_role = $${idx++}`); values.push(project_role); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    values.push(membershipId);
    const result = await pool.query(
      `UPDATE project_members SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update project member error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/users/project-member/:id
router.delete('/project-member/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const membershipId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM project_members WHERE id = $1', [membershipId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Членство не найдено' });
      return;
    }

    const admin = await isPortalAdmin(userId);
    const projAdmin = await isProjectAdmin(userId, existing.rows[0].project_id);

    if (!admin && !projAdmin) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    await pool.query('DELETE FROM project_members WHERE id = $1', [membershipId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete project member error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users/search?q=...
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (q.length < 2) {
      res.json([]);
      return;
    }

    const result = await pool.query(
      `SELECT id, email, last_name, first_name, middle_name, display_name, organization
       FROM users
       WHERE lower(last_name) LIKE lower($1) OR lower(display_name) LIKE lower($1)
       ORDER BY last_name, first_name
       LIMIT 20`,
      [`${q}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
