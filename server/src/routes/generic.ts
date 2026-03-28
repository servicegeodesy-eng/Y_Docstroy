/**
 * generic.ts — универсальный CRUD роут.
 * Обрабатывает все запросы supabase.from(table) через адаптер.
 * Подключается ПОСЛЕДНИМ как fallback.
 */

import { Router, Response } from 'express';
import pool from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasProjectAccess, isPortalAdmin, isGlobalReader } from '../middleware/permissions';
import {
  parseQuery, buildSelectSQL,
  isAllowedTable, resolveTableName,
  requiresProjectAccess, getProjectIdColumn,
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

    // Parse query parameters
    const parsed = parseQuery(req, table);

    // Project access check
    if (requiresProjectAccess(table)) {
      const projectIdCol = getProjectIdColumn(table);
      if (projectIdCol) {
        // Find project_id from filters
        const projFilter = parsed.filters.find((f) => f.column === projectIdCol);
        if (projFilter) {
          const admin = await isPortalAdmin(userId);
          const global = await isGlobalReader(userId);
          if (!admin && !global) {
            const access = await hasProjectAccess(userId, String(projFilter.value));
            if (!access) {
              res.status(403).json({ error: 'Нет доступа к проекту' });
              return;
            }
          }
        }
      }
    }

    const { text, values } = buildSelectSQL(table, parsed);
    const result = await pool.query(text, values);

    if (parsed.countOnly) {
      res.json({ count: result.rows[0]?.count || 0 });
      return;
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Generic GET error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// GET /api/query/:table/:id — SELECT single row
// ============================================================================

router.get('/:table/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const table = resolveTableName(req.params.table);
    const id = req.params.id;

    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    // Parse select for JOINs
    const parsed = parseQuery(req, table);
    // Add id filter
    parsed.filters.push({ column: 'id', op: 'eq', value: id, paramIndex: 0 });

    const { text, values } = buildSelectSQL(table, parsed);
    const result = await pool.query(text, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Не найдено' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Generic GET by ID error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// POST /api/query/:table — INSERT
// ============================================================================

router.post('/:table', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const table = resolveTableName(req.params.table);

    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    const body = req.body;
    const isUpsert = body?._upsert === true;
    if (isUpsert) delete body._upsert;

    // Strip internal filter keys
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!k.startsWith('_filter_')) data[k] = v;
    }

    // Project access check
    if (requiresProjectAccess(table)) {
      const projectIdCol = getProjectIdColumn(table);
      if (projectIdCol && data[projectIdCol]) {
        const admin = await isPortalAdmin(userId);
        if (!admin) {
          const access = await hasProjectAccess(userId, String(data[projectIdCol]));
          if (!access) {
            res.status(403).json({ error: 'Нет доступа к проекту' });
            return;
          }
        }
      }
    }

    // Handle array inserts
    const rows = Array.isArray(data) ? data : [data];
    const results: unknown[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const quotedKeys = keys.map((k) => `"${k}"`).join(', ');

      let sql: string;
      if (isUpsert) {
        // Simple upsert — ON CONFLICT DO UPDATE
        sql = `INSERT INTO "${table}" (${quotedKeys}) VALUES (${placeholders})
               ON CONFLICT DO NOTHING
               RETURNING *`;
      } else {
        sql = `INSERT INTO "${table}" (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;
      }

      const result = await pool.query(sql, vals);
      if (result.rows[0]) results.push(result.rows[0]);
    }

    res.status(201).json(results.length === 1 ? results[0] : results);
  } catch (err) {
    console.error('Generic POST error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// PATCH /api/query/:table/:id — UPDATE
// ============================================================================

router.patch('/:table/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const table = resolveTableName(req.params.table);
    const id = req.params.id;

    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    // Strip internal filter keys
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (!k.startsWith('_filter_')) data[k] = v;
    }

    // Project access check
    if (requiresProjectAccess(table)) {
      const projectIdCol = getProjectIdColumn(table);
      if (projectIdCol) {
        // Get project_id from existing record
        const existing = await pool.query(
          `SELECT "${projectIdCol}" FROM "${table}" WHERE id = $1`,
          [id]
        );
        if (existing.rows.length > 0 && existing.rows[0][projectIdCol]) {
          const admin = await isPortalAdmin(userId);
          if (!admin) {
            const access = await hasProjectAccess(userId, existing.rows[0][projectIdCol]);
            if (!access) {
              res.status(403).json({ error: 'Нет доступа к проекту' });
              return;
            }
          }
        }
      }
    }

    const keys = Object.keys(data);
    const vals = Object.values(data);

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
    console.error('Generic PATCH error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================================================
// DELETE /api/query/:table — DELETE with filters (no :id)
// ============================================================================

router.delete('/:table', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const table = resolveTableName(req.params.table);

    if (!isAllowedTable(table)) {
      res.status(400).json({ error: `Таблица ${table} не поддерживается` });
      return;
    }

    // Build WHERE from query params
    const parsed = parseQuery(req, table);
    if (parsed.filters.length === 0) {
      res.status(400).json({ error: 'DELETE без фильтров запрещён' });
      return;
    }

    const whereParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const f of parsed.filters) {
      switch (f.op) {
        case 'eq':
          whereParts.push(`"${table}"."${f.column}" = $${idx++}`);
          values.push(f.value);
          break;
        case 'in': {
          const arr = f.value as string[];
          const ph = arr.map(() => `$${idx++}`);
          whereParts.push(`"${table}"."${f.column}" IN (${ph.join(', ')})`);
          values.push(...arr);
          break;
        }
        default:
          whereParts.push(`"${table}"."${f.column}" = $${idx++}`);
          values.push(f.value);
      }
    }

    const result = await pool.query(
      `DELETE FROM "${table}" WHERE ${whereParts.join(' AND ')} RETURNING *`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Generic DELETE error:', err);
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
    console.error('Generic DELETE by ID error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
