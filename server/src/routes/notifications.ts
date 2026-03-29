import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/notifications?user_id=...&limit=20
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetUserId = req.query.user_id as string || userId;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

    // Users can only see their own notifications (unless admin logic is needed)
    if (targetUserId !== userId) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [targetUserId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const notificationId = req.params.id;

    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Уведомление не найдено' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/notifications/read-by-cell/:cellId — пометить все уведомления по ячейке как прочитанные
router.patch('/read-by-cell/:cellId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cellId = req.params.cellId;

    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND cell_id = $2 AND is_read = false RETURNING id',
      [userId, cellId]
    );

    res.json({ ok: true, updated: result.rowCount });
  } catch (err) {
    console.error('Mark notifications read by cell error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/notifications/read
router.delete('/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true',
      [userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete read notifications error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
