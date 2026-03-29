import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isPortalAdmin } from '../middleware/permissions';
import {
  getCompanySubscription, clearSubscriptionCache,
  checkUserLimit, checkProjectLimit, checkStorageLimit,
} from '../middleware/subscription';

const router = Router();
router.use(authMiddleware);

// ============================================================================
// GET /api/subscriptions/status?company_id=... — статус подписки + счётчики
// Доступно: админ компании, портальный админ
// ============================================================================

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const companyId = req.query.company_id as string;
    if (!companyId) {
      res.status(400).json({ error: 'company_id обязателен' });
      return;
    }

    // Проверка доступа: портальный админ или член компании
    const portal = await isPortalAdmin(userId);
    if (!portal) {
      const member = await pool.query(
        'SELECT 1 FROM company_members WHERE company_id = $1 AND user_id = $2',
        [companyId, userId]
      );
      if (member.rows.length === 0) {
        res.status(403).json({ error: 'Нет доступа' });
        return;
      }
    }

    const sub = await getCompanySubscription(companyId);
    const userLimit = await checkUserLimit(companyId);
    const projectLimit = await checkProjectLimit(companyId);
    const storageLimit = await checkStorageLimit(companyId);

    // Проекты с количеством участников
    const projects = await pool.query(
      `SELECT p.id, p.name, count(pm.user_id)::int as member_count
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE p.company_id = $1
       GROUP BY p.id, p.name ORDER BY p.name`,
      [companyId]
    );

    // Компания
    const company = await pool.query(
      'SELECT name FROM companies WHERE id = $1', [companyId]
    );

    res.json({
      company_name: company.rows[0]?.name || '',
      subscription: sub ? {
        status: sub.status,
        expires_at: sub.expires_at,
        suspended_at: sub.suspended_at,
        delete_scheduled_at: sub.delete_scheduled_at,
      } : null,
      limits: {
        users: { current: userLimit.current, max: userLimit.max },
        projects: { current: projectLimit.current, max: projectLimit.max },
        storage: { used_gb: Math.round(storageLimit.usedGb * 100) / 100, max_gb: storageLimit.maxGb },
      },
      projects: projects.rows,
    });
  } catch (err) {
    console.error('Subscription status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/subscriptions/plans — список тарифов
// ============================================================================

router.get('/plans', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY sort_order'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Plans error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/subscriptions — создать/обновить подписку (только портальный админ)
// ============================================================================

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    if (!await isPortalAdmin(userId)) {
      res.status(403).json({ error: 'Только портальный администратор' });
      return;
    }

    const { company_id, plan_id, months, notes } = req.body;
    if (!company_id || !plan_id) {
      res.status(400).json({ error: 'company_id и plan_id обязательны' });
      return;
    }

    const plan = await pool.query('SELECT * FROM subscription_plans WHERE id = $1', [plan_id]);
    if (plan.rows.length === 0) {
      res.status(404).json({ error: 'Тариф не найден' });
      return;
    }

    const duration = (months || 1) * 30;
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

    // Деактивируем старую подписку
    await pool.query(
      `UPDATE company_subscriptions SET status = 'expired'
       WHERE company_id = $1 AND status IN ('trial', 'active')`,
      [company_id]
    );

    // Создаём новую
    const result = await pool.query(
      `INSERT INTO company_subscriptions (company_id, plan_id, status, expires_at, notes)
       VALUES ($1, $2, 'active', $3, $4) RETURNING *`,
      [company_id, plan_id, expiresAt, notes || null]
    );

    // Аудит
    await pool.query(
      `INSERT INTO subscription_history (company_id, action, plan_name, amount, performed_by, details)
       VALUES ($1, 'created', $2, $3, $4, $5)`,
      [company_id, plan.rows[0].name, plan.rows[0].price_monthly * (months || 1),
       userId, JSON.stringify({ months, plan_id })]
    );

    clearSubscriptionCache(company_id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// PATCH /api/subscriptions/:id/suspend — приостановить подписку
// ============================================================================

router.patch('/:id/suspend', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    if (!await isPortalAdmin(userId)) {
      res.status(403).json({ error: 'Только портальный администратор' });
      return;
    }

    const subId = req.params.id;
    const result = await pool.query(
      `UPDATE company_subscriptions
       SET status = 'suspended', suspended_at = NOW(),
           delete_scheduled_at = NOW() + interval '6 months'
       WHERE id = $1 AND status IN ('active', 'trial')
       RETURNING *`,
      [subId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Подписка не найдена или уже приостановлена' });
      return;
    }

    const sub = result.rows[0];
    clearSubscriptionCache(sub.company_id);

    await pool.query(
      `INSERT INTO subscription_history (company_id, action, performed_by, details)
       VALUES ($1, 'suspended', $2, $3)`,
      [sub.company_id, userId, JSON.stringify({ subscription_id: subId })]
    );

    res.json(sub);
  } catch (err) {
    console.error('Suspend subscription error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// PATCH /api/subscriptions/:id/reactivate — реактивировать подписку
// ============================================================================

router.patch('/:id/reactivate', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    if (!await isPortalAdmin(userId)) {
      res.status(403).json({ error: 'Только портальный администратор' });
      return;
    }

    const subId = req.params.id;
    const { months } = req.body;
    const duration = (months || 1) * 30;
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

    const result = await pool.query(
      `UPDATE company_subscriptions
       SET status = 'active', suspended_at = NULL, delete_scheduled_at = NULL, expires_at = $2
       WHERE id = $1 AND status = 'suspended'
       RETURNING *`,
      [subId, expiresAt]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Подписка не найдена или не приостановлена' });
      return;
    }

    const sub = result.rows[0];
    clearSubscriptionCache(sub.company_id);

    await pool.query(
      `INSERT INTO subscription_history (company_id, action, performed_by, details)
       VALUES ($1, 'reactivated', $2, $3)`,
      [sub.company_id, userId, JSON.stringify({ months })]
    );

    res.json(sub);
  } catch (err) {
    console.error('Reactivate subscription error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/subscriptions/history?company_id=... — история подписок
// ============================================================================

router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.query.company_id as string;
    if (!companyId) {
      res.status(400).json({ error: 'company_id обязателен' });
      return;
    }

    const result = await pool.query(
      `SELECT sh.*, u.last_name, u.first_name
       FROM subscription_history sh
       LEFT JOIN users u ON u.id = sh.performed_by
       WHERE sh.company_id = $1
       ORDER BY sh.created_at DESC LIMIT 50`,
      [companyId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Subscription history error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/subscriptions/recalculate-storage — пересчёт хранилища
// ============================================================================

router.post('/recalculate-storage', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    if (!await isPortalAdmin(userId)) {
      res.status(403).json({ error: 'Только портальный администратор' });
      return;
    }

    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({ error: 'company_id обязателен' });
      return;
    }

    const result = await pool.query('SELECT calculate_company_storage($1) as total', [company_id]);
    clearSubscriptionCache(company_id);

    res.json({ storage_bytes: result.rows[0].total });
  } catch (err) {
    console.error('Recalculate storage error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
