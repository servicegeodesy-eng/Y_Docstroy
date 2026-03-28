import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { fullName } from "@/lib/utils";
import type { ProjectRoleType, PermissionKey } from "@/types";
import { ROLES } from "@/types";

interface Props {
  onClose: () => void;
}

interface MemberRow {
  user_id: string;
  project_role: ProjectRoleType | null;
  profiles: { last_name: string; first_name: string; middle_name: string | null };
}

interface PermRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

const REQUEST_PERM_KEYS: { key: PermissionKey; label: string }[] = [
  { key: "can_view_requests", label: "Видит вкладку" },
  { key: "can_create_requests", label: "Создавать" },
  { key: "can_execute_requests", label: "Выполнять" },
];

export default function RequestPermissionsPanel({ onClose }: Props) {
  const { project } = useProject();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!project) return;
    const [membersRes, permsRes] = await Promise.all([
      supabase
        .from("project_members")
        .select("user_id, project_role, profiles(id, last_name, first_name, middle_name)")
        .eq("project_id", project.id),
      supabase
        .from("user_permissions")
        .select("*")
        .eq("project_id", project.id),
    ]);
    setMembers((membersRes.data || []) as unknown as MemberRow[]);
    setPerms((permsRes.data || []) as unknown as PermRow[]);
    setLoading(false);
  }, [project]);

  useEffect(() => { load(); }, [load]);

  function getPermForUser(userId: string): PermRow | undefined {
    return perms.find((p) => p.user_id === userId);
  }

  function getEffectiveValue(userId: string, _role: ProjectRoleType | null, key: PermissionKey): boolean {
    const perm = getPermForUser(userId);
    if (perm && perm[key] !== undefined && perm[key] !== null) return perm[key] as boolean;
    // Разрешения заявок по умолчанию выключены — только индивидуальное включение
    return false;
  }

  async function togglePerm(userId: string, role: ProjectRoleType | null, key: PermissionKey) {
    if (!project) return;
    setSaving(userId + key);
    const existing = getPermForUser(userId);
    const currentVal = getEffectiveValue(userId, role, key);
    const newVal = !currentVal;

    // Собираем все обновления
    const updates: Record<string, boolean> = { [key]: newVal };

    // Автоматически включаем видимость при включении создания или выполнения
    if (newVal && (key === "can_create_requests" || key === "can_execute_requests")) {
      if (!getEffectiveValue(userId, role, "can_view_requests")) {
        updates["can_view_requests"] = true;
      }
    }

    // При выключении видимости — выключаем создание и выполнение
    if (!newVal && key === "can_view_requests") {
      updates["can_create_requests"] = false;
      updates["can_execute_requests"] = false;
    }

    if (existing) {
      await supabase.from("user_permissions").update(updates).eq("id", existing.id);
      setPerms((prev) => prev.map((p) => p.id === existing.id ? { ...p, ...updates } : p));
    } else {
      const newPerm: Record<string, unknown> = {
        project_id: project.id, user_id: userId, ...updates,
      };
      const { data } = await supabase.from("user_permissions").insert(newPerm).select().single();
      if (data) setPerms((prev) => [...prev, data as unknown as PermRow]);
    }
    setSaving(null);
  }

  const filteredMembers = members.filter(
    (m) =>
      m.project_role !== ROLES.ADMIN &&
      m.project_role !== ROLES.PROJECT_ADMIN
  );

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div className="ds-modal w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <div>
            <h2 className="ds-modal-title">Разрешения заявок</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>Администраторы имеют полный доступ. При включении «Создавать» или «Выполнять» видимость включается автоматически.</p>
          </div>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
          ) : filteredMembers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-muted)" }}>Нет участников</div>
          ) : (
            <table className="ds-table w-full">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1 text-[10px]">Участник</th>
                  <th className="text-left px-2 py-1 text-[10px]">Роль</th>
                  {REQUEST_PERM_KEYS.map((pk) => (
                    <th key={pk.key} className="text-center px-2 py-1 text-[10px]">{pk.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const hasPerm = !!getPermForUser(m.user_id);
                  return (
                    <tr key={m.user_id}>
                      <td className="px-4 py-2" style={{ color: "var(--ds-text)" }}>{fullName(m.profiles)}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--ds-text-muted)" }}>{m.project_role || "Без роли"}</td>
                      {REQUEST_PERM_KEYS.map((pk) => {
                        const isOn = getEffectiveValue(m.user_id, m.project_role, pk.key);
                        return (
                          <td key={pk.key} className="px-2 py-2 text-center">
                            <button
                              onClick={() => togglePerm(m.user_id, m.project_role, pk.key)}
                              disabled={saving === m.user_id + pk.key}
                              className="relative w-7 h-7 rounded-md transition-colors"
                              style={isOn
                                ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                                : { background: "var(--ds-surface-sunken)", color: "var(--ds-text-faint)" }
                              }
                            >
                              {isOn ? (
                                <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              {hasPerm && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--ds-accent)" }} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
