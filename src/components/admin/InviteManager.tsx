import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { PROJECT_ROLES, type ProjectRoleType } from "@/types";

interface Invite {
  id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at: string;
  created_at: string;
}

export default function InviteManager() {
  const { project } = useProject();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<ProjectRoleType>(PROJECT_ROLES[0]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [maxUses, setMaxUses] = useState(1);

  const companyId = (project as Record<string, unknown>)?.company_id as string | undefined;

  useEffect(() => {
    if (project) loadInvites();
  }, [project]);

  async function loadInvites() {
    if (!project || !companyId) return;
    setLoading(true);
    const { data, error: err } = await api.get<Invite[]>("/api/invites", {
      company_id: companyId,
      project_id: project.id,
    });
    if (err) {
      setError(err);
    } else {
      setInvites(data || []);
    }
    setLoading(false);
  }

  async function createInvite() {
    if (!project || !companyId) return;
    setCreating(true);
    setError(null);
    const { data, error: err } = await api.post<Invite>("/api/invites", {
      company_id: companyId,
      project_id: project.id,
      role,
      expires_in_days: expiryDays,
      max_uses: maxUses,
    });
    if (err) {
      setError(err);
    } else if (data) {
      setInvites((prev) => [data, ...prev]);
      setShowForm(false);
    }
    setCreating(false);
  }

  async function deleteInvite(id: string) {
    if (!confirm("Удалить приглашение?")) return;
    const { error: err } = await api.delete(`/api/invites/${id}`);
    if (err) {
      setError(err);
    } else {
      setInvites((prev) => prev.filter((i) => i.id !== id));
    }
  }

  function getLink(code: string) {
    return `${window.location.origin}/invite/${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(getLink(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      prompt("Скопируйте ссылку:", getLink(code));
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isExpired(dateStr: string) {
    return new Date(dateStr) < new Date();
  }

  if (loading) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        Загрузка приглашений...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg text-sm text-red-600 bg-red-50">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
          Приглашения
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ds-btn text-sm"
        >
          {showForm ? "Отмена" : "Создать приглашение"}
        </button>
      </div>

      {showForm && (
        <div className="ds-card p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
              Роль в проекте
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectRoleType)}
              className="ds-input w-full text-sm"
            >
              {PROJECT_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                Срок действия (дней)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="ds-input w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                Макс. использований
              </label>
              <input
                type="number"
                min={0}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="ds-input w-full text-sm"
              />
              <p className="text-xs mt-1" style={{ color: "var(--ds-text-faint)" }}>
                0 = без ограничений
              </p>
            </div>
          </div>

          <button
            onClick={createInvite}
            disabled={creating}
            className="ds-btn text-sm"
          >
            {creating ? "Создание..." : "Создать"}
          </button>
        </div>
      )}

      {invites.length === 0 && !showForm ? (
        <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
          <p className="text-sm">Нет активных приглашений</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ds-table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Роль</th>
                  <th className="whitespace-nowrap">Код</th>
                  <th className="whitespace-nowrap text-center">Использовано</th>
                  <th className="whitespace-nowrap">Истекает</th>
                  <th className="text-center whitespace-nowrap">Действия</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const expired = isExpired(inv.expires_at);
                  const exhausted = inv.max_uses > 0 && inv.used_count >= inv.max_uses;

                  return (
                    <tr key={inv.id} style={expired || exhausted ? { opacity: 0.5 } : undefined}>
                      <td>
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}
                        >
                          {inv.role}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{inv.code}</td>
                      <td className="text-center text-sm">
                        {inv.used_count}/{inv.max_uses === 0 ? "\u221e" : inv.max_uses}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        <span style={{ color: expired ? "var(--ds-text-faint)" : "var(--ds-text-muted)" }}>
                          {formatDate(inv.expires_at)}
                        </span>
                        {expired && (
                          <span className="ml-1 text-red-500 text-xs">истекло</span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!expired && !exhausted && (
                            <button
                              onClick={() => copyLink(inv.code)}
                              className="ds-btn-secondary px-2 py-1 text-xs"
                              title="Скопировать ссылку"
                            >
                              {copiedCode === inv.code ? "Скопировано" : "Ссылка"}
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvite(inv.id)}
                            className="px-2 py-1 text-xs rounded font-medium transition-colors text-red-500 hover:bg-red-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
