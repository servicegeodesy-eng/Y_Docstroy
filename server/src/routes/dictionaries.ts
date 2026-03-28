import { Router, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hasProjectAccess } from '../middleware/permissions.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_TABLES: Record<string, string> = {
  buildings: 'dict_buildings',
  floors: 'dict_floors',
  work_types: 'dict_work_types',
  constructions: 'dict_constructions',
  sets: 'dict_sets',
  works: 'dict_works',
};

function getTableName(table: string): string | null {
  return ALLOWED_TABLES[table] || null;
}

// GET /api/dictionaries/:projectId
router.get('/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.params.projectId;

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const [buildings, floors, workTypes, constructions, sets, works] = await Promise.all([
      pool.query('SELECT * FROM dict_buildings WHERE project_id = $1 ORDER BY sort_order, id', [projectId]),
      pool.query('SELECT * FROM dict_floors WHERE project_id = $1 ORDER BY sort_order, id', [projectId]),
      pool.query('SELECT * FROM dict_work_types WHERE project_id = $1 ORDER BY sort_order, id', [projectId]),
      pool.query('SELECT * FROM dict_constructions WHERE project_id = $1 ORDER BY sort_order, id', [projectId]),
      pool.query('SELECT * FROM dict_sets WHERE project_id = $1 ORDER BY sort_order, id', [projectId]),
      pool.query('SELECT * FROM dict_works WHERE project_id = $1 ORDER BY sort_order, id', [projectId]),
    ]);

    res.json({
      buildings: buildings.rows,
      floors: floors.rows,
      work_types: workTypes.rows,
      constructions: constructions.rows,
      sets: sets.rows,
      works: works.rows,
    });
  } catch (err) {
    console.error('Get dictionaries error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/dictionaries/:table
router.post('/:table', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tableName = getTableName(req.params.table);

    if (!tableName) {
      res.status(400).json({ error: 'Неизвестный справочник' });
      return;
    }

    const { project_id, name, sort_order, ...extra } = req.body;

    if (!project_id || !name) {
      res.status(400).json({ error: 'project_id и name обязательны' });
      return;
    }

    const access = await hasProjectAccess(userId, project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const fields = ['project_id', 'name'];
    const values: unknown[] = [project_id, name];
    let idx = 3;

    if (sort_order !== undefined) {
      fields.push('sort_order');
      values.push(sort_order);
      idx++;
    }

    // Handle extra fields specific to certain dictionaries
    for (const [key, val] of Object.entries(extra)) {
      if (val !== undefined && typeof key === 'string' && /^[a-z_]+$/.test(key)) {
        fields.push(key);
        values.push(val);
        idx++;
      }
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create dictionary entry error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/dictionaries/:table/:id
router.patch('/:table/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tableName = getTableName(req.params.table);
    const id = req.params.id;

    if (!tableName) {
      res.status(400).json({ error: 'Неизвестный справочник' });
      return;
    }

    // Get project_id from existing record
    const existing = await pool.query(`SELECT project_id FROM ${tableName} WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const { project_id: _pid, id: _id, ...updates } = req.body;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && typeof key === 'string' && /^[a-z_]+$/.test(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update dictionary entry error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/dictionaries/:table/:id
router.delete('/:table/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tableName = getTableName(req.params.table);
    const id = req.params.id;

    if (!tableName) {
      res.status(400).json({ error: 'Неизвестный справочник' });
      return;
    }

    const existing = await pool.query(`SELECT project_id FROM ${tableName} WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete dictionary entry error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
