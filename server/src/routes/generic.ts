/**
 * generic.ts — универсальный CRUD роут (v2).
 * Обрабатывает все запросы supabase.from(table) через адаптер.
 * Подключается как /api/query/:table
 */

import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess, isPortalAdmin, isGlobalReader } from '../middleware/permissions';
import {
  buildSelectSQL, isAllowedTable, resolveTableName,
  requiresProjectAccess, getProjectIdFromQuery,
} from '../middleware/queryParser';

const router = Router();
router.use(authMiddleware);

// ============================================================================
// GET /api/query/:table — SELECT with filters
// ============================================================================

router.get('/:table', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const table = resolveTableName(req.params.table);

    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    // Project access check
    if (requiresProjectAccess(table)) {
      const projectId = getProjectIdFromQuery(req.query as Record<string, string>);
      if (projectId) {
        const admin = await isPortalAdmin(userId);
        const global = await isGlobalReader(userId);
        if (!admin && !global) {
          const access = await hasProjectAccess(userId, projectId);
          if (!access) {
            res.status(403).json({ error: 'Нет доступа к проекту' });
            return;
          }
        }
      }
    }

    const { text, values } = buildSelectSQL(table, req);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SQL] ${table}: ${text}`);
      console.log(`[SQL] values:`, values);
    }
    const result = await pool.query(text, values);
    if (process.env.NODE_ENV !== 'production' && (table === 'cell_overlay_masks' || table.startsWith('company_tpl'))) {
      console.log(`[SQL] ${table} → ${result.rows.length} rows`);
    }

    const isCountOnly = req.query.head === 'true';
    if (isCountOnly) {
      res.json({ count: result.rows[0]?.count || 0 });
      return;
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Generic GET error:', (err as Error).message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/query/:table — INSERT
// ============================================================================

router.post('/:table', async (req: AuthRequest, res: Response) => {
  try {
    const table = resolveTableName(req.params.table);
    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    const body = req.body;
    const isUpsert = body?._upsert === true;
    if (isUpsert) delete body._upsert;

    const rows = Array.isArray(body) ? body : [body];
    const results: unknown[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = Object.values(row).map(v =>
        v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      );
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const quotedKeys = keys.map(k => `"${k}"`).join(', ');

      const sql = isUpsert
        ? `INSERT INTO "${table}" (${quotedKeys}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING *`
        : `INSERT INTO "${table}" (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;

      const result = await pool.query(sql, vals);
      if (result.rows[0]) results.push(result.rows[0]);
    }

    res.status(201).json(results.length === 1 ? results[0] : results);
  } catch (err) {
    console.error('Generic POST error:', (err as Error).message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// PATCH /api/query/:table/:id — UPDATE
// ============================================================================

router.patch('/:table/:id', async (req: AuthRequest, res: Response) => {
  try {
    const table = resolveTableName(req.params.table);
    const id = req.params.id;
    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    const data = req.body as Record<string, unknown>;
    const keys = Object.keys(data);
    const vals = Object.values(data).map(v =>
      v !== null && typeof v === 'object' ? JSON.stringify(v) : v
    );

    if (keys.length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    vals.push(id);

    const result = await pool.query(
      `UPDATE "${table}" SET ${setClauses} WHERE id = $${vals.length} RETURNING *`,
      vals
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Не найдено' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Generic PATCH error:', (err as Error).message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// DELETE /api/query/:table/:id — DELETE single row
// ============================================================================

router.delete('/:table/:id', async (req: AuthRequest, res: Response) => {
  try {
    const table = resolveTableName(req.params.table);
    const id = req.params.id;
    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    const result = await pool.query(
      `DELETE FROM "${table}" WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Не найдено' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Generic DELETE by ID error:', (err as Error).message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// DELETE /api/query/:table — DELETE with query filters
// ============================================================================

router.delete('/:table', async (req: AuthRequest, res: Response) => {
  try {
    const table = resolveTableName(req.params.table);
    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    const q = req.query as Record<string, string>;
    const whereParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, rawValue] of Object.entries(q)) {
      if (key === '_table' || key === 'select') continue;
      const value = rawValue as string;
      if (value.startsWith('eq.')) {
        whereParts.push(`"${key}" = $${idx++}`);
        values.push(value.substring(3));
      } else if (value.startsWith('in.')) {
        const arr = value.substring(3).replace(/^\(/, '').replace(/\)$/, '').split(',');
        const phs = arr.map(() => `$${idx++}`);
        whereParts.push(`"${key}" IN (${phs.join(', ')})`);
        values.push(...arr);
      } else {
        whereParts.push(`"${key}" = $${idx++}`);
        values.push(value);
      }
    }

    if (whereParts.length === 0) {
      res.status(400).json({ error: 'DELETE без фильтров запрещён' });
      return;
    }

    const result = await pool.query(
      `DELETE FROM "${table}" WHERE ${whereParts.join(' AND ')} RETURNING *`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Generic DELETE error:', (err as Error).message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
