import { Router, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hasProjectAccess } from '../middleware/permissions.js';

const router = Router();
router.use(authMiddleware);

// GET /api/tasks?project_id=...&user_id=...
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projectId = parseInt(req.query.project_id as string, 10);
    const targetUserId = parseInt(req.query.user_id as string, 10) || userId;

    if (!projectId) {
      res.status(400).json({ error: 'project_id обязателен' });
      return;
    }

    const access = await hasProjectAccess(userId, projectId);
    if (!access) {
      res.status(403).json({ error: 'Нет доступа к проекту' });
      return;
    }

    // Cells assigned to user
    const assignedResult = await pool.query(
      `SELECT c.*,
        b.name AS building_name, f.name AS floor_name,
        wt.name AS work_type_name,
        creator.last_name || ' ' || creator.first_name AS creator_name
      FROM cells c
      LEFT JOIN dict_buildings b ON c.building_id = b.id
      LEFT JOIN dict_floors f ON c.floor_id = f.id
      LEFT JOIN dict_work_types wt ON c.work_type_id = wt.id
      LEFT JOIN users creator ON c.created_by = creator.id
      WHERE c.project_id = $1 AND c.assigned_to = $2
      ORDER BY c.updated_at DESC`,
      [projectId, targetUserId]
    );

    // Cells awaiting user's signature
    const pendingSignResult = await pool.query(
      `SELECT DISTINCT c.*,
        b.name AS building_name, f.name AS floor_name,
        creator.last_name || ' ' || creator.first_name AS creator_name
      FROM cells c
      LEFT JOIN dict_buildings b ON c.building_id = b.id
      LEFT JOIN dict_floors f ON c.floor_id = f.id
      LEFT JOIN users creator ON c.created_by = creator.id
      JOIN cell_shares cs ON cs.cell_id = c.id AND cs.to_user_id = $2
      LEFT JOIN cell_signatures csig ON csig.cell_id = c.id AND csig.user_id = $2
      WHERE c.project_id = $1 AND csig.id IS NULL
      ORDER BY c.updated_at DESC`,
      [projectId, targetUserId]
    );

    res.json({
      assigned: assignedResult.rows,
      pending_signatures: pendingSignResult.rows,
    });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
