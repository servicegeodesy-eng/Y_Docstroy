import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const ALLOWED_FUNCTIONS = new Set([
  'get_auth_startup_data',
  'search_users_for_login',
  'get_user_email_for_login',
  'seed_default_statuses',
  'seed_default_dictionaries',
  'seed_cell_action_permissions',
  'create_project_with_owner',
  'get_projects_for_registration',
  'get_project_organizations_for_reg',
]);

// POST /api/rpc/:functionName
router.post('/:functionName', async (req: AuthRequest, res: Response) => {
  try {
    const { functionName } = req.params;

    if (!ALLOWED_FUNCTIONS.has(functionName)) {
      res.status(400).json({ error: `Функция ${functionName} не поддерживается` });
      return;
    }

    const params = req.body || {};
    const paramKeys = Object.keys(params);
    const paramValues = Object.values(params);

    let query: string;

    if (paramKeys.length === 0) {
      query = `SELECT * FROM ${functionName}()`;
    } else {
      const paramList = paramKeys
        .map((key, i) => `${key} := $${i + 1}`)
        .join(', ');
      query = `SELECT * FROM ${functionName}(${paramList})`;
    }

    const result = await pool.query(query, paramValues);

    res.json(result.rows);
  } catch (err) {
    console.error(`RPC ${req.params.functionName} error:`, err);
    res.status(500).json({ error: 'Ошибка выполнения функции' });
  }
});

export default router;
