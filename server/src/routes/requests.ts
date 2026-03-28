import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

// GET /api/requests?project_id=...
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const offset = parseInt(req.query.offset as string, 10) || 0;

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
      `SELECT c.*,
        creator.last_name || ' ' || creator.first_name AS creator_name,
        assignee.last_name || ' ' || assignee.first_name AS assignee_name
      FROM cells c
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN users assignee ON c.assigned_to = assignee.id
      WHERE c.project_id = $1 AND c.cell_type = 'request'
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM cells WHERE project_id = $1 AND cell_type = 'request'",
      [projectId]
    );

    res.json({ requests: result.rows, total: countResult.rows[0].total });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/requests
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, title, description, assigned_to, due_date, ...extra } = req.body;

    if (!project_id) {
      res.status(400).json({ error: 'project_id обязателен' });
      return;
    }

    const access = await hasProjectAccess(userId, project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO cells (project_id, cell_type, title, description, status, assigned_to, due_date, created_by)
       VALUES ($1, 'request', $2, $3, 'Создано', $4, $5, $6) RETURNING *`,
      [project_id, title || null, description || null, assigned_to || null, due_date || null, userId]
    );

    const cell = result.rows[0];

    await pool.query(
      "INSERT INTO cell_history (cell_id, user_id, action) VALUES ($1, $2, 'created')",
      [cell.id, userId]
    );

    res.status(201).json(cell);
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/requests/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;

    const existing = await pool.query("SELECT * FROM cells WHERE id = $1 AND cell_type = 'request'", [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Запрос не найден' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const allowedFields = ['title', 'description', 'status', 'assigned_to', 'due_date'];
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

    fields.push(`updated_at = NOW()`);
    values.push(cellId);

    const result = await pool.query(
      `UPDATE cells SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    await pool.query(
      "INSERT INTO cell_history (cell_id, user_id, action) VALUES ($1, $2, 'edited')",
      [cellId, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update request error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/requests/:id/execute
router.post('/:id/execute', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;
    const { status, comment } = req.body;

    const existing = await pool.query("SELECT * FROM cells WHERE id = $1 AND cell_type = 'request'", [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Запрос не найден' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query(
      "UPDATE cells SET status = $1, updated_at = NOW() WHERE id = $2",
      [status || 'Исполнено', cellId]
    );

    await pool.query(
      "INSERT INTO cell_history (cell_id, user_id, action, details) VALUES ($1, $2, 'executed', $3)",
      [cellId, userId, JSON.stringify({ status: status || 'Исполнено', comment: comment || null })]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Execute request error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
