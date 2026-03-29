import { Response, NextFunction } from 'express';
import pool from '../config/db';
import { AuthRequest } from './auth';

interface SubscriptionInfo {
  status: string;
  max_users: number;
  max_projects: number;
  storage_gb: number;
  storage_used_bytes: number;
  expires_at: string;
  suspended_at: string | null;
  delete_scheduled_at: string | null;
}

// Кэш подписок (обновляется раз в 5 минут)
const cache = new Map<string, { data: SubscriptionInfo | null; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getCompanySubscription(companyId: string): Promise<SubscriptionInfo | null> {
  const cached = cache.get(companyId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const result = await pool.query(
    `SELECT cs.status, cs.expires_at, cs.suspended_at, cs.delete_scheduled_at,
            cs.storage_used_bytes, sp.max_users, sp.max_projects, sp.storage_gb
     FROM company_subscriptions cs
     JOIN subscription_plans sp ON sp.id = cs.plan_id
     WHERE cs.company_id = $1
     ORDER BY cs.created_at DESC LIMIT 1`,
    [companyId]
  );

  const data = result.rows[0] || null;
  cache.set(companyId, { data, ts: Date.now() });
  return data;
}

export function clearSubscriptionCache(companyId: string) {
  cache.delete(companyId);
}

// Получить company_id по project_id
async function getCompanyIdByProject(projectId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT company_id FROM projects WHERE id = $1', [projectId]
  );
  return result.rows[0]?.company_id || null;
}

// Middleware: блокировать мутации при приостановленной подписке
export function checkSubscription(getProjectId: (req: AuthRequest) => string | undefined) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = getProjectId(req);
      if (!projectId) return next();

      const companyId = await getCompanyIdByProject(projectId);
      if (!companyId) return next();

      const sub = await getCompanySubscription(companyId);
      if (!sub) return next(); // Нет подписки — пропускаем (пока не обязательна)

      if (sub.status === 'suspended' || sub.status === 'deleting') {
        res.status(403).json({
          error: 'Подписка приостановлена. Доступен только просмотр и скачивание.',
          subscription_status: sub.status,
        });
        return;
      }

      if (sub.status === 'deleted') {
        res.status(403).json({
          error: 'Данные компании удалены.',
          subscription_status: sub.status,
        });
        return;
      }

      next();
    } catch {
      next(); // При ошибке не блокируем
    }
  };
}

// Проверка лимита пользователей
export async function checkUserLimit(companyId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const sub = await getCompanySubscription(companyId);
  if (!sub) return { allowed: true, current: 0, max: 0 };
  if (sub.max_users === 0) return { allowed: true, current: 0, max: 0 }; // 0 = безлимит

  const countResult = await pool.query(
    'SELECT count(*)::int as cnt FROM company_members WHERE company_id = $1',
    [companyId]
  );
  const current = countResult.rows[0].cnt;

  return { allowed: current < sub.max_users, current, max: sub.max_users };
}

// Проверка лимита проектов
export async function checkProjectLimit(companyId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const sub = await getCompanySubscription(companyId);
  if (!sub) return { allowed: true, current: 0, max: 0 };
  if (sub.max_projects === 0) return { allowed: true, current: 0, max: 0 };

  const countResult = await pool.query(
    'SELECT count(*)::int as cnt FROM projects WHERE company_id = $1',
    [companyId]
  );
  const current = countResult.rows[0].cnt;

  return { allowed: current < sub.max_projects, current, max: sub.max_projects };
}

// Проверка лимита хранилища
export async function checkStorageLimit(companyId: string): Promise<{ allowed: boolean; usedGb: number; maxGb: number }> {
  const sub = await getCompanySubscription(companyId);
  if (!sub) return { allowed: true, usedGb: 0, maxGb: 0 };
  if (sub.storage_gb === 0) return { allowed: true, usedGb: 0, maxGb: 0 };

  const usedGb = sub.storage_used_bytes / (1024 * 1024 * 1024);
  return { allowed: usedGb < sub.storage_gb, usedGb, maxGb: sub.storage_gb };
}
