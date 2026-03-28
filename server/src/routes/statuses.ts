import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

// GET /api/statuses?project_id=...
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
      'SELECT * FROM project_statuses WHERE project_id = $1 ORDER BY sort_order, id',
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get statuses error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/statuses
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, name, color, sort_order, is_final } = req.body;

    if (!project_id || !name) {
      res.status(400).json({ error: 'project_id и name обязательны' });
      return;
    }

    const access = await hasProjectAccess(userId, project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO project_statuses (project_id, name, color, sort_order, is_final)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_id, name, color || null, sort_order || 0, is_final || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/statuses/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const statusId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM project_statuses WHERE id = $1', [statusId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Статус не найден' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const allowedFields = ['name', 'color', 'sort_order', 'is_final'];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    values.push(statusId);
    const result = await pool.query(
      `UPDATE project_statuses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/statuses/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const statusId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM project_statuses WHERE id = $1', [statusId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Статус не найден' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query('DELETE FROM project_statuses WHERE id = $1', [statusId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/statuses/:id/roles
router.post('/:id/roles', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const statusId = req.params.id;
    const { roles } = req.body;

    if (!Array.isArray(roles)) {
      res.status(400).json({ error: 'roles должен быть массивом' });
      return;
    }

    const existing = await pool.query('SELECT project_id FROM project_statuses WHERE id = $1', [statusId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Статус не найден' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM status_role_assignments WHERE status_id = $1', [statusId]);

      for (const role of roles) {
        await client.query(
          'INSERT INTO status_role_assignments (status_id, role, can_set) VALUES ($1, $2, $3)',
          [statusId, role.role, role.can_set !== undefined ? role.can_set : true]
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
    console.error('Set status roles error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
