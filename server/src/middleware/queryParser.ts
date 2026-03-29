/**
 * queryParser.ts — парсер PostgREST-совместимых query-параметров (v2).
 *
 * Фронтенд-адаптер supabase.ts отправляет:
 *   ?column=op.value      — фильтры
 *   ?select=col,table(c)  — колонки + JOIN-ы
 *   ?order=col.desc       — сортировка
 *   ?limit=N&offset=N     — пагинация
 */

import { Request } from 'express';

// ============================================================================
// FK metadata
// ============================================================================

/** Forward FK: main_table.column → referenced_table.id */
const FK_MAP: Record<string, Record<string, string>> = {
  cells: {
    building_id: 'dict_buildings', floor_id: 'dict_floors',
    work_type_id: 'dict_work_types', construction_id: 'dict_constructions',
    set_id: 'dict_sets', work_id: 'dict_works', work_stage_id: 'dict_work_stages',
    project_id: 'projects', created_by: 'users', assigned_to: 'users',
    assigned_by: 'users', original_sender_id: 'users',
  },
  cell_files: { cell_id: 'cells', uploaded_by: 'users' },
  cell_file_versions: { file_id: 'cell_files', uploaded_by: 'users' },
  cell_comments: { cell_id: 'cells', user_id: 'users' },
  cell_comment_files: { comment_id: 'cell_comments', uploaded_by: 'users' },
  cell_public_comments: { cell_id: 'cells', user_id: 'users' },
  cell_history: { cell_id: 'cells', user_id: 'users' },
  cell_shares: { cell_id: 'cells', from_user_id: 'users', to_user_id: 'users' },
  cell_signatures: { cell_id: 'cells', user_id: 'users' },
  cell_archives: { cell_id: 'cells', user_id: 'users' },
  cell_overlay_masks: { cell_id: 'cells', overlay_id: 'dict_overlays' },
  file_shares: {
    project_id: 'projects', created_by: 'users',
    building_id: 'dict_buildings', floor_id: 'dict_floors',
    work_type_id: 'dict_work_types', construction_id: 'dict_constructions',
    work_id: 'dict_works',
  },
  file_share_recipients: { share_id: 'file_shares', user_id: 'users' },
  file_share_files: { share_id: 'file_shares' },
  file_share_overlay_masks: { share_id: 'file_shares', overlay_id: 'dict_overlays' },
  project_members: { project_id: 'projects', user_id: 'users', organization_id: 'project_organizations' },
  project_statuses: { project_id: 'projects' },
  status_role_assignments: { status_id: 'project_statuses' },
  user_permissions: { project_id: 'projects', user_id: 'users' },
  cell_action_permissions: { project_id: 'projects' },
  gro_cells: { project_id: 'projects', building_id: 'dict_buildings', floor_id: 'dict_floors', created_by: 'users' },
  gro_cell_files: { gro_cell_id: 'gro_cells', uploaded_by: 'users' },
  gro_cell_file_versions: { file_id: 'gro_cell_files', uploaded_by: 'users' },
  support_messages: { project_id: 'projects', sender_id: 'users' },
  support_message_files: { message_id: 'support_messages', uploaded_by: 'users' },
  support_blocked_users: { project_id: 'projects', user_id: 'users', blocked_by: 'users' },
  support_read_status: { project_id: 'projects', user_id: 'users' },
  push_subscriptions: { user_id: 'users' },
  notifications: { user_id: 'users' },
  dict_building_work_types: { building_id: 'dict_buildings', work_type_id: 'dict_work_types' },
  dict_work_stage_buildings: { work_stage_id: 'dict_work_stages', building_id: 'dict_buildings' },
  dict_work_stage_work_types: { work_stage_id: 'dict_work_stages', work_type_id: 'dict_work_types' },
  dict_work_type_constructions: { work_type_id: 'dict_work_types', construction_id: 'dict_constructions' },
  dict_work_type_floors: { work_type_id: 'dict_work_types', floor_id: 'dict_floors' },
  dict_work_type_overlays: { work_type_id: 'dict_work_types', overlay_id: 'dict_overlays' },
  dict_work_type_sets: { work_type_id: 'dict_work_types', set_id: 'dict_sets' },
  dict_overlay_buildings: { overlay_id: 'dict_overlays', building_id: 'dict_buildings' },
  dict_overlay_constructions: { overlay_id: 'dict_overlays', construction_id: 'dict_constructions' },
  dict_overlay_floors: { overlay_id: 'dict_overlays', floor_id: 'dict_floors' },
  dict_overlay_works: { overlay_id: 'dict_overlays', work_id: 'dict_works' },
  dict_building_floors: { building_id: 'dict_buildings', floor_id: 'dict_floors' },
  dict_building_work_type_floors: { building_id: 'dict_buildings', work_type_id: 'dict_work_types', floor_id: 'dict_floors' },
  dict_overlay_axis_grids: { overlay_id: 'dict_overlays', grid_id: 'dict_axis_grids' },
  dict_axis_grid_axes: { grid_id: 'dict_axis_grids' },
  overlay_axis_points: { overlay_grid_id: 'dict_overlay_axis_grids', axis_id: 'dict_axis_grid_axes', project_id: 'projects' },
  refresh_tokens: { user_id: 'users' },
};

/** Reverse FK: parent_table → { child_table: fk_column_on_child } */
const REVERSE_FK: Record<string, Record<string, string>> = {
  cells: {
    cell_files: 'cell_id', cell_comments: 'cell_id', cell_public_comments: 'cell_id',
    cell_signatures: 'cell_id', cell_shares: 'cell_id', cell_history: 'cell_id',
    cell_archives: 'cell_id', cell_overlay_masks: 'cell_id',
  },
  file_shares: {
    file_share_recipients: 'share_id', file_share_files: 'share_id',
    file_share_overlay_masks: 'share_id',
  },
  cell_comments: { cell_comment_files: 'comment_id' },
  gro_cells: { gro_cell_files: 'gro_cell_id' },
  gro_cell_files: { gro_cell_file_versions: 'file_id' },
  cell_files: { cell_file_versions: 'file_id' },
  project_statuses: { status_role_assignments: 'status_id' },
};

function findForwardFk(mainTable: string, targetTable: string): string | null {
  const fks = FK_MAP[mainTable];
  if (!fks) return null;
  for (const [col, tbl] of Object.entries(fks)) {
    if (tbl === targetTable) return col;
  }
  return null;
}

function findReverseFk(mainTable: string, childTable: string): string | null {
  return REVERSE_FK[mainTable]?.[childTable] || null;
}

export function resolveTableName(name: string): string {
  return name === 'profiles' ? 'users' : name;
}

// ============================================================================
// Allowed tables
// ============================================================================

const ALLOWED_TABLES = new Set([
  'users', 'projects', 'project_organizations', 'project_members',
  'project_statuses', 'status_role_assignments',
  'portal_role_permissions', 'user_permissions', 'cell_action_permissions',
  'cells', 'cell_files', 'cell_file_versions',
  'cell_comments', 'cell_comment_files', 'cell_public_comments',
  'cell_history', 'cell_shares', 'cell_signatures', 'cell_archives', 'cell_overlay_masks',
  'dict_buildings', 'dict_floors', 'dict_constructions', 'dict_work_types',
  'dict_work_stages', 'dict_sets', 'dict_overlays', 'dict_works',
  'dict_building_work_types', 'dict_work_stage_buildings', 'dict_work_stage_work_types',
  'dict_work_type_constructions', 'dict_work_type_floors', 'dict_work_type_overlays',
  'dict_work_type_sets', 'dict_overlay_buildings', 'dict_overlay_constructions',
  'dict_overlay_floors', 'dict_overlay_works', 'dict_building_floors',
  'dict_building_work_type_floors',
  'dict_axis_grids', 'dict_axis_grid_axes', 'dict_overlay_axis_grids', 'overlay_axis_points',
  'gro_cells', 'gro_cell_files', 'gro_cell_file_versions',
  'support_messages', 'support_message_files', 'support_blocked_users', 'support_read_status',
  'file_shares', 'file_share_recipients', 'file_share_files', 'file_share_overlay_masks',
  'push_subscriptions', 'notifications', 'refresh_tokens',
  'companies', 'company_members', 'project_companies', 'subscriptions',
  'company_tpl_buildings', 'company_tpl_floors', 'company_tpl_constructions',
  'company_tpl_work_types', 'company_tpl_work_stages', 'company_tpl_sets',
  'company_tpl_organizations',
]);

export function isAllowedTable(table: string): boolean {
  return ALLOWED_TABLES.has(table);
}

// ============================================================================
// Tokenizer — splits on comma respecting nested parentheses
// ============================================================================

function tokenize(s: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) {
      tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

// ============================================================================
// SELECT parser
// ============================================================================

interface JoinSpec {
  alias: string;       // alias or table name
  table: string;       // resolved table name
  fkColumn: string;    // FK column on parent (or '' for reverse)
  isReverse: boolean;  // true = child→parent (json_agg), false = parent→child (row_to_json)
  isInner: boolean;    // !inner modifier
  columns: string[];   // columns to select (may include nested join specs as raw strings)
}

function parseSelectString(selectStr: string, mainTable: string): { columns: string[]; joins: JoinSpec[] } {
  const columns: string[] = [];
  const joins: JoinSpec[] = [];

  if (!selectStr || selectStr.trim() === '*') {
    return { columns: ['*'], joins: [] };
  }

  const tokens = tokenize(selectStr);

  for (const token of tokens) {
    // Match Supabase select syntax:
    //   table(cols)                    → table join
    //   alias:table!fk(cols)           → aliased join via FK
    //   table!inner(cols)              → inner join
    // Note: "profiles:user_id" is NOT alias:table — it's a shorthand
    // Supabase format: alias:table!fk_column(cols) where alias≠fk
    // But old DocStroy code uses: profiles!created_by(cols) — table!fk
    // And: creator:profiles!created_by(cols) — alias:table!fk
    const m = token.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\((.+)\)$/s);
    if (m) {
      let [, alias, rawTable, modifier, innerContent] = m;

      // Handle ambiguous format: "profiles:user_id(cols)"
      // Could be alias:table or table:fk — detect by checking if rawTable is a real table
      if (alias && !isAllowedTable(resolveTableName(rawTable)) && isAllowedTable(resolveTableName(alias))) {
        // "profiles:user_id" → table=profiles, fk=user_id (not alias=profiles, table=user_id)
        modifier = rawTable;  // user_id becomes the FK
        rawTable = alias;     // profiles becomes the table
        alias = '';           // no alias
      }

      const table = resolveTableName(rawTable);
      const isInner = modifier === 'inner';
      const explicitFk = (!isInner && modifier) ? modifier : '';
      const joinAlias = alias || rawTable;

      // Extract only simple columns (strip nested joins)
      const innerTokens = tokenize(innerContent);
      const simpleCols: string[] = [];
      for (const it of innerTokens) {
        if (it.includes('(')) {
          // Nested join — skip for now (too complex for SQL subquery)
          continue;
        }
        simpleCols.push(it.trim());
      }

      // Determine FK and direction
      let fkColumn = explicitFk;
      let isReverse = false;

      if (fkColumn) {
        // Explicit FK given (e.g. profiles!user_id or profiles!created_by)
        // This is always a forward FK: mainTable.fkColumn → joinedTable.id
        isReverse = false;
      } else {
        // Auto-detect: try forward FK first, then reverse
        const fwd = findForwardFk(mainTable, table);
        if (fwd) {
          fkColumn = fwd;
          isReverse = false;
        } else {
          const rev = findReverseFk(mainTable, table);
          if (rev) {
            fkColumn = rev;
            isReverse = true;
          }
        }
      }

      joins.push({
        alias: joinAlias,
        table,
        fkColumn,
        isReverse,
        isInner,
        columns: simpleCols.length > 0 ? simpleCols : ['*'],
      });
    } else {
      columns.push(token.trim());
    }
  }

  if (columns.length === 0 && joins.length > 0) {
    columns.push('*');
  }

  return { columns, joins };
}

// ============================================================================
// SQL Builder
// ============================================================================

export interface BuiltQuery {
  text: string;
  values: unknown[];
}

export function buildSelectSQL(table: string, req: Request): BuiltQuery {
  const q = req.query as Record<string, string>;
  const values: unknown[] = [];
  let paramIdx = 1;

  // --- Parse select ---
  const selectStr = (q.select || '*').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const { columns, joins } = parseSelectString(selectStr, table);

  // --- Build SELECT columns ---
  const selectParts: string[] = [];
  const isCountOnly = q.head === 'true';

  if (isCountOnly) {
    selectParts.push('COUNT(*)::int AS count');
  } else {
    // Main table columns
    if (columns.includes('*')) {
      selectParts.push(`t.*`);
    } else {
      for (const col of columns) {
        selectParts.push(`t."${col}"`);
      }
    }

    // Join subqueries
    for (const join of joins) {
      if (join.isReverse) {
        // Reverse FK: child table → aggregate as JSON array
        const cols = join.columns.includes('*') ? '*'
          : join.columns.map(c => `"${c}"`).join(', ');

        if (join.columns.length === 1 && join.columns[0] === 'count') {
          selectParts.push(
            `(SELECT COUNT(*)::int FROM "${join.table}" WHERE "${join.table}"."${join.fkColumn}" = t."id") AS "${join.alias}"`
          );
        } else {
          selectParts.push(
            `COALESCE((SELECT json_agg(sub) FROM (SELECT ${cols} FROM "${join.table}" WHERE "${join.table}"."${join.fkColumn}" = t."id") sub), '[]'::json) AS "${join.alias}"`
          );
        }
      } else {
        // Forward FK: parent → single row as JSON object
        const fk = join.fkColumn || `${join.table}_id`;
        const cols = join.columns.includes('*') ? '*'
          : join.columns.map(c => `"${c}"`).join(', ');

        selectParts.push(
          `(SELECT row_to_json(sub) FROM (SELECT ${cols} FROM "${join.table}" WHERE "id" = t."${fk}" LIMIT 1) sub) AS "${join.alias}"`
        );
      }
    }
  }

  // --- Collect dot-notation filters for joined tables ---
  // e.g. cells.cell_type=eq.registry → joinFilters["cells"] = [{ col: "cell_type", op: "eq", val: "registry" }]
  const joinFilters: Record<string, { col: string; rawValue: string }[]> = {};
  for (const [key, rawValue] of Object.entries(q)) {
    if (!key.includes('.')) continue;
    const [joinAlias, col] = key.split('.', 2);
    if (!joinFilters[joinAlias]) joinFilters[joinAlias] = [];
    joinFilters[joinAlias].push({ col, rawValue: rawValue as string });
  }

  // --- Rebuild JOIN subqueries with filters & inner support ---
  // Re-generate selectParts for joins that have filters or isInner
  if (!isCountOnly) {
    // Re-scan joins to add WHERE clauses into subqueries
    for (let i = 0; i < joins.length; i++) {
      const join = joins[i];
      const filters = joinFilters[join.alias] || [];
      if (filters.length === 0 && !join.isInner) continue;

      const cols = join.columns.includes('*') ? '*'
        : join.columns.map(c => `"${c}"`).join(', ');

      // Build extra WHERE conditions for the subquery
      const extraWhere: string[] = [];
      for (const f of filters) {
        const dotIdx = f.rawValue.indexOf('.');
        if (dotIdx === -1) {
          extraWhere.push(`"${f.col}" = $${paramIdx}`);
          values.push(f.rawValue);
          paramIdx++;
        } else {
          const op = f.rawValue.substring(0, dotIdx);
          const val = f.rawValue.substring(dotIdx + 1);
          if (op === 'eq') {
            extraWhere.push(`"${f.col}" = $${paramIdx}`);
            values.push(val);
            paramIdx++;
          } else if (op === 'neq') {
            extraWhere.push(`"${f.col}" != $${paramIdx}`);
            values.push(val);
            paramIdx++;
          } else if (op === 'is') {
            extraWhere.push(`"${f.col}" IS ${val === 'null' ? 'NULL' : 'NOT NULL'}`);
          }
        }
      }
      const extraWhereSQL = extraWhere.length > 0 ? ` AND ${extraWhere.join(' AND ')}` : '';

      // Find and replace the select part for this join
      const aliasQuoted = `"${join.alias}"`;
      const partIdx = selectParts.findIndex(p => p.endsWith(`AS ${aliasQuoted}`));
      if (partIdx === -1) continue;

      if (join.isReverse) {
        const fkRef = `"${join.table}"."${join.fkColumn}"`;
        selectParts[partIdx] =
          `COALESCE((SELECT json_agg(sub) FROM (SELECT ${cols} FROM "${join.table}" WHERE ${fkRef} = t."id"${extraWhereSQL}) sub), '[]'::json) AS ${aliasQuoted}`;
      } else {
        const fk = join.fkColumn || `${join.table}_id`;
        selectParts[partIdx] =
          `(SELECT row_to_json(sub) FROM (SELECT ${cols} FROM "${join.table}" WHERE "id" = t."${fk}"${extraWhereSQL} LIMIT 1) sub) AS ${aliasQuoted}`;
      }

      // For !inner joins — add WHERE EXISTS to filter out main rows without match
      if (join.isInner) {
        const fk = join.isReverse ? join.fkColumn : (join.fkColumn || `${join.table}_id`);
        const existsCond = join.isReverse
          ? `SELECT 1 FROM "${join.table}" WHERE "${join.table}"."${fk}" = t."id"${extraWhereSQL}`
          : `SELECT 1 FROM "${join.table}" WHERE "id" = t."${fk}"${extraWhereSQL}`;
        // Store for later (we'll add to whereParts)
        if (!joinFilters['__inner_exists__']) joinFilters['__inner_exists__'] = [];
        joinFilters['__inner_exists__'].push({ col: existsCond, rawValue: '__exists__' });
      }
    }
  }

  // --- Build SQL ---
  let sql = `SELECT ${selectParts.join(', ')} FROM "${table}" t`;

  // --- WHERE ---
  const whereParts: string[] = [];
  const skipParams = new Set(['select', 'order', 'limit', 'offset', 'count', 'head', '_table', 'or']);

  // Add !inner EXISTS conditions
  const innerExists = joinFilters['__inner_exists__'] || [];
  for (const ie of innerExists) {
    whereParts.push(`EXISTS (${ie.col})`);
  }

  for (const [key, rawValue] of Object.entries(q)) {
    if (skipParams.has(key)) continue;

    // Skip dot-notation filters on joined tables (handled above)
    if (key.includes('.')) continue;

    const value = rawValue as string;
    const dotIdx = value.indexOf('.');
    if (dotIdx === -1) {
      // No operator — treat as eq
      whereParts.push(`t."${key}" = $${paramIdx}`);
      values.push(value);
      paramIdx++;
      continue;
    }

    let op = value.substring(0, dotIdx);
    let val: unknown = value.substring(dotIdx + 1);

    // Handle not.op
    let negate = false;
    if (op === 'not') {
      negate = true;
      const rest = val as string;
      const nd = rest.indexOf('.');
      if (nd !== -1) {
        op = rest.substring(0, nd);
        val = rest.substring(nd + 1);
      }
    }

    const col = `t."${key}"`;

    switch (op) {
      case 'eq':
        whereParts.push(`${col} ${negate ? '!=' : '='} $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'neq':
        whereParts.push(`${col} != $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'gt':
        whereParts.push(`${col} > $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'gte':
        whereParts.push(`${col} >= $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'lt':
        whereParts.push(`${col} < $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'lte':
        whereParts.push(`${col} <= $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'like':
        whereParts.push(`${col} LIKE $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'ilike':
        whereParts.push(`${col} ILIKE $${paramIdx}`);
        values.push(val); paramIdx++;
        break;
      case 'is':
        if (val === 'null') whereParts.push(`${col} IS ${negate ? 'NOT ' : ''}NULL`);
        else if (val === 'true') whereParts.push(`${col} IS ${negate ? 'NOT ' : ''}TRUE`);
        else if (val === 'false') whereParts.push(`${col} IS ${negate ? 'NOT ' : ''}FALSE`);
        break;
      case 'in': {
        const inStr = (val as string).replace(/^\(/, '').replace(/\)$/, '');
        const arr = inStr.split(',').map(v => v.trim());
        const phs = arr.map(() => `$${paramIdx++}`);
        whereParts.push(`${col} ${negate ? 'NOT ' : ''}IN (${phs.join(', ')})`);
        values.push(...arr);
        break;
      }
      case 'cs':
        whereParts.push(`${col} @> $${paramIdx}::jsonb`);
        values.push(typeof val === 'string' ? val : JSON.stringify(val));
        paramIdx++;
        break;
      default:
        // Unknown op — skip
        break;
    }
  }

  // OR filter
  if (q.or) {
    const orParsed = parseOrFilter(q.or, values, paramIdx);
    if (orParsed.clause) {
      whereParts.push(orParsed.clause);
      paramIdx = orParsed.nextIdx;
    }
  }

  if (whereParts.length > 0) {
    sql += ` WHERE ${whereParts.join(' AND ')}`;
  }

  // --- ORDER ---
  if (!isCountOnly && q.order) {
    const orders = q.order.split(',').map(part => {
      const [col, dir] = part.trim().split('.');
      return `t."${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    });
    sql += ` ORDER BY ${orders.join(', ')}`;
  }

  // --- LIMIT / OFFSET ---
  if (!isCountOnly) {
    if (q.limit) {
      sql += ` LIMIT $${paramIdx}`;
      values.push(parseInt(q.limit, 10));
      paramIdx++;
    }
    if (q.offset && parseInt(q.offset, 10) > 0) {
      sql += ` OFFSET $${paramIdx}`;
      values.push(parseInt(q.offset, 10));
      paramIdx++;
    }
  }

  return { text: sql, values };
}

// ============================================================================
// OR filter parser
// ============================================================================

function parseOrFilter(orStr: string, values: unknown[], startIdx: number): { clause: string | null; nextIdx: number } {
  const inner = orStr.replace(/^\(/, '').replace(/\)$/, '');
  const parts = inner.split(',');
  const orParts: string[] = [];
  let idx = startIdx;

  for (const part of parts) {
    const trimmed = part.trim();
    const firstDot = trimmed.indexOf('.');
    if (firstDot === -1) continue;
    const col = trimmed.substring(0, firstDot);
    const rest = trimmed.substring(firstDot + 1);
    const secondDot = rest.indexOf('.');
    if (secondDot === -1) continue;
    const op = rest.substring(0, secondDot);
    const val = rest.substring(secondDot + 1);

    switch (op) {
      case 'eq':
        orParts.push(`t."${col}" = $${idx}`);
        values.push(val); idx++;
        break;
      case 'neq':
        orParts.push(`t."${col}" != $${idx}`);
        values.push(val); idx++;
        break;
      case 'is':
        if (val === 'null') orParts.push(`t."${col}" IS NULL`);
        else if (val === 'true') orParts.push(`t."${col}" IS TRUE`);
        break;
      default:
        orParts.push(`t."${col}" = $${idx}`);
        values.push(val); idx++;
    }
  }

  if (orParts.length === 0) return { clause: null, nextIdx: idx };
  return { clause: `(${orParts.join(' OR ')})`, nextIdx: idx };
}

// ============================================================================
// Project access helpers
// ============================================================================

const DIRECT_PROJECT_TABLES = new Set([
  'cells', 'project_statuses', 'user_permissions', 'cell_action_permissions',
  'dict_buildings', 'dict_floors', 'dict_constructions', 'dict_work_types',
  'dict_work_stages', 'dict_sets', 'dict_overlays', 'dict_works',
  'dict_axis_grids', 'overlay_axis_points',
  'gro_cells', 'support_messages', 'support_blocked_users', 'support_read_status',
  'file_shares', 'project_members', 'project_organizations',
]);

export function requiresProjectAccess(table: string): boolean {
  return DIRECT_PROJECT_TABLES.has(table);
}

export function getProjectIdFromQuery(q: Record<string, string>): string | null {
  const val = q.project_id;
  if (!val) return null;
  // Parse "eq.UUID" format
  if (val.startsWith('eq.')) return val.substring(3);
  return val;
}
