import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isPortalAdmin } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

// GET /api/companies — список компаний пользователя
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const admin = await isPortalAdmin(userId);

    let rows;
    if (admin) {
      const result = await pool.query(
        `SELECT c.*, cm.role AS my_role
         FROM companies c
         LEFT JOIN company_members cm ON cm.company_id = c.id AND cm.user_id = $1
         ORDER BY c.created_at DESC`,
        [userId]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT c.*, cm.role AS my_role
         FROM companies c
         JOIN company_members cm ON cm.company_id = c.id
         WHERE cm.user_id = $1
         ORDER BY c.created_at DESC`,
        [userId]
      );
      rows = result.rows;
    }

    res.json(rows);
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/companies/:id — одна компания
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const companyId = req.params.id;

    const result = await pool.query(
      `SELECT c.*, cm.role AS my_role
       FROM companies c
       LEFT JOIN company_members cm ON cm.company_id = c.id AND cm.user_id = $2
       WHERE c.id = $1`,
      [companyId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Компания не найдена' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get company error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/companies — создать компанию
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, inn } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Название компании обязательно' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO companies (name, inn, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, inn || null, userId]
    );

    // Триггер trg_company_add_owner автоматически добавит создателя как owner

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Компания с таким названием уже существует' });
      return;
    }
    console.error('Create company error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/companies/:id — обновить компанию
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const companyId = req.params.id;
    const { name, inn } = req.body;

    // Проверяем права: owner/admin компании или портальный админ
    const admin = await isPortalAdmin(userId);
    if (!admin) {
      const memberCheck = await pool.query(
        `SELECT role FROM company_members
         WHERE company_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')`,
        [companyId, userId]
      );
      if (memberCheck.rows.length === 0) {
        res.status(403).json({ error: 'Нет прав на редактирование компании' });
        return;
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (inn !== undefined) { fields.push(`inn = $${idx++}`); values.push(inn); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    values.push(companyId);

    const result = await pool.query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Компания не найдена' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/companies/:id/members — участники компании
router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.params.id;

    const result = await pool.query(
      `SELECT cm.id, cm.user_id, cm.role, cm.joined_at,
              u.last_name, u.first_name, u.middle_name, u.display_name, u.email
       FROM company_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.company_id = $1
       ORDER BY cm.role, u.last_name`,
      [companyId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get company members error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/companies/:id/members — добавить участника
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const companyId = req.params.id;
    const { user_id, role } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id обязателен' });
      return;
    }

    // Проверяем права
    const admin = await isPortalAdmin(userId);
    if (!admin) {
      const memberCheck = await pool.query(
        `SELECT role FROM company_members
         WHERE company_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')`,
        [companyId, userId]
      );
      if (memberCheck.rows.length === 0) {
        res.status(403).json({ error: 'Нет прав на управление участниками' });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO company_members (company_id, user_id, role)
       VALUES ($1, $2, $3::company_role)
       ON CONFLICT (company_id, user_id) DO UPDATE SET role = $3::company_role
       RETURNING *`,
      [companyId, user_id, role || 'member']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add company member error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/companies/:id/members/:userId — удалить участника
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId!;
    const companyId = req.params.id;
    const targetUserId = req.params.userId;

    // Проверяем права
    const admin = await isPortalAdmin(currentUserId);
    if (!admin) {
      const memberCheck = await pool.query(
        `SELECT role FROM company_members
         WHERE company_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')`,
        [companyId, currentUserId]
      );
      if (memberCheck.rows.length === 0) {
        res.status(403).json({ error: 'Нет прав на управление участниками' });
        return;
      }
    }

    await pool.query(
      'DELETE FROM company_members WHERE company_id = $1 AND user_id = $2',
      [companyId, targetUserId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Remove company member error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/companies/:id/subscription — подписка компании
router.get('/:id/subscription', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.params.id;

    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE company_id = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
