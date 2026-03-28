import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { Profile, ProjectRoleType } from "@/types";
import { PROJECT_ROLES, ROLES } from "@/types";
import { shortName } from "@/lib/utils";

/** Роли, которые администратор проекта НЕ может назначать */
const FORBIDDEN_ROLES: ProjectRoleType[] = [ROLES.ADMIN, ROLES.PROJECT_ADMIN];

/** Роли доступные для назначения администратором проекта */
const ASSIGNABLE_ROLES = PROJECT_ROLES.filter((r) => !FORBIDDEN_ROLES.includes(r));

interface MemberInfo {
  memberId: string;
  userId: string;
  profile: Profile;
  projectRole: ProjectRoleType | null;
  organizationId: string | null;
}

export default function ProjectUsersTab() {
  const { project } = useProject();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<ProjectRoleType | "">("");

  useEffect(() => {
    if (!project) return;
    loadData();
  }, [project]);

  async function loadData() {
    if (!project) return;

    const { data: membersData } = await supabase
      .from("project_members")
      .select("id, user_id, project_role, organization_id, profiles(*)")
      .eq("project_id", project.id);

    const mapped: MemberInfo[] = (membersData || []).map((m: Record<string, unknown>) => ({
      memberId: m.id as string,
      userId: m.user_id as string,
      profile: m.profiles as Profile,
      projectRole: m.project_role as ProjectRoleType | null,
      organizationId: m.organization_id as string | null,
    }));

    mapped.sort((a, b) =>
      (a.profile?.last_name || "").localeCompare(b.profile?.last_name || "")
    );

    setMembers(mapped);
    setLoading(false);
  }

  function startEdit(m: MemberInfo) {
    if (m.profile?.is_portal_admin) return;
    setEditingId(m.userId);
    setEditRole(m.projectRole || "");
  }

  async function saveEdit(m: MemberInfo) {
    if (!project) return;
    setSaving(m.userId);

    const roleChanged = (editRole || null) !== m.projectRole;

    await supabase
      .from("project_members")
      .update({
        project_role: editRole || null,
      })
      .eq("id", m.memberId);

    // При смене роли сбросить индивидуальные разрешения — применятся дефолты новой роли
    if (roleChanged) {
      await supabase.from("user_permissions").delete().eq("project_id", project.id).eq("user_id", m.userId);
    }

    setEditingId(null);
    await loadData();
    setSaving(null);
  }

  function fullName(p: Profile | null) {
    if (!p) return "—";
    return shortName(p);
  }

  if (loading) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        Загрузка участников...
      </div>
    );
  }

  return (
    <div className="ds-card">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>
          Пользователи проекта ({members.length})
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--ds-text-faint)" }}>
          Вы можете назначать роли пользователям проекта
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="ds-table">
          <thead>
            <tr>
              <th className="whitespace-nowrap">ФИО</th>
              <th className="whitespace-nowrap">Роль</th>
              <th className="text-center whitespace-nowrap">Действия</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isAdmin = m.projectRole === ROLES.PROJECT_ADMIN;
              const isBusy = saving === m.userId;
              const isEditing = editingId === m.userId;

              return (
                <tr key={m.userId}>
                  <td className="font-medium">
                    {fullName(m.profile)}
                  </td>

                  {/* Роль */}
                  <td className="whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as ProjectRoleType)}
                        className="ds-input text-xs"
                      >
                        {!editRole && <option value="">Выберите роль...</option>}
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : m.projectRole ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={isAdmin
                          ? { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" }
                          : { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                        }
                      >
                        {m.projectRole}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Без роли</span>
                    )}
                  </td>

                  <td className="text-center whitespace-nowrap">
                    {!isAdmin && (
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(m)}
                              disabled={isBusy}
                              className="ds-btn px-2 py-1 text-xs"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="ds-btn-secondary px-2 py-1 text-xs"
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(m)}
                            className="px-3 py-1 text-xs rounded font-medium transition-colors"
                            style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}
                          >
                            Назначить роль
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
