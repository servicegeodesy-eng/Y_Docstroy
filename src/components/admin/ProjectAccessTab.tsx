import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { Profile, ProjectRoleType } from "@/types";
import { PROJECT_ROLES, ROLES } from "@/types";
import { shortName } from "@/lib/utils";

interface MemberInfo {
  memberId: string;
  projectRole: ProjectRoleType | null;
  organizationId: string | null;
}

interface UserWithAccess {
  profile: Profile;
  member: MemberInfo | null;
  projectCount: number;
}

export default function ProjectAccessTab() {
  const { project } = useProject();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<ProjectRoleType | "">("");

  useEffect(() => {
    if (!project) return;
    loadData();
  }, [project]);

  async function loadData() {
    if (!project) return;

    const [profilesRes, membersRes, allMembersRes] = await Promise.all([
      supabase.from("profiles").select("*").order("last_name"),
      supabase
        .from("project_members")
        .select("id, user_id, project_role, organization_id")
        .eq("project_id", project.id),
      // Получить количество проектов для каждого пользователя
      supabase.from("project_members").select("user_id"),
    ]);

    const memberMap = new Map<string, MemberInfo>();
    for (const m of membersRes.data || []) {
      memberMap.set(m.user_id, {
        memberId: m.id,
        projectRole: m.project_role,
        organizationId: m.organization_id,
      });
    }

    // Подсчёт проектов по пользователям
    const projectCountMap = new Map<string, number>();
    for (const m of allMembersRes.data || []) {
      projectCountMap.set(m.user_id, (projectCountMap.get(m.user_id) || 0) + 1);
    }

    const mapped: UserWithAccess[] = (profilesRes.data || []).map((p) => ({
      profile: p as Profile,
      member: memberMap.get(p.id) || null,
      projectCount: projectCountMap.get(p.id) || 0,
    }));

    setUsers(mapped);
    setLoading(false);
  }

  async function toggleAccess(user: UserWithAccess) {
    if (!project || user.profile.is_portal_admin) return;
    setSaving(user.profile.id);

    if (user.member) {
      await supabase
        .from("project_members")
        .delete()
        .eq("id", user.member.memberId);
      await supabase
        .from("user_permissions")
        .delete()
        .eq("project_id", project.id)
        .eq("user_id", user.profile.id);
    } else {
      await supabase.from("project_members").insert({
        project_id: project.id,
        user_id: user.profile.id,
        role: "member",
      });
    }

    await loadData();
    setSaving(null);
  }

  async function deleteUser(user: UserWithAccess) {
    if (user.projectCount > 0 || user.profile.is_portal_admin) return;
    if (!confirm(`Удалить пользователя ${shortName(user.profile)}?\n\nЭто действие необратимо — будут удалены профиль и учётная запись.`)) return;
    setSaving(user.profile.id);

    const { error } = await supabase.rpc("delete_user_completely", { target_user_id: user.profile.id });
    if (error) {
      alert("Ошибка удаления: " + error.message);
    }

    await loadData();
    setSaving(null);
  }

  function startEdit(user: UserWithAccess) {
    if (user.profile.is_portal_admin) return;
    setEditingId(user.profile.id);
    setEditRole(user.member?.projectRole || "");
  }

  async function saveEdit(user: UserWithAccess) {
    if (!user.member || !project) return;
    setSaving(user.profile.id);

    const roleChanged = (editRole || null) !== user.member.projectRole;

    await supabase
      .from("project_members")
      .update({ project_role: editRole || null })
      .eq("id", user.member.memberId);

    if (roleChanged) {
      await supabase.from("user_permissions").delete().eq("project_id", project.id).eq("user_id", user.profile.id);
    }

    setEditingId(null);
    await loadData();
    setSaving(null);
  }

  function fullName(p: Profile) {
    return shortName(p);
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = fullName(u.profile).toLowerCase();
    return (
      name.includes(q) ||
      (u.profile.organization || "").toLowerCase().includes(q)
    );
  });

  // Разделить на две группы: без проектов (вверху) и с проектами (по алфавиту)
  const noProjects = filtered.filter((u) => u.projectCount === 0);
  const withProjects = filtered.filter((u) => u.projectCount > 0);

  const membersCount = users.filter((u) => u.member).length;

  if (loading) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        Загрузка пользователей...
      </div>
    );
  }

  function renderRow(u: UserWithAccess) {
    const isMember = !!u.member;
    const isBusy = saving === u.profile.id;
    const isEditing = editingId === u.profile.id;
    const isPortalAdminUser = u.profile.is_portal_admin;

    return (
      <tr
        key={u.profile.id}
        className={`whitespace-nowrap ${!isMember ? "opacity-60" : ""}`}
      >
        <td className="font-medium">
          {fullName(u.profile)}
          {isPortalAdminUser && (
            <span className="ml-2 text-xs font-normal" style={{ color: "var(--ds-accent)" }}>админ портала</span>
          )}
        </td>

        <td className="text-center">
          <button
            onClick={() => toggleAccess(u)}
            disabled={isBusy || isPortalAdminUser}
            className={`w-4 h-4 rounded border-2 inline-flex items-center justify-center transition-colors ${isBusy ? "opacity-50" : ""}`}
            style={isMember
              ? { background: "var(--ds-accent)", borderColor: "var(--ds-accent)", color: "white" }
              : { borderColor: "var(--ds-border-strong)" }
            }
          >
            {isMember && (
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </td>

        <td>
          {isMember && isEditing ? (
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as ProjectRoleType)}
              className="ds-input text-xs px-2 py-0.5"
            >
              <option value="">Без роли</option>
              {PROJECT_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          ) : (
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
              style={u.member?.projectRole
                ? u.member.projectRole === ROLES.PROJECT_ADMIN
                  ? { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" }
                  : { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                : { color: "var(--ds-text-faint)" }
              }
            >
              {u.member?.projectRole || "Без роли"}
            </span>
          )}
        </td>

        <td className="text-right whitespace-nowrap">
          <div className="inline-flex items-center gap-1.5">
            {isMember && !isPortalAdminUser && (
              isEditing ? (
                <>
                  <button onClick={() => saveEdit(u)} disabled={isBusy} className="ds-btn px-2 py-0.5 text-xs">OK</button>
                  <button onClick={() => setEditingId(null)} className="ds-btn-secondary px-2 py-0.5 text-xs">Отмена</button>
                </>
              ) : (
                <button onClick={() => startEdit(u)} disabled={isBusy} className="ds-btn-secondary px-2 py-0.5 text-xs disabled:opacity-50">
                  Назначить роль
                </button>
              )
            )}
            {u.projectCount === 0 && !isPortalAdminUser && (
              <button
                onClick={() => deleteUser(u)}
                disabled={isBusy}
                className="px-2 py-0.5 text-xs rounded font-medium transition-colors"
                style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))" }}
                title="Удалить пользователя (нет проектов)"
              >
                Удалить
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="ds-card">
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>
          Доступ к проекту ({membersCount} из {users.length} пользователей)
        </h3>
      </div>

      {/* Поиск */}
      <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--ds-text-faint)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, email или организации..."
            className="ds-input pl-10"
          />
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto">
        <table className="ds-table">
          <thead>
            <tr className="whitespace-nowrap">
              <th>ФИО</th>
              <th className="text-center w-20">В проекте</th>
              <th>Роль</th>
              <th className="text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {/* Пользователи без проектов */}
            {noProjects.length > 0 && (
              <>
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 text-xs font-medium" style={{ background: "color-mix(in srgb, #f59e0b 8%, var(--ds-surface))", color: "#f59e0b" }}>
                    Без проектов ({noProjects.length})
                  </td>
                </tr>
                {noProjects.map(renderRow)}
              </>
            )}

            {/* Разделитель */}
            {noProjects.length > 0 && withProjects.length > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-1.5 text-xs font-medium" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                  Назначены в проекты
                </td>
              </tr>
            )}

            {/* Пользователи с проектами */}
            {withProjects.map(renderRow)}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--ds-text-faint)" }}>
                  {search ? "Пользователи не найдены" : "Нет зарегистрированных пользователей"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
