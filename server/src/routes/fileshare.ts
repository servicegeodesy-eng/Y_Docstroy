import { Router, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hasProjectAccess } from '../middleware/permissions.js';

const router = Router();
router.use(authMiddleware);

// GET /api/fileshare?project_id=...
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = parseInt(req.query.project_id as string, 10);

    if (!projectId) {
      res.status(400).json({ error: 'project_id обязателен' });
      return;
    }

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const shares = await pool.query(
      `SELECT fs.*,
        creator.last_name || ' ' || creator.first_name AS creator_name
      FROM file_shares fs
      LEFT JOIN users creator ON fs.created_by = creator.id
      WHERE fs.project_id = $1
      ORDER BY fs.created_at DESC`,
      [projectId]
    );

    const shareIds = shares.rows.map((s: { id: number }) => s.id);

    if (shareIds.length > 0) {
      const [recipients, files] = await Promise.all([
        pool.query(
          `SELECT fsr.*, u.last_name, u.first_name, u.display_name
           FROM file_share_recipients fsr
           JOIN users u ON u.id = fsr.user_id
           WHERE fsr.file_share_id = ANY($1)`,
          [shareIds]
        ),
        pool.query(
          'SELECT * FROM file_share_files WHERE file_share_id = ANY($1)',
          [shareIds]
        ),
      ]);

      const recipientsMap = new Map<number, object[]>();
      for (const r of recipients.rows) {
        if (!recipientsMap.has(r.file_share_id)) recipientsMap.set(r.file_share_id, []);
        recipientsMap.get(r.file_share_id)!.push(r);
      }

      const filesMap = new Map<number, object[]>();
      for (const f of files.rows) {
        if (!filesMap.has(f.file_share_id)) filesMap.set(f.file_share_id, []);
        filesMap.get(f.file_share_id)!.push(f);
      }

      for (const share of shares.rows) {
        share.recipients = recipientsMap.get(share.id) || [];
        share.files = filesMap.get(share.id) || [];
      }
    }

    res.json(shares.rows);
  } catch (err) {
    console.error('Get fileshares error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/fileshare
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { project_id, title, description, recipients, files } = req.body;

    if (!project_id) {
      res.status(400).json({ error: 'project_id обязателен' });
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

      const shareResult = await client.query(
        `INSERT INTO file_shares (project_id, title, description, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [project_id, title || null, description || null, userId]
      );
      const share = shareResult.rows[0];

      if (Array.isArray(recipients)) {
        for (const recipientId of recipients) {
          await client.query(
            'INSERT INTO file_share_recipients (file_share_id, user_id) VALUES ($1, $2)',
            [share.id, recipientId]
          );
        }
      }

      if (Array.isArray(files)) {
        for (const file of files) {
          await client.query(
            'INSERT INTO file_share_files (file_share_id, file_name, storage_path, file_size, mime_type) VALUES ($1, $2, $3, $4, $5)',
            [share.id, file.file_name, file.storage_path, file.file_size || null, file.mime_type || null]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json(share);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create fileshare error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/fileshare/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const shareId = parseInt(req.params.id, 10);

    const shareResult = await pool.query('SELECT * FROM file_shares WHERE id = $1', [shareId]);
    if (shareResult.rows.length === 0) {
      res.status(404).json({ error: 'Файлообмен не найден' });
      return;
    }

    const share = shareResult.rows[0];
    const access = await hasProjectAccess(userId, share.project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    const [recipients, files] = await Promise.all([
      pool.query(
        `SELECT fsr.*, u.last_name, u.first_name, u.display_name
         FROM file_share_recipients fsr
         JOIN users u ON u.id = fsr.user_id
         WHERE fsr.file_share_id = $1`,
        [shareId]
      ),
      pool.query('SELECT * FROM file_share_files WHERE file_share_id = $1', [shareId]),
    ]);

    share.recipients = recipients.rows;
    share.files = files.rows;

    res.json(share);
  } catch (err) {
    console.error('Get fileshare error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/fileshare/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const shareId = parseInt(req.params.id, 10);

    const existing = await pool.query('SELECT project_id FROM file_shares WHERE id = $1', [shareId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Файлообмен не найден' });
      return;
    }

    const access = await hasProjectAccess(userId, existing.rows[0].project_id);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    await pool.query('DELETE FROM file_shares WHERE id = $1', [shareId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete fileshare error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
