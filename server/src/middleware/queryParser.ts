/**
 * queryParser.ts — парсер PostgREST-совместимых query-параметров.
 * Фронтенд-адаптер supabase.ts отправляет фильтры в формате:
 *   ?column=op.value  (eq, neq, gt, gte, lt, lte, like, ilike, is, in, cs, not.eq)
 *   ?select=col1,col2,dict_buildings(name),creator:users!created_by(last_name,first_name)
 *   ?order=created_at.desc,name.asc
 *   ?limit=100&offset=0
 */

import { Request } from 'express';

// ============================================================================
// Types
// ============================================================================

interface ParsedFilter {
  column: string;
  op: string;
  value: unknown;
  paramIndex: number;
}

interface ParsedJoin {
  alias: string;
  table: string;
  fkColumn: string;  // FK on main table pointing to joined table
  columns: string[];
  isInner: boolean;
}

interface ParsedOrder {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface ParsedQuery {
  selectColumns: string[];     // columns from main table
  joins: ParsedJoin[];
  filters: ParsedFilter[];
  orFilter: string | null;
  orders: ParsedOrder[];
  limit: number | null;
  offset: number | null;
  countOnly: boolean;          // head=true mode
  countOption: string | null;  // "exact" etc.
}

// ============================================================================
// Table metadata: FK relationships for JOIN resolution
// ============================================================================

/** Map: table_name → { fk_column_on_parent → referenced_table } */
const FK_MAP: Record<string, Record<string, string>> = {
  cells: {
    building_id: 'dict_buildings',
    floor_id: 'dict_floors',
    work_type_id: 'dict_work_types',
    construction_id: 'dict_constructions',
    set_id: 'dict_sets',
    work_id: 'dict_works',
    work_stage_id: 'dict_work_stages',
    project_id: 'projects',
    created_by: 'users',
    assigned_to: 'users',
    assigned_by: 'users',
    original_sender_id: 'users',
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

/** Reverse lookup: given a target table, find FK columns that reference it */
function findFkColumn(mainTable: string, targetTable: string): string | null {
  const fks = FK_MAP[mainTable];
  if (!fks) return null;
  for (const [col, tbl] of Object.entries(fks)) {
    if (tbl === targetTable) return col;
  }
  return null;
}

/** Tables that have a reverse FK (child → parent via cell_id etc.) */
const REVERSE_FK: Record<string, Record<string, string>> = {
  cells: {
    cell_files: 'cell_id',
    cell_comments: 'cell_id',
    cell_public_comments: 'cell_id',
    cell_signatures: 'cell_id',
    cell_shares: 'cell_id',
    cell_history: 'cell_id',
    cell_archives: 'cell_id',
    cell_overlay_masks: 'cell_id',
  },
  file_shares: {
    file_share_recipients: 'share_id',
    file_share_files: 'share_id',
    file_share_overlay_masks: 'share_id',
  },
};

// ============================================================================
// Allowed tables (whitelist)
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
]);

export function isAllowedTable(table: string): boolean {
  return ALLOWED_TABLES.has(table);
}

// Table aliases (frontend uses old names)
export function resolveTableName(name: string): string {
  if (name === 'profiles') return 'users';
  return name;
}

// ============================================================================
// Select parser
// ============================================================================

/**
 * Parse Supabase-style select string:
 *   "*" → all columns
 *   "id, name, dict_buildings(name)" → columns + JOINs
 *   "creator:profiles!created_by(last_name, first_name)" → aliased JOIN via FK
 *   "cells!inner(name, status)" → INNER JOIN (reverse FK)
 */
function parseSelect(selectStr: string, mainTable: string): { columns: string[]; joins: ParsedJoin[] } {
  const columns: string[] = [];
  const joins: ParsedJoin[] = [];

  if (!selectStr || selectStr === '*') {
    columns.push('*');
    return { columns, joins };
  }

  // Tokenize respecting parentheses
  const tokens = tokenizeSelect(selectStr);

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    // Match: alias:table!fk_column(columns) or table!inner(columns) or table(columns)
    const joinMatch = trimmed.match(
      /^(?:(\w+):)?(\w+)(?:!(\w+))?\(([^)]*)\)$/
    );

    if (joinMatch) {
      const [, alias, rawTable, modifier, innerCols] = joinMatch;
      const table = resolveTableName(rawTable);
      const isInner = modifier === 'inner';
      const fkColumn = (!isInner && modifier) ? modifier : '';
      const joinAlias = alias || rawTable;
      const cols = innerCols.split(',').map((c) => c.trim()).filter(Boolean);

      // Determine FK column
      let resolvedFk = fkColumn;
      if (!resolvedFk) {
        // Try forward FK: main_table.X_id → joined_table
        const fwd = findFkColumn(mainTable, table);
        if (fwd) {
          resolvedFk = fwd;
        } else {
          // Try reverse FK: joined_table.main_table_id → main_table
          const revMap = REVERSE_FK[mainTable];
          if (revMap && revMap[table]) {
            resolvedFk = `__reverse__:${revMap[table]}`;
          }
        }
      }

      joins.push({
        alias: joinAlias,
        table,
        fkColumn: resolvedFk,
        columns: cols.length > 0 ? cols : ['*'],
        isInner,
      });
    } else {
      // Regular column
      columns.push(trimmed);
    }
  }

  if (columns.length === 0 && joins.length > 0) {
    columns.push('*');
  }

  return { columns, joins };
}

/** Tokenize select string, respecting parentheses */
function tokenizeSelect(s: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of s) {
    if (ch === '(' ) { depth++; current += ch; }
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
// Filter parser
// ============================================================================

const SKIP_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'count', 'head', '_table', 'or']);

function parseFilters(query: Record<string, string>): { filters: ParsedFilter[]; orFilter: string | null } {
  const filters: ParsedFilter[] = [];
  let paramIdx = 1;
  let orFilter: string | null = null;

  for (const [key, rawValue] of Object.entries(query)) {
    if (SKIP_PARAMS.has(key)) continue;

    if (key === 'or') {
      orFilter = rawValue;
      continue;
    }

    const value = rawValue as string;

    // Parse operator.value format
    const dotIdx = value.indexOf('.');
    if (dotIdx === -1) {
      // No operator — treat as eq
      filters.push({ column: key, op: 'eq', value, paramIndex: paramIdx++ });
      continue;
    }

    let op = value.substring(0, dotIdx);
    let val: unknown = value.substring(dotIdx + 1);

    // Handle "not.op" prefix
    let negate = false;
    if (op === 'not') {
      negate = true;
      const rest = val as string;
      const nextDot = rest.indexOf('.');
      if (nextDot !== -1) {
        op = rest.substring(0, nextDot);
        val = rest.substring(nextDot + 1);
      }
    }

    // Parse specific operators
    switch (op) {
      case 'eq':
      case 'neq':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'like':
      case 'ilike':
        filters.push({ column: key, op: negate ? `not_${op}` : op, value: val, paramIndex: paramIdx++ });
        break;
      case 'is':
        filters.push({ column: key, op: negate ? 'is_not' : 'is', value: val === 'null' ? null : val, paramIndex: paramIdx++ });
        break;
      case 'in':
        // in.(val1,val2,val3)
        const inStr = (val as string).replace(/^\(/, '').replace(/\)$/, '');
        const inValues = inStr.split(',').map((v) => v.trim());
        filters.push({ column: key, op: negate ? 'not_in' : 'in', value: inValues, paramIndex: paramIdx++ });
        break;
      case 'cs':
        filters.push({ column: key, op: 'contains', value: val, paramIndex: paramIdx++ });
        break;
      default:
        // Unknown op, treat as eq
        filters.push({ column: key, op: 'eq', value: rawValue, paramIndex: paramIdx++ });
    }
  }

  return { filters, orFilter };
}

// ============================================================================
// Order parser
// ============================================================================

function parseOrder(orderStr: string | undefined): ParsedOrder[] {
  if (!orderStr) return [];
  return orderStr.split(',').map((part) => {
    const [column, dir] = part.trim().split('.');
    return { column, direction: dir === 'desc' ? 'DESC' as const : 'ASC' as const };
  });
}

// ============================================================================
// Main parser
// ============================================================================

export function parseQuery(req: Request, mainTable: string): ParsedQuery {
  const q = req.query as Record<string, string>;

  const selectStr = q.select || '*';
  const { columns, joins } = parseSelect(selectStr, mainTable);
  const { filters, orFilter } = parseFilters(q);
  const orders = parseOrder(q.order);
  const limit = q.limit ? parseInt(q.limit, 10) : null;
  const offset = q.offset ? parseInt(q.offset, 10) : null;
  const countOnly = q.head === 'true';
  const countOption = q.count || null;

  return { selectColumns: columns, joins, filters, orFilter, orders, limit, offset, countOnly, countOption };
}

// ============================================================================
// SQL Builder
// ============================================================================

export interface BuiltQuery {
  text: string;
  values: unknown[];
  countText?: string; // Optional count query
}

export function buildSelectSQL(table: string, parsed: ParsedQuery): BuiltQuery {
  const values: unknown[] = [];
  let paramIdx = 1;

  // --- SELECT columns ---
  const selectParts: string[] = [];

  if (parsed.countOnly) {
    selectParts.push('COUNT(*)::int AS count');
  } else {
    // Main table columns
    if (parsed.selectColumns.includes('*')) {
      selectParts.push(`"${table}".*`);
    } else {
      for (const col of parsed.selectColumns) {
        selectParts.push(`"${table}"."${col}"`);
      }
    }

    // Join columns as JSON aggregates or row sub-selects
    for (const join of parsed.joins) {
      const isReverse = join.fkColumn.startsWith('__reverse__:');

      if (isReverse) {
        // Reverse FK → aggregate as JSON array via lateral subquery
        const revFk = join.fkColumn.replace('__reverse__:', '');
        const subCols = join.columns.includes('*')
          ? `"${join.table}".*`
          : join.columns.map((c) => `"${join.table}"."${c}"`).join(', ');

        // Use count check — Supabase returns [{count: N}] for (count) selects
        if (join.columns.length === 1 && join.columns[0] === 'count') {
          selectParts.push(
            `(SELECT COUNT(*)::int FROM "${join.table}" WHERE "${join.table}"."${revFk}" = "${table}"."id") AS "${join.alias}_count"`
          );
        } else {
          selectParts.push(
            `COALESCE((SELECT json_agg(sub) FROM (SELECT ${subCols} FROM "${join.table}" WHERE "${join.table}"."${revFk}" = "${table}"."id") sub), '[]'::json) AS "${join.alias}"`
          );
        }
      } else {
        // Forward FK → single row, select as JSON object
        const fk = join.fkColumn || findFkColumn(table, join.table) || `${join.table}_id`;
        const joinCols = join.columns.includes('*')
          ? `"${join.alias}".*`
          : join.columns.map((c) => `"${join.alias}"."${c}"`).join(', ');

        selectParts.push(
          `(SELECT row_to_json(sub) FROM (SELECT ${joinCols} FROM "${join.table}" AS "${join.alias}_sub" WHERE "${join.alias}_sub"."id" = "${table}"."${fk}" LIMIT 1) sub) AS "${join.alias}"`
        );
      }
    }
  }

  // --- FROM ---
  let sql = `SELECT ${selectParts.join(', ')} FROM "${table}"`;

  // --- WHERE ---
  const whereParts: string[] = [];

  for (const f of parsed.filters) {
    // Handle filters on joined tables (e.g., cells.project_id from inner join context)
    const colRef = `"${table}"."${f.column}"`;

    switch (f.op) {
      case 'eq':
        whereParts.push(`${colRef} = $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'neq':
      case 'not_eq':
        whereParts.push(`${colRef} != $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'gt':
        whereParts.push(`${colRef} > $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'gte':
        whereParts.push(`${colRef} >= $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'lt':
        whereParts.push(`${colRef} < $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'lte':
        whereParts.push(`${colRef} <= $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'like':
        whereParts.push(`${colRef} LIKE $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'ilike':
        whereParts.push(`${colRef} ILIKE $${paramIdx}`);
        values.push(f.value);
        paramIdx++;
        break;
      case 'is':
        if (f.value === null || f.value === 'null') {
          whereParts.push(`${colRef} IS NULL`);
        } else if (f.value === 'true') {
          whereParts.push(`${colRef} IS TRUE`);
        } else if (f.value === 'false') {
          whereParts.push(`${colRef} IS FALSE`);
        }
        break;
      case 'is_not':
        if (f.value === null || f.value === 'null') {
          whereParts.push(`${colRef} IS NOT NULL`);
        }
        break;
      case 'in':
      case 'not_in': {
        const arr = f.value as string[];
        const placeholders = arr.map(() => `$${paramIdx++}`);
        const inClause = `${colRef} ${f.op === 'not_in' ? 'NOT ' : ''}IN (${placeholders.join(', ')})`;
        whereParts.push(inClause);
        values.push(...arr);
        break;
      }
      case 'contains':
        whereParts.push(`${colRef} @> $${paramIdx}::jsonb`);
        values.push(typeof f.value === 'string' ? f.value : JSON.stringify(f.value));
        paramIdx++;
        break;
    }
  }

  // OR filter (PostgREST format: (col.op.val,col.op.val))
  if (parsed.orFilter) {
    const orParsed = parseOrFilter(parsed.orFilter, table, values, paramIdx);
    if (orParsed.clause) {
      whereParts.push(orParsed.clause);
      paramIdx = orParsed.nextParamIdx;
    }
  }

  if (whereParts.length > 0) {
    sql += ` WHERE ${whereParts.join(' AND ')}`;
  }

  // --- ORDER ---
  if (!parsed.countOnly && parsed.orders.length > 0) {
    const orderClauses = parsed.orders.map((o) => `"${table}"."${o.column}" ${o.direction}`);
    sql += ` ORDER BY ${orderClauses.join(', ')}`;
  }

  // --- LIMIT / OFFSET ---
  if (!parsed.countOnly) {
    if (parsed.limit !== null) {
      sql += ` LIMIT $${paramIdx}`;
      values.push(parsed.limit);
      paramIdx++;
    }
    if (parsed.offset !== null && parsed.offset > 0) {
      sql += ` OFFSET $${paramIdx}`;
      values.push(parsed.offset);
      paramIdx++;
    }
  }

  return { text: sql, values };
}

// ============================================================================
// OR filter parser
// ============================================================================

function parseOrFilter(
  orStr: string,
  table: string,
  values: unknown[],
  startIdx: number,
): { clause: string | null; nextParamIdx: number } {
  // Format: (col1.op.val,col2.op.val)
  const inner = orStr.replace(/^\(/, '').replace(/\)$/, '');
  const parts = inner.split(',');
  const orParts: string[] = [];
  let idx = startIdx;

  for (const part of parts) {
    const trimmed = part.trim();
    // col.op.val
    const firstDot = trimmed.indexOf('.');
    if (firstDot === -1) continue;

    const col = trimmed.substring(0, firstDot);
    const rest = trimmed.substring(firstDot + 1);
    const secondDot = rest.indexOf('.');
    if (secondDot === -1) continue;

    const op = rest.substring(0, secondDot);
    const val = rest.substring(secondDot + 1);

    const colRef = `"${table}"."${col}"`;

    switch (op) {
      case 'eq':
        orParts.push(`${colRef} = $${idx}`);
        values.push(val);
        idx++;
        break;
      case 'neq':
        orParts.push(`${colRef} != $${idx}`);
        values.push(val);
        idx++;
        break;
      case 'is':
        if (val === 'null') orParts.push(`${colRef} IS NULL`);
        else if (val === 'true') orParts.push(`${colRef} IS TRUE`);
        break;
      default:
        orParts.push(`${colRef} ${op === 'gt' ? '>' : op === 'lt' ? '<' : '='} $${idx}`);
        values.push(val);
        idx++;
    }
  }

  if (orParts.length === 0) return { clause: null, nextParamIdx: idx };
  return { clause: `(${orParts.join(' OR ')})`, nextParamIdx: idx };
}

// ============================================================================
// Tables that require project access check
// ============================================================================

const PROJECT_TABLES = new Set([
  'cells', 'cell_files', 'cell_file_versions', 'cell_comments', 'cell_comment_files',
  'cell_public_comments', 'cell_history', 'cell_shares', 'cell_signatures',
  'cell_archives', 'cell_overlay_masks',
  'project_statuses', 'status_role_assignments',
  'user_permissions', 'cell_action_permissions',
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
]);

export function requiresProjectAccess(table: string): boolean {
  return PROJECT_TABLES.has(table);
}

/** Get the project_id column name for a table (direct or via parent) */
export function getProjectIdColumn(table: string): string | null {
  // Tables with direct project_id
  const directProjectTables = new Set([
    'cells', 'project_statuses', 'user_permissions', 'cell_action_permissions',
    'dict_buildings', 'dict_floors', 'dict_constructions', 'dict_work_types',
    'dict_work_stages', 'dict_sets', 'dict_overlays', 'dict_works',
    'dict_axis_grids', 'overlay_axis_points',
    'gro_cells', 'support_messages', 'support_blocked_users', 'support_read_status',
    'file_shares', 'project_members',
  ]);

  if (directProjectTables.has(table)) return 'project_id';
  return null; // Sub-tables don't have direct project_id
}
