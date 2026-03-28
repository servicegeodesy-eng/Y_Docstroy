import { Router, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hasProjectAccess } from '../middleware/permissions.js';
import { notifyOnCellAction } from '../services/pushService.js';

const router = Router();
router.use(authMiddleware);

async function writeCellHistory(cellId: string, userId: string, action: string, details?: object): Promise<void> {
  await pool.query(
    'INSERT INTO cell_history (cell_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
    [cellId, userId, action, details ? JSON.stringify(details) : null]
  );
}

// GET /api/cells?project_id=...&cell_type=registry|gro&limit=100&offset=0
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = req.query.project_id as string;
    const cellType = req.query.cell_type as string || 'registry';
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

    const cellsResult = await pool.query(
      `SELECT c.*,
        b.name AS building_name, f.name AS floor_name,
        wt.name AS work_type_name, cn.name AS construction_name, s.name AS set_name,
        creator.last_name || ' ' || creator.first_name AS creator_name,
        assignee.last_name || ' ' || assignee.first_name AS assignee_name
      FROM cells c
      LEFT JOIN dict_buildings b ON c.building_id = b.id
      LEFT JOIN dict_floors f ON c.floor_id = f.id
      LEFT JOIN dict_work_types wt ON c.work_type_id = wt.id
      LEFT JOIN dict_constructions cn ON c.construction_id = cn.id
      LEFT JOIN dict_sets s ON c.set_id = s.id
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN users assignee ON c.assigned_to = assignee.id
      WHERE c.project_id = $1 AND c.cell_type = $2
      ORDER BY c.created_at DESC
      LIMIT $3 OFFSET $4`,
      [projectId, cellType, limit, offset]
    );

    const cells = cellsResult.rows;
    const cellIds = cells.map((c: { id: number }) => c.id);

    if (cellIds.length > 0) {
      const [filesResult, signaturesResult, commentsResult] = await Promise.all([
        pool.query(
          'SELECT id, cell_id, file_name, storage_path FROM cell_files WHERE cell_id = ANY($1)',
          [cellIds]
        ),
        pool.query(
          'SELECT cell_id, status FROM cell_signatures WHERE cell_id = ANY($1)',
          [cellIds]
        ),
        pool.query(
          'SELECT cell_id, COUNT(*)::int AS count FROM cell_public_comments WHERE cell_id = ANY($1) GROUP BY cell_id',
          [cellIds]
        ),
      ]);

      const filesMap = new Map<number, object[]>();
      for (const f of filesResult.rows) {
        if (!filesMap.has(f.cell_id)) filesMap.set(f.cell_id, []);
        filesMap.get(f.cell_id)!.push(f);
      }

      const sigsMap = new Map<number, object[]>();
      for (const s of signaturesResult.rows) {
        if (!sigsMap.has(s.cell_id)) sigsMap.set(s.cell_id, []);
        sigsMap.get(s.cell_id)!.push(s);
      }

      const commentsMap = new Map<number, number>();
      for (const c of commentsResult.rows) {
        commentsMap.set(c.cell_id, c.count);
      }

      for (const cell of cells) {
        cell.cell_files = filesMap.get(cell.id) || [];
        cell.cell_signatures = sigsMap.get(cell.id) || [];
        cell.comments_count = commentsMap.get(cell.id) || 0;
      }
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM cells WHERE project_id = $1 AND cell_type = $2',
      [projectId, cellType]
    );

    res.json({ cells, total: countResult.rows[0].total });
  } catch (err) {
    console.error('Get cells error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/cells/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;

    const cellResult = await pool.query(
      `SELECT c.*,
        b.name AS building_name, f.name AS floor_name,
        wt.name AS work_type_name, cn.name AS construction_name, s.name AS set_name,
        creator.last_name || ' ' || creator.first_name AS creator_name,
        assignee.last_name || ' ' || assignee.first_name AS assignee_name
      FROM cells c
      LEFT JOIN dict_buildings b ON c.building_id = b.id
      LEFT JOIN dict_floors f ON c.floor_id = f.id
      LEFT JOIN dict_work_types wt ON c.work_type_id = wt.id
      LEFT JOIN dict_constructions cn ON c.construction_id = cn.id
      LEFT JOIN dict_sets s ON c.set_id = s.id
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN users assignee ON c.assigned_to = assignee.id
      WHERE c.id = $1`,
      [cellId]
    );

    if (cellResult.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const cell = cellResult.rows[0];

    const access = await hasProjectAccess(userId, cell.project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const [files, shares, signatures, history, overlays, comments] = await Promise.all([
      pool.query('SELECT * FROM cell_files WHERE cell_id = $1', [cellId]),
      pool.query('SELECT * FROM cell_shares WHERE cell_id = $1 ORDER BY created_at DESC', [cellId]),
      pool.query('SELECT * FROM cell_signatures WHERE cell_id = $1 ORDER BY created_at DESC', [cellId]),
      pool.query('SELECT * FROM cell_history WHERE cell_id = $1 ORDER BY created_at DESC LIMIT 50', [cellId]),
      pool.query('SELECT * FROM cell_overlay_masks WHERE cell_id = $1', [cellId]),
      pool.query('SELECT * FROM cell_public_comments WHERE cell_id = $1 ORDER BY created_at DESC', [cellId]),
    ]);

    cell.cell_files = files.rows;
    cell.cell_shares = shares.rows;
    cell.cell_signatures = signatures.rows;
    cell.cell_history = history.rows;
    cell.cell_overlay_masks = overlays.rows;
    cell.cell_public_comments = comments.rows;

    res.json(cell);
  } catch (err) {
    console.error('Get cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cells
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      project_id, cell_type, title, description, status,
      building_id, floor_id, work_type_id, construction_id, set_id,
      assigned_to, send_type, due_date,
      cell_overlay_masks,
      ...extraFields
    } = req.body;

    if (!project_id || !cell_type) {
      res.status(400).json({ error: 'project_id и cell_type обязательны' });
      return;
    }

    const access = await hasProjectAccess(userId, project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO cells (
          project_id, cell_type, title, description, status,
          building_id, floor_id, work_type_id, construction_id, set_id,
          assigned_to, send_type, due_date, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [
          project_id, cell_type, title || null, description || null, status || 'Создано',
          building_id || null, floor_id || null, work_type_id || null, construction_id || null, set_id || null,
          assigned_to || null, send_type || null, due_date || null, userId,
        ]
      );

      const cell = result.rows[0];

      // Insert overlay masks if provided
      if (Array.isArray(cell_overlay_masks) && cell_overlay_masks.length > 0) {
        for (const mask of cell_overlay_masks) {
          await client.query(
            'INSERT INTO cell_overlay_masks (cell_id, overlay_image_path, mask_data) VALUES ($1, $2, $3)',
            [cell.id, mask.overlay_image_path, mask.mask_data ? JSON.stringify(mask.mask_data) : null]
          );
        }
      }

      await client.query(
        "INSERT INTO cell_history (cell_id, user_id, action) VALUES ($1, $2, 'created')",
        [cell.id, userId]
      );

      await client.query('COMMIT');
      res.status(201).json(cell);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/cells/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;

    const existing = await pool.query('SELECT * FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const cell = existing.rows[0];
    const access = await hasProjectAccess(userId, cell.project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const allowedFields = [
      'title', 'description', 'status', 'building_id', 'floor_id',
      'work_type_id', 'construction_id', 'set_id', 'assigned_to',
      'send_type', 'due_date',
    ];

    const fields: string[] = [];
    const values: unknown[] = [];
    const diff: Record<string, { old: unknown; new: unknown }> = {};
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
        if (cell[field] !== req.body[field]) {
          diff[field] = { old: cell[field], new: req.body[field] };
        }
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

    await writeCellHistory(cellId, userId, 'edited', diff);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/cells/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;

    const existing = await pool.query('SELECT * FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const cell = existing.rows[0];
    const access = await hasProjectAccess(userId, cell.project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await writeCellHistory(cellId, userId, 'deleted');

    // Files will be cleaned up by CASCADE; S3 cleanup should be handled separately
    await pool.query('DELETE FROM cells WHERE id = $1', [cellId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cells/:id/change-status
router.post('/:id/change-status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;
    const { status, comment } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Статус обязателен' });
      return;
    }

    const existing = await pool.query('SELECT project_id, status AS old_status FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query('UPDATE cells SET status = $1, updated_at = NOW() WHERE id = $2', [status, cellId]);

    await writeCellHistory(cellId, userId, 'status_changed', {
      old_status: existing.rows[0].old_status,
      new_status: status,
      comment: comment || null,
    });

    // Push notification (fire-and-forget)
    notifyOnCellAction(cellId, 'status_changed', userId, { new_status: status });

    res.json({ ok: true });
  } catch (err) {
    console.error('Change status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cells/:id/send
router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;
    const { to_user_id, send_type } = req.body;

    if (!to_user_id) {
      res.status(400).json({ error: 'to_user_id обязателен' });
      return;
    }

    const existing = await pool.query('SELECT project_id FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
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

      await client.query(
        'INSERT INTO cell_shares (cell_id, from_user_id, to_user_id, send_type) VALUES ($1, $2, $3, $4)',
        [cellId, userId, to_user_id, send_type || null]
      );

      await client.query(
        'UPDATE cells SET assigned_to = $1, send_type = $2, updated_at = NOW() WHERE id = $3',
        [to_user_id, send_type || null, cellId]
      );

      await client.query(
        "INSERT INTO cell_history (cell_id, user_id, action, details) VALUES ($1, $2, 'sent', $3)",
        [cellId, userId, JSON.stringify({ to_user_id, send_type })]
      );

      await client.query('COMMIT');

      // Push notification (fire-and-forget)
      notifyOnCellAction(cellId, 'share', userId, { to_user_id, send_type });

      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Send cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cells/:id/sign
router.post('/:id/sign', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;
    const { status, comment, files } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Статус подписи обязателен' });
      return;
    }

    const existing = await pool.query('SELECT project_id FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query(
      'INSERT INTO cell_signatures (cell_id, user_id, status, comment, files) VALUES ($1, $2, $3, $4, $5)',
      [cellId, userId, status, comment || null, files ? JSON.stringify(files) : null]
    );

    await writeCellHistory(cellId, userId, 'signed', { status, comment });

    // Push notification (fire-and-forget)
    notifyOnCellAction(cellId, 'sign', userId, { status });

    res.json({ ok: true });
  } catch (err) {
    console.error('Sign cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cells/:id/archive
router.post('/:id/archive', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;

    const existing = await pool.query('SELECT project_id FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query(
      'INSERT INTO cell_archives (cell_id, archived_by) VALUES ($1, $2)',
      [cellId, userId]
    );

    await writeCellHistory(cellId, userId, 'archived');

    res.json({ ok: true });
  } catch (err) {
    console.error('Archive cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/cells/:id/comment
router.post('/:id/comment', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.id;
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Текст комментария обязателен' });
      return;
    }

    const existing = await pool.query('SELECT project_id FROM cells WHERE id = $1', [cellId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ячейка не найдена' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO cell_public_comments (cell_id, user_id, text) VALUES ($1, $2, $3) RETURNING *',
      [cellId, userId, text]
    );

    await writeCellHistory(cellId, userId, 'commented');

    // Push notification (fire-and-forget)
    notifyOnCellAction(cellId, 'comment', userId, { text });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Comment cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
