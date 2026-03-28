import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET || '', {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
  } as jwt.SignOptions);
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || '', {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as string,
  } as jwt.SignOptions);
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

function generateTempPassword(length = 8): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email и пароль обязательны' });
      return;
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, last_name, first_name, middle_name, is_portal_admin, is_global_reader FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const access_token = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.json({
      access_token,
      user: {
        id: user.id,
        email: user.email,
        last_name: user.last_name,
        first_name: user.first_name,
        middle_name: user.middle_name,
        is_portal_admin: user.is_portal_admin,
        is_global_reader: user.is_global_reader,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login-by-name
router.post('/login-by-name', async (req: AuthRequest, res: Response) => {
  try {
    const { query, password } = req.body;

    if (!query || !password) {
      res.status(400).json({ error: 'Имя и пароль обязательны' });
      return;
    }

    const searchTerm = query.trim();

    const result = await pool.query(
      `SELECT id, email, display_name, password_hash, last_name, first_name, middle_name, is_portal_admin, is_global_reader
       FROM users
       WHERE lower(last_name) = lower($1)
          OR lower(last_name) LIKE lower($2)
          OR lower(display_name) = lower($1)
          OR lower(display_name) LIKE lower($2)`,
      [searchTerm, searchTerm + '%']
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    let user = result.rows[0];

    // If multiple matches, try exact display_name match
    if (result.rows.length > 1) {
      const exact = result.rows.find(
        (u: { display_name: string }) => u.display_name?.toLowerCase() === query.trim().toLowerCase()
      );
      if (exact) {
        user = exact;
      } else {
        res.status(400).json({ error: 'Найдено несколько пользователей, уточните ФИО' });
        return;
      }
    }

    console.log(`[DEBUG] User found: ${user.last_name}, hash starts: ${user.password_hash?.substring(0, 10)}, hash length: ${user.password_hash?.length}`);
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log(`[DEBUG] bcrypt.compare result: ${valid}`);

    if (!valid) {
      res.status(401).json({ error: 'Неверный пароль' });
      return;
    }

    const access_token = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.json({
      access_token,
      user: {
        id: user.id,
        email: user.email,
        last_name: user.last_name,
        first_name: user.first_name,
        middle_name: user.middle_name,
        is_portal_admin: user.is_portal_admin,
        is_global_reader: user.is_global_reader,
      },
    });
  } catch (err) {
    console.error('Login by name error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, last_name, first_name, middle_name, structure, organization, position, phone, project_id } = req.body;

    if (!email || !password || !last_name || !first_name) {
      res.status(400).json({ error: 'Email, пароль, фамилия и имя обязательны' });
      return;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const display_name = [last_name, first_name, middle_name].filter(Boolean).join(' ');

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, last_name, first_name, middle_name, display_name, structure, organization, position, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email`,
      [email, password_hash, last_name, first_name, middle_name || null, display_name, structure || null, organization || null, position || null, phone || null]
    );

    const user = result.rows[0];

    if (project_id) {
      await pool.query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member')",
        [project_id, user.id]
      );
    }

    res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      res.status(401).json({ error: 'Refresh token не предоставлен' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || '') as { userId: string };
    const access_token = generateAccessToken(decoded.userId);

    res.json({ access_token });
  } catch {
    res.status(401).json({ error: 'Недействительный refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: AuthRequest, res: Response) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, email, last_name, first_name, middle_name, display_name,
              structure, organization, position, phone,
              is_portal_admin, is_global_reader, must_change_password,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/auth/startup
router.get('/startup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [profileResult, membershipsResult, permissionsResult] = await Promise.all([
      pool.query(
        `SELECT is_portal_admin, is_global_reader, must_change_password,
                last_name, first_name, middle_name
         FROM users WHERE id = $1`,
        [req.userId]
      ),
      pool.query(
        `SELECT pm.project_id, pm.project_role, pm.role,
                p.name AS project_name, p.description AS project_description
         FROM project_members pm
         JOIN projects p ON p.id = pm.project_id
         WHERE pm.user_id = $1`,
        [req.userId]
      ),
      pool.query('SELECT * FROM portal_role_permissions'),
    ]);

    res.json({
      profile: profileResult.rows[0] || null,
      memberships: membershipsResult.rows,
      portal_role_permissions: permissionsResult.rows,
    });
  } catch (err) {
    console.error('Startup error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;

    if (!new_password) {
      res.status(400).json({ error: 'Новый пароль обязателен' });
      return;
    }

    const result = await pool.query('SELECT password_hash, must_change_password FROM users WHERE id = $1', [req.userId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Если must_change_password — не требуем текущий пароль (вход по временному)
    if (!result.rows[0].must_change_password) {
      if (!current_password) {
        res.status(400).json({ error: 'Текущий пароль обязателен' });
        return;
      }
      const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Неверный текущий пароль' });
        return;
      }
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [password_hash, req.userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email обязателен' });
      return;
    }

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      // Don't reveal whether the email exists
      res.json({ ok: true });
      return;
    }

    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2',
      [password_hash, result.rows[0].id]
    );

    console.log(`[RESET PASSWORD] User ${email}: temp password = ${tempPassword}`);

    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/admin-reset-password
router.post('/admin-reset-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Check admin
    const adminResult = await pool.query('SELECT is_portal_admin FROM users WHERE id = $1', [req.userId]);
    if (!adminResult.rows[0]?.is_portal_admin) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const { target_user_id } = req.body;

    if (!target_user_id) {
      res.status(400).json({ error: 'target_user_id обязателен' });
      return;
    }

    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, 12);

    const result = await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2 RETURNING id',
      [password_hash, target_user_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json({ temp_password: tempPassword });
  } catch (err) {
    console.error('Admin reset password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/auth/user/:id
router.delete('/user/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Check admin
    const adminResult = await pool.query('SELECT is_portal_admin FROM users WHERE id = $1', [req.userId]);
    if (!adminResult.rows[0]?.is_portal_admin) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const targetId = req.params.id;

    if (!targetId) {
      res.status(400).json({ error: 'Некорректный ID пользователя' });
      return;
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [targetId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
