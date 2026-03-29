import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";

interface LimitInfo {
  current: number;
  max: number;
}

interface StorageInfo {
  used_gb: number;
  max_gb: number;
}

interface ProjectInfo {
  id: string;
  name: string;
  member_count: number;
}

// Ответ API /api/subscriptions/status
interface ApiSubscriptionStatus {
  company_name: string;
  subscription: {
    status: string;
    expires_at: string | null;
    suspended_at: string | null;
    delete_scheduled_at: string | null;
  } | null;
  limits: {
    users: LimitInfo;
    projects: LimitInfo;
    storage: StorageInfo;
  };
  projects: ProjectInfo[];
}

interface SubscriptionStatus {
  plan_name: string;
  status: "active" | "trial" | "suspended" | "expired";
  expires_at: string | null;
  delete_scheduled_at: string | null;
  objects: LimitInfo;
  users: LimitInfo;
  storage: StorageInfo;
  projects: ProjectInfo[];
}

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  trial: "Пробный",
  suspended: "Приостановлен",
  expired: "Истёк",
};

function getPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((current / max) * 100);
}

function getBarColor(percent: number): string {
  if (percent > 80) return "#ef4444";
  if (percent >= 60) return "#f59e0b";
  return "#22c55e";
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ProgressBar({ label, current, max, unit }: { label: string; current: number; max: number; unit?: string }) {
  const percent = getPercent(current, max);
  const color = getBarColor(percent);
  const suffix = unit ? ` ${unit}` : "";

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{label}</span>
        <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
          {current}{suffix} / {max}{suffix} ({percent}%)
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--ds-surface-sunken)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percent, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function SubscriptionPanel() {
  const { project } = useProject();
  const companyId = (project as Record<string, unknown>)?.company_id as string | undefined;
  const [data, setData] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    async function load() {
      setLoading(true);
      setError(null);
      const res = await api.get<ApiSubscriptionStatus>("/api/subscriptions/status", { company_id: companyId! });
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const r = res.data;
        setData({
          plan_name: r.subscription?.status === "trial" ? "Пробный" : "Активный",
          status: (r.subscription?.status || "active") as SubscriptionStatus["status"],
          expires_at: r.subscription?.expires_at || null,
          delete_scheduled_at: r.subscription?.delete_scheduled_at || null,
          objects: r.limits.projects,
          users: r.limits.users,
          storage: r.limits.storage,
          projects: r.projects,
        });
      }
      setLoading(false);
    }

    load();
  }, [companyId]);

  if (loading) {
    return (
      <div className="ds-card p-8 text-center">
        <div className="ds-spinner mx-auto mb-3" />
        <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Загрузка подписки...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-card p-8 text-center">
        <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const expiresIn = data.expires_at ? daysUntil(data.expires_at) : null;
  const deleteIn = data.delete_scheduled_at ? daysUntil(data.delete_scheduled_at) : null;

  return (
    <div className="space-y-4">
      {data.status === "suspended" && (
        <div className="rounded-lg px-4 py-3" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
            Подписка приостановлена. Доступен только просмотр и скачивание.
          </p>
        </div>
      )}

      {data.status !== "suspended" && expiresIn !== null && expiresIn < 14 && (
        <div className="rounded-lg px-4 py-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
          <p className="text-sm font-medium" style={{ color: "#d97706" }}>
            Подписка истекает через {expiresIn} {pluralDays(expiresIn)}
          </p>
        </div>
      )}

      {deleteIn !== null && (
        <div className="rounded-lg px-4 py-3" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
            Данные будут удалены через {deleteIn} {pluralDays(deleteIn)}
          </p>
        </div>
      )}

      <div className="ds-card p-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--ds-text)" }}>Тарифный план</h3>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--ds-text-muted)" }}>План</p>
            <p className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{data.plan_name}</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--ds-text-muted)" }}>Статус</p>
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: data.status === "active" ? "#dcfce7" : data.status === "trial" ? "#dbeafe" : "#fef2f2",
                color: data.status === "active" ? "#16a34a" : data.status === "trial" ? "#2563eb" : "#dc2626",
              }}
            >
              {STATUS_LABELS[data.status] || data.status}
            </span>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--ds-text-muted)" }}>Действует до</p>
            <p className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
              {data.expires_at ? formatDate(data.expires_at) : "Бессрочно"}
            </p>
          </div>
        </div>

        <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>Лимиты</h4>
        <ProgressBar label="Объекты" current={data.objects.current} max={data.objects.max} />
        <ProgressBar label="Пользователи" current={data.users.current} max={data.users.max} />
        <ProgressBar label="Хранилище" current={data.storage.used_gb} max={data.storage.max_gb} unit="ГБ" />
      </div>

      {data.projects && data.projects.length > 0 && (
        <div className="ds-card p-6">
          <h3 className="text-base font-semibold mb-4" style={{ color: "var(--ds-text)" }}>Проекты</h3>
          <div className="space-y-2">
            {data.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--ds-surface-sunken)" }}
              >
                <span className="text-sm" style={{ color: "var(--ds-text)" }}>{p.name}</span>
                <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
                  {p.member_count} {pluralUsers(p.member_count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ds-card p-6">
        <h3 className="text-base font-semibold mb-3" style={{ color: "var(--ds-text)" }}>Условия при окончании подписки</h3>
        <ul className="space-y-2 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <li className="flex items-start gap-2">
            <span style={{ color: "#f59e0b" }}>1.</span>
            <span>Аккаунт переходит в режим <strong>только чтение</strong> — можно просматривать и скачивать документы, но нельзя создавать и редактировать.</span>
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "#ef4444" }}>2.</span>
            <span>Через <strong>6 месяцев</strong> после окончания подписки все данные компании будут <strong>безвозвратно удалены</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "#22c55e" }}>3.</span>
            <span>Для продления подписки обратитесь к администратору портала.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

function pluralUsers(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return "участников";
  if (mod10 === 1) return "участник";
  if (mod10 >= 2 && mod10 <= 4) return "участника";
  return "участников";
}
