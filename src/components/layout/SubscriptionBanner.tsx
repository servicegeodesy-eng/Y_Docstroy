import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";

interface SubscriptionBannerData {
  status: "active" | "trial" | "suspended" | "expired";
  expires_at: string | null;
  delete_scheduled_at: string | null;
  users: { current: number; max: number };
  storage: { used_gb: number; max_gb: number };
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

function getPercent(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

export default function SubscriptionBanner() {
  const { project } = useProject();
  const companyId = (project as Record<string, unknown>)?.company_id as string | undefined;
  const [data, setData] = useState<SubscriptionBannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    api.get<SubscriptionBannerData>("/api/subscriptions/status", { company_id: companyId }).then((res) => {
      if (res.data) setData(res.data);
    });
  }, [companyId]);

  if (dismissed || !data || !data.users || !data.storage) return null;

  const warnings: { text: string; color: string; bg: string; border: string }[] = [];

  if (data.status === "suspended") {
    warnings.push({
      text: "Подписка приостановлена. Действия заморожены.",
      color: "#dc2626", bg: "#fef2f2", border: "#fecaca",
    });
  }

  if (data.delete_scheduled_at) {
    const days = daysUntil(data.delete_scheduled_at);
    warnings.push({
      text: `Данные будут удалены через ${days} ${pluralDays(days)}`,
      color: "#dc2626", bg: "#fef2f2", border: "#fecaca",
    });
  }

  if (data.status !== "suspended" && data.expires_at) {
    const days = daysUntil(data.expires_at);
    if (days < 14) {
      warnings.push({
        text: `Подписка истекает через ${days} ${pluralDays(days)}`,
        color: "#d97706", bg: "#fffbeb", border: "#fde68a",
      });
    }
  }

  const userPct = getPercent(data.users.current, data.users.max);
  if (userPct > 80) {
    warnings.push({
      text: `Лимит пользователей: ${data.users.current}/${data.users.max} (${userPct}%)`,
      color: "#ea580c", bg: "#fff7ed", border: "#fed7aa",
    });
  }

  const storagePct = getPercent(data.storage.used_gb, data.storage.max_gb);
  if (storagePct > 80) {
    warnings.push({
      text: `Хранилище: ${data.storage.used_gb}/${data.storage.max_gb} ГБ (${storagePct}%)`,
      color: "#ea580c", bg: "#fff7ed", border: "#fed7aa",
    });
  }

  if (warnings.length === 0) return null;

  const primary = warnings[0];

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm"
      style={{ background: primary.bg, borderBottom: `1px solid ${primary.border}` }}
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {warnings.map((w, i) => (
          <span key={i} className="font-medium" style={{ color: w.color }}>{w.text}</span>
        ))}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 ml-2 p-1 rounded hover:bg-black/5 transition-colors"
        style={{ color: primary.color }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
