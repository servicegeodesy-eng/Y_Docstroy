// ============================================================================
// Supabase Compatibility Adapter
// Drop-in замена @supabase/supabase-js — минимизирует изменения в 85+ файлах
// ============================================================================

import { api, auth, storage } from './api';
import type { User } from './api';

// Re-export types
export type { User, Session } from './api';

// ============================================================================
// QueryBuilder — цепочечный API, совместимый с supabase.from(table)
// ============================================================================

interface Filter {
  column: string;
  op: string;
  value: unknown;
}

interface OrderClause {
  column: string;
  ascending: boolean;
}

interface QueryResult<T> {
  data: T | null;
  error: string | null;
  count?: number | null;
  status?: number;
}

class QueryBuilder<T = unknown> implements PromiseLike<QueryResult<T>> {
  private table: string;
  private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private selectColumns: string = '*';
  private filters: Filter[] = [];
  private orFilters: string[] = [];
  private orders: OrderClause[] = [];
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private bodyData: unknown = null;
  private countOption: string | null = null;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  // ---- Query methods (return this for chaining) ----

  select(columns: string = '*', options?: { count?: string; head?: boolean }): this {
    this.method = 'GET';
    this.selectColumns = columns;
    if (options?.count) this.countOption = options.count;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(data: unknown): this {
    this.method = 'POST';
    this.bodyData = data;
    return this;
  }

  update(data: unknown): this {
    this.method = 'PATCH';
    this.bodyData = data;
    return this;
  }

  upsert(data: unknown): this {
    this.method = 'POST';
    this.bodyData = { _upsert: true, ...(typeof data === 'object' && data !== null ? data : { data }) };
    return this;
  }

  delete(): this {
    this.method = 'DELETE';
    return this;
  }

  // ---- Filter methods ----

  eq(column: string, value: unknown): this {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters.push({ column, op: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column, op: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push({ column, op: 'is', value });
    return this;
  }

  contains(column: string, value: unknown): this {
    this.filters.push({ column, op: 'contains', value });
    return this;
  }

  or(conditions: string): this {
    this.orFilters.push(conditions);
    return this;
  }

  not(column: string, op: string, value: unknown): this {
    this.filters.push({ column, op: `not.${op}`, value });
    return this;
  }

  // ---- Ordering, pagination ----

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  // ---- Result modifiers ----

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    return this;
  }

  // ---- Thenable execution ----

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<T>> {
    const params = this.buildParams();

    switch (this.method) {
      case 'GET':
        return this.executeGet(params);
      case 'POST':
        return this.executePost(params);
      case 'PATCH':
        return this.executePatch(params);
      case 'DELETE':
        return this.executeDelete(params);
      default:
        return { data: null, error: 'Unknown method' };
    }
  }

  private buildParams(): Record<string, string> {
    const params: Record<string, string> = {};

    if (this.selectColumns !== '*') {
      params['select'] = this.selectColumns;
    }

    // Encode filters
    for (const f of this.filters) {
      if (f.op === 'in') {
        params[`${f.column}`] = `in.(${(f.value as unknown[]).join(',')})`;
      } else if (f.op === 'is') {
        params[`${f.column}`] = `is.${f.value}`;
      } else if (f.op === 'contains') {
        params[`${f.column}`] = `cs.${JSON.stringify(f.value)}`;
      } else {
        params[`${f.column}`] = `${f.op}.${f.value}`;
      }
    }

    if (this.orFilters.length > 0) {
      params['or'] = `(${this.orFilters.join(',')})`;
    }

    if (this.orders.length > 0) {
      params['order'] = this.orders
        .map((o) => `${o.column}.${o.ascending ? 'asc' : 'desc'}`)
        .join(',');
    }

    if (this.limitCount !== null) {
      params['limit'] = String(this.limitCount);
    }

    if (this.rangeFrom !== null && this.rangeTo !== null) {
      params['offset'] = String(this.rangeFrom);
      params['limit'] = String(this.rangeTo - this.rangeFrom + 1);
    }

    if (this.countOption) {
      params['count'] = this.countOption;
    }

    if (this.headOnly) {
      params['head'] = 'true';
    }

    return params;
  }

  private getIdFilter(): string | null {
    const idFilter = this.filters.find((f) => f.column === 'id' && f.op === 'eq');
    return idFilter ? String(idFilter.value) : null;
  }

  private getPath(): string {
    // Все запросы через generic CRUD роут — он парсит фильтры и строит SQL
    const table = this.table === 'profiles' ? 'users' : this.table;
    return `/api/query/${table}`;
  }

  private async executeGet(params: Record<string, string>): Promise<QueryResult<T>> {
    const path = this.getPath();

    const result = await api.get<T>(path, params);

    if (result.error) {
      return { data: null, error: result.error, status: result.status };
    }

    let data = result.data;

    if ((this.isSingle || this.isMaybeSingle) && Array.isArray(data)) {
      if (data.length === 0) {
        if (this.isSingle) {
          return { data: null, error: 'Row not found' };
        }
        return { data: null, error: null };
      }
      data = data[0] as T;
    }

    return { data, error: null, count: Array.isArray(result.data) ? result.data.length : null };
  }

  private async executePost(params: Record<string, string>): Promise<QueryResult<T>> {
    const path = this.getPath();
    const body = this.bodyData;
    const result = await api.post<T>(path, body);

    if (result.error) {
      return { data: null, error: result.error, status: result.status };
    }

    let data = result.data;
    if ((this.isSingle || this.isMaybeSingle) && Array.isArray(data)) {
      data = data.length > 0 ? (data[0] as T) : null;
    }

    return { data, error: null };
  }

  private async executePatch(params: Record<string, string>): Promise<QueryResult<T>> {
    const id = this.getIdFilter();
    const path = id ? `${this.getPath()}/${id}` : this.getPath();

    const body = this.bodyData as Record<string, unknown> || {};
    const result = await api.patch<T>(path, body);

    if (result.error) {
      return { data: null, error: result.error, status: result.status };
    }

    let data = result.data;
    if ((this.isSingle || this.isMaybeSingle) && Array.isArray(data)) {
      data = data.length > 0 ? (data[0] as T) : null;
    }

    return { data, error: null };
  }

  private async executeDelete(params: Record<string, string>): Promise<QueryResult<T>> {
    const id = this.getIdFilter();
    // DELETE с id → /api/query/table/id, без id → /api/query/table?filters
    const path = id ? `${this.getPath()}/${id}` : this.getPath();

    const result = id
      ? await api.delete<T>(path)
      : await api.delete<T>(path, params);

    if (result.error) {
      return { data: null, error: result.error, status: result.status };
    }

    return { data: result.data, error: null };
  }
}

// ============================================================================
// supabase compatibility object
// ============================================================================

export const supabase = {
  auth,
  storage,

  from<T = unknown>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },

  rpc<T = unknown>(functionName: string, params?: Record<string, unknown>) {
    return api.rpc<T>(functionName, params);
  },
};

export default supabase;
