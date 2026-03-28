import { Router, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getUserProjectIds, isPortalAdmin, isProjectAdmin } from '../middleware/permissions.js';

const router = Router();
router.use(authMiddleware);

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const admin = await isPortalAdmin(userId);

    let rows;
    if (admin) {
      const result = await pool.query(
        'SELECT id, name, description, created_at, updated_at FROM projects ORDER BY created_at DESC'
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT p.id, p.name, p.description, p.created_at, p.updated_at, pm.role
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = $1
         ORDER BY p.created_at DESC`,
        [userId]
      );
      rows = result.rows;
    }

    res.json(rows);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Название проекта обязательно' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const projectResult = await client.query(
        'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *',
        [name, description || null]
      );
      const project = projectResult.rows[0];

      await client.query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'admin')",
        [project.id, userId]
      );

      await client.query('COMMIT');
      res.status(201).json(project);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.params.id;
    const { name, description } = req.body;

    const admin = await isPortalAdmin(userId);
    const projAdmin = await isProjectAdmin(userId, projectId);

    if (!admin && !projAdmin) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    fields.push(`updated_at = NOW()`);
    values.push(projectId);

    const result = await pool.query(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const admin = await isPortalAdmin(userId);

    if (!admin) {
      res.status(403).json({ error: 'Только портальный администратор может удалять проекты' });
      return;
    }

    const projectId = req.params.id;
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [projectId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
