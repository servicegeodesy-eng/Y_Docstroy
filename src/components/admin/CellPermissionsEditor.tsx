import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CellActionKey, CellActionPermission } from "@/types";
import { CELL_ACTION_KEYS, CELL_ACTION_LABELS, CELL_ROLE_CONTEXTS, CELL_ROLE_CONTEXT_LABELS } from "@/types";

interface Props {
  projectId: string;
  onBack: () => void;
}

export default function CellPermissionsEditor({ projectId, onBack }: Props) {
  const [rows, setRows] = useState<CellActionPermission[]>([]);
  const [statusNames, setStatusNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>("");

  useEffect(() => {
    if (statusNames.length > 0 && !activeStatus) {
      setActiveStatus(statusNames[0]);
    }
  }, [statusNames, activeStatus]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    // Загрузить статусы проекта
    const { data: statusData } = await supabase
      .from("project_statuses")
      .select("name")
      .eq("project_id", projectId)
      .order("sort_order");
    setStatusNames((statusData || []).map((s: { name: string }) => s.name));

    // Убедиться что дефолты засижены
    await supabase.rpc("seed_cell_action_permissions", { p_project_id: projectId });
    const { data } = await supabase
      .from("cell_action_permissions")
      .select("*")
      .eq("project_id", projectId);
    setRows((data || []) as CellActionPermission[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  function getRow(roleCtx: string, status: string): CellActionPermission | undefined {
    return rows.find((r) => r.role_context === roleCtx && r.status_name === status);
  }

  function getValue(roleCtx: string, status: string, key: CellActionKey): boolean {
    const row = getRow(roleCtx, status);
    return row ? row[key] : false;
  }

  async function toggle(roleCtx: string, status: string, key: CellActionKey) {
    if (!projectId) return;
    const row = getRow(roleCtx, status);
    const current = row ? row[key] : false;
    const savingKey = `${roleCtx}|${status}|${key}`;
    setSaving(savingKey);

    if (row) {
      await supabase
        .from("cell_action_permissions")
        .update({ [key]: !current, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      const insert: Record<string, unknown> = {
        project_id: projectId,
        role_context: roleCtx,
        status_name: status,
      };
      for (const k of CELL_ACTION_KEYS) {
        insert[k] = k === key ? !current : false;
      }
      await supabase.from("cell_action_permissions").insert(insert);
    }

    await loadData();
    setSaving(null);
  }

  async function setAll(roleCtx: string, status: string, value: boolean) {
    if (!projectId) return;
    setSaving(`${roleCtx}|${status}|all`);
    const row = getRow(roleCtx, status);
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of CELL_ACTION_KEYS) update[k] = value;

    if (row) {
      await supabase.from("cell_action_permissions").update(update).eq("id", row.id);
    } else {
      await supabase.from("cell_action_permissions").insert({
        project_id: projectId,
        role_context: roleCtx,
        status_name: status,
        ...update,
      });
    }
    await loadData();
    setSaving(null);
  }

  function roleLabel(ctx: string): string {
    return CELL_ROLE_CONTEXT_LABELS[ctx] || ctx;
  }

  if (loading) {
    return (
      <div className="ds-card p-8 text-center">
        <div className="ds-spinner mx-auto mb-3" />
        <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка разрешений...</p>
      </div>
    );
  }

  return (
    <div className="ds-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>Разрешения ячеек</h3>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
          Роли × Статусы × Действия
        </span>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        {statusNames.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeStatus === s ? "ds-btn shadow-sm" : "hover:bg-white/50"
            }`}
            style={activeStatus !== s ? { color: "var(--ds-text-muted)" } : undefined}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Matrix */}
      {activeStatus && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ds-border)" }}>
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-[var(--ds-surface)]" style={{ color: "var(--ds-text-muted)", minWidth: 180 }}>
                  Роль / Контекст
                </th>
                {CELL_ACTION_KEYS.map((key) => (
                  <th key={key} className="px-2 py-2 text-center font-medium" style={{ color: "var(--ds-text-muted)", minWidth: 80 }}>
                    <span title={CELL_ACTION_LABELS[key]}>{CELL_ACTION_LABELS[key]}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium" style={{ color: "var(--ds-text-faint)", minWidth: 60 }}>
                  Все
                </th>
              </tr>
            </thead>
            <tbody>
              {CELL_ROLE_CONTEXTS.map((ctx) => {
                const allOn = CELL_ACTION_KEYS.every((k) => getValue(ctx, activeStatus, k));
                const allOff = CELL_ACTION_KEYS.every((k) => !getValue(ctx, activeStatus, k));
                return (
                  <tr
                    key={ctx}
                    style={{ borderBottom: "1px solid var(--ds-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ds-surface-sunken)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-3 py-2 font-medium sticky left-0 bg-[var(--ds-surface)]" style={{ color: ctx.startsWith("__") ? "var(--ds-accent)" : "var(--ds-text)" }}>
                      {roleLabel(ctx)}
                    </td>
                    {CELL_ACTION_KEYS.map((key) => {
                      const val = getValue(ctx, activeStatus, key);
                      const isSaving = saving === `${ctx}|${activeStatus}|${key}`;
                      return (
                        <td key={key} className="px-2 py-2 text-center">
                          <button
                            onClick={() => toggle(ctx, activeStatus, key)}
                            disabled={!!saving}
                            className={`w-7 h-7 rounded-md border-2 transition-all inline-flex items-center justify-center ${
                              val
                                ? "bg-[var(--ds-accent)] border-[var(--ds-accent)] text-white"
                                : "border-gray-300 hover:border-gray-400"
                            }`}
                            style={isSaving ? { opacity: 0.5 } : undefined}
                          >
                            {val && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => setAll(ctx, activeStatus, !allOn)}
                        disabled={!!saving}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{
                          color: allOn ? "#ef4444" : allOff ? "var(--ds-accent)" : "var(--ds-text-muted)",
                          background: "var(--ds-surface-sunken)",
                        }}
                        title={allOn ? "Снять все" : "Включить все"}
                      >
                        {allOn ? "−" : "+"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 text-xs" style={{ color: "var(--ds-text-faint)", borderTop: "1px solid var(--ds-border)" }}>
        Администраторы портала и проекта имеют все разрешения автоматически.
        Специальные контексты: <strong>Создатель ячейки</strong> — пользователь, создавший ячейку; <strong>Входящая задача</strong> — ячейка назначена пользователю.
      </div>
    </div>
  );
}
