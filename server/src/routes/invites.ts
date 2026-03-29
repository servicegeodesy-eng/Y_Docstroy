import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isPortalAdmin, isProjectAdmin } from '../middleware/permissions';
import { checkUserLimit } from '../middleware/subscription';

const router = Router();
router.use(authMiddleware);

// Генерация короткого кода
function generateCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

// ============================================================================
// Проверка иерархии: кто может приглашать
// ============================================================================

async function canInvite(userId: string, companyId: string, projectId?: string): Promise<boolean> {
  // Портальный админ может всё
  if (await isPortalAdmin(userId)) return true;

  // Админ/owner компании может приглашать в свою компанию и её проекты
  const companyRole = await pool.query(
    `SELECT role FROM company_members WHERE company_id = $1 AND user_id = $2`,
    [companyId, userId]
  );
  const role = companyRole.rows[0]?.role;
  if (role === 'owner' || role === 'admin') {
    // Если указан проект — проверяем что он принадлежит этой компании
    if (projectId) {
      const projectCheck = await pool.query(
        `SELECT 1 FROM projects WHERE id = $1 AND company_id = $2`,
        [projectId, companyId]
      );
      if (projectCheck.rows.length === 0) return false;
    }
    return true;
  }

  // Админ проекта может приглашать в свой проект
  if (projectId) {
    return isProjectAdmin(userId, projectId);
  }

  return false;
}

// ============================================================================
// POST /api/invites — создать инвайт
// ============================================================================

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { company_id, project_id, role, max_uses, expires_days } = req.body;

    if (!company_id) {
      res.status(400).json({ error: 'company_id обязателен' });
      return;
    }

    if (!await canInvite(userId, company_id, project_id)) {
      res.status(403).json({ error: 'Нет прав для создания приглашения' });
      return;
    }

    const code = generateCode();
    const days = expires_days || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const result = await pool.query(
      `INSERT INTO invites (company_id, project_id, role, code, max_uses, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [company_id, project_id || null, role || 'member', code, max_uses || 1, userId, expiresAt]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/invites/check/:code — проверить инвайт (публичный, без auth)
// ============================================================================

router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT i.id, i.company_id, i.project_id, i.role, i.max_uses, i.used_count, i.expires_at,
              c.name as company_name, p.name as project_name
       FROM invites i
       JOIN companies c ON c.id = i.company_id
       LEFT JOIN projects p ON p.id = i.project_id
       WHERE i.code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Приглашение не найдено' });
      return;
    }

    const invite = result.rows[0];

    if (new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'Приглашение истекло' });
      return;
    }

    if (invite.max_uses > 0 && invite.used_count >= invite.max_uses) {
      res.status(410).json({ error: 'Приглашение уже использовано' });
      return;
    }

    res.json({
      company_name: invite.company_name,
      project_name: invite.project_name,
      role: invite.role,
      expires_at: invite.expires_at,
    });
  } catch (err) {
    console.error('Check invite error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/invites/accept/:code — принять инвайт (auth required)
// ============================================================================

router.post('/accept/:code', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { code } = req.params;

    const result = await pool.query(
      `SELECT * FROM invites WHERE code = $1`, [code]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Приглашение не найдено' });
      return;
    }

    const invite = result.rows[0];

    if (new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'Приглашение истекло' });
      return;
    }

    if (invite.max_uses > 0 && invite.used_count >= invite.max_uses) {
      res.status(410).json({ error: 'Приглашение уже использовано' });
      return;
    }

    // Проверка лимита пользователей
    const userCheck = await checkUserLimit(invite.company_id);
    if (!userCheck.allowed) {
      res.status(403).json({ error: `Лимит пользователей исчерпан (${userCheck.current}/${userCheck.max})` });
      return;
    }

    // Добавляем в компанию
    await pool.query(
      `INSERT INTO company_members (company_id, user_id, role)
       VALUES ($1, $2, $3) ON CONFLICT (company_id, user_id) DO NOTHING`,
      [invite.company_id, userId, invite.project_id ? 'member' : invite.role]
    );

    // Если указан проект — добавляем в проект с ролью
    if (invite.project_id) {
      await pool.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO NOTHING`,
        [invite.project_id, userId, invite.role]
      );
    }

    // Инкрементируем счётчик использований
    await pool.query(
      `UPDATE invites SET used_count = used_count + 1 WHERE id = $1`,
      [invite.id]
    );

    res.json({ ok: true, company_id: invite.company_id, project_id: invite.project_id });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/invites/register-and-accept/:code — регистрация + принятие (без auth)
// ============================================================================

router.post('/register-and-accept/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { last_name, first_name, middle_name, password } = req.body;

    if (!last_name || !first_name || !password) {
      res.status(400).json({ error: 'Фамилия, имя и пароль обязательны' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      return;
    }

    // Проверяем инвайт
    const invResult = await pool.query(`SELECT * FROM invites WHERE code = $1`, [code]);
    if (invResult.rows.length === 0) {
      res.status(404).json({ error: 'Приглашение не найдено' });
      return;
    }

    const invite = invResult.rows[0];

    if (new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'Приглашение истекло' });
      return;
    }
    if (invite.max_uses > 0 && invite.used_count >= invite.max_uses) {
      res.status(410).json({ error: 'Приглашение уже использовано' });
      return;
    }

    // Создаём пользователя
    const password_hash = await bcrypt.hash(password, 12);
    const display_name = [last_name, first_name, middle_name].filter(Boolean).join(' ');
    const email = `user_${crypto.randomUUID().slice(0, 8)}@portal.local`;

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, last_name, first_name, middle_name, display_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email`,
      [email, password_hash, last_name, first_name, middle_name || null, display_name]
    );
    const userId = userResult.rows[0].id;

    // Проверка лимита пользователей
    const userCheck = await checkUserLimit(invite.company_id);
    if (!userCheck.allowed) {
      // Откатываем создание пользователя
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      res.status(403).json({ error: `Лимит пользователей исчерпан (${userCheck.current}/${userCheck.max})` });
      return;
    }

    // Добавляем в компанию
    await pool.query(
      `INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)`,
      [invite.company_id, userId, invite.project_id ? 'member' : invite.role]
    );

    // Добавляем в проект
    if (invite.project_id) {
      await pool.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)`,
        [invite.project_id, userId, invite.role]
      );
    }

    // Инкрементируем счётчик
    await pool.query(
      `UPDATE invites SET used_count = used_count + 1 WHERE id = $1`, [invite.id]
    );

    res.status(201).json({ ok: true, user_id: userId, email });
  } catch (err) {
    console.error('Register and accept invite error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/invites?company_id=...&project_id=... — список инвайтов
// ============================================================================

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const companyId = req.query.company_id as string;
    const projectId = req.query.project_id as string;

    if (!companyId) {
      res.status(400).json({ error: 'company_id обязателен' });
      return;
    }

    if (!await canInvite(userId, companyId, projectId)) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    let query = `SELECT i.*, u.last_name, u.first_name FROM invites i
                 JOIN users u ON u.id = i.created_by
                 WHERE i.company_id = $1`;
    const params: unknown[] = [companyId];

    if (projectId) {
      query += ` AND i.project_id = $2`;
      params.push(projectId);
    }

    query += ` ORDER BY i.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List invites error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// DELETE /api/invites/:id — удалить инвайт
// ============================================================================

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const inviteId = req.params.id;

    const invite = await pool.query(`SELECT * FROM invites WHERE id = $1`, [inviteId]);
    if (invite.rows.length === 0) {
      res.status(404).json({ error: 'Не найдено' });
      return;
    }

    if (!await canInvite(userId, invite.rows[0].company_id, invite.rows[0].project_id)) {
      res.status(403).json({ error: 'Нет прав' });
      return;
    }

    await pool.query(`DELETE FROM invites WHERE id = $1`, [inviteId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete invite error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/invites/reset-password — сброс пароля с иерархией
// Портальный админ → админ компании
// Админ компании → админ проекта
// Админ проекта → участник проекта
// ============================================================================

router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.userId!;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      res.status(400).json({ error: 'target_user_id обязателен' });
      return;
    }

    // Проверяем иерархию
    const canReset = await checkResetHierarchy(adminId, target_user_id);
    if (!canReset) {
      res.status(403).json({ error: 'Нет прав для сброса пароля этого пользователя' });
      return;
    }

    const tempPassword = crypto.randomBytes(6).toString('base64url').slice(0, 8);
    const password_hash = await bcrypt.hash(tempPassword, 12);

    await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2`,
      [password_hash, target_user_id]
    );

    res.json({ temp_password: tempPassword });
  } catch (err) {
    console.error('Hierarchy reset password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

async function checkResetHierarchy(adminId: string, targetId: string): Promise<boolean> {
  // Портальный админ может сбрасывать всем
  if (await isPortalAdmin(adminId)) return true;

  // Админ компании → пользователям своих компаний
  const adminCompanies = await pool.query(
    `SELECT company_id FROM company_members WHERE user_id = $1 AND role IN ('owner', 'admin')`,
    [adminId]
  );
  if (adminCompanies.rows.length > 0) {
    const companyIds = adminCompanies.rows.map(r => r.company_id);
    const targetInCompany = await pool.query(
      `SELECT 1 FROM company_members WHERE user_id = $1 AND company_id = ANY($2)`,
      [targetId, companyIds]
    );
    if (targetInCompany.rows.length > 0) return true;
  }

  // Админ проекта → участникам своих проектов
  const adminProjects = await pool.query(
    `SELECT project_id FROM project_members WHERE user_id = $1 AND role = 'admin'`,
    [adminId]
  );
  if (adminProjects.rows.length > 0) {
    const projectIds = adminProjects.rows.map(r => r.project_id);
    const targetInProject = await pool.query(
      `SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = ANY($2)`,
      [targetId, projectIds]
    );
    if (targetInProject.rows.length > 0) return true;
  }

  return false;
}

// ============================================================================
// GET /api/invites/member-counts?company_id=... — счётчики участников
// ============================================================================

router.get('/member-counts', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.query.company_id as string;

    if (!companyId) {
      res.status(400).json({ error: 'company_id обязателен' });
      return;
    }

    // Кол-во участников компании
    const companyCount = await pool.query(
      `SELECT count(*)::int as cnt FROM company_members WHERE company_id = $1`,
      [companyId]
    );

    // Кол-во участников по проектам компании
    const projectCounts = await pool.query(
      `SELECT p.id as project_id, p.name as project_name, count(pm.user_id)::int as member_count
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE p.company_id = $1
       GROUP BY p.id, p.name
       ORDER BY p.name`,
      [companyId]
    );

    // Лимит из подписки (если есть)
    const subscription = await pool.query(
      `SELECT sp.max_users, sp.max_projects, cs.status, cs.expires_at
       FROM company_subscriptions cs
       JOIN subscription_plans sp ON sp.id = cs.plan_id
       WHERE cs.company_id = $1
       ORDER BY cs.created_at DESC LIMIT 1`,
      [companyId]
    );

    const sub = subscription.rows[0] || null;

    res.json({
      company_members: companyCount.rows[0].cnt,
      projects: projectCounts.rows,
      subscription: sub ? {
        max_users: sub.max_users,
        max_projects: sub.max_projects,
        status: sub.status,
        expires_at: sub.expires_at,
      } : null,
    });
  } catch (err) {
    console.error('Member counts error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
