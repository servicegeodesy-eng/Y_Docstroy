import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import type { Profile, UserPermission, ProjectRoleType, PermissionKey } from "@/types";
import { ROLES } from "@/types";
import { shortName } from "@/lib/utils";
import { usePortalRolePermissions } from "@/hooks/usePortalRolePermissions";

interface MemberWithPermissions {
  memberId: string;
  userId: string;
  profile: Profile;
  projectRole: ProjectRoleType | null;
  permissions: UserPermission | null;
}

const PERMISSION_COLS: { key: PermissionKey; label: string; group: string }[] = [
  // Страница
  { key: "can_view_tasks", label: "Задачи", group: "Страница" },
  { key: "can_view_requests", label: "Заявки", group: "Страница" },
  { key: "can_view_admin", label: "Админ", group: "Страница" },
  { key: "can_print", label: "Печать", group: "Страница" },
  // Реестр — просмотр
  { key: "can_view_cell", label: "Ячейка", group: "Реестр — просмотр" },
  { key: "can_view_files_block", label: "Файлы", group: "Реестр — просмотр" },
  { key: "can_view_remarks_block", label: "Замечания", group: "Реестр — просмотр" },
  { key: "can_view_supervision_block", label: "Согл. АН", group: "Реестр — просмотр" },
  { key: "can_view_scan_block", label: "Скан", group: "Реестр — просмотр" },
  { key: "can_view_process_block", label: "Процесс", group: "Реестр — просмотр" },
  { key: "can_view_comments_block", label: "Коммент.", group: "Реестр — просмотр" },
  { key: "can_preview_files", label: "Просмотр", group: "Реестр — просмотр" },
  // Реестр — действия
  { key: "can_create_cells", label: "Создание", group: "Реестр — действия" },
  { key: "can_edit_cell", label: "Ред. ячейки", group: "Реестр — действия" },
  { key: "can_delete_cell", label: "Удаление", group: "Реестр — действия" },
  { key: "can_edit_mask", label: "Маски", group: "Реестр — действия" },
  { key: "can_add_update_files", label: "Файлы", group: "Реестр — действия" },
  { key: "can_add_update_supervision", label: "Согл. АН", group: "Реестр — действия" },
  { key: "can_add_update_scan", label: "Сканы", group: "Реестр — действия" },
  { key: "can_add_comments", label: "Коммент.", group: "Реестр — действия" },
  { key: "can_send_cells", label: "Отправка", group: "Реестр — действия" },
  { key: "can_archive", label: "Архив", group: "Реестр — действия" },
  { key: "can_download_files", label: "Скачивание", group: "Реестр — действия" },
  { key: "can_change_status", label: "Статус", group: "Реестр — действия" },
  // Проверка
  { key: "can_remark", label: "Замечания", group: "Проверка" },
  { key: "can_sign", label: "Подпись", group: "Проверка" },
  { key: "can_supervise", label: "АН", group: "Проверка" },
  { key: "can_acknowledge", label: "Ознак.", group: "Проверка" },
  // ГРО
  { key: "can_create_gro", label: "Созд. ГРО", group: "ГРО" },
  { key: "can_edit_gro", label: "Ред. ГРО", group: "ГРО" },
  { key: "can_delete_gro", label: "Удал. ГРО", group: "ГРО" },
  { key: "can_add_gro_files", label: "Файлы ГРО", group: "ГРО" },
  { key: "can_change_gro_status", label: "Статус ГРО", group: "ГРО" },
  // Заявки
  { key: "can_view_requests", label: "Видит", group: "Заявки" },
  { key: "can_create_requests", label: "Созд.", group: "Заявки" },
  { key: "can_execute_requests", label: "Выполн.", group: "Заявки" },
];

const PERM_GROUPS = [...new Set(PERMISSION_COLS.map((c) => c.group))];

interface PermissionsTabProps {
  projectId?: string;
}

export default function PermissionsTab({ projectId: propProjectId }: PermissionsTabProps = {}) {
  const { isPortalAdmin: currentUserIsPortalAdmin, portalRolePerms } = useAuth();
  const { project } = useProject();
  const resolvedProjectId = propProjectId || project?.id;
  const [members, setMembers] = useState<MemberWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState(PERM_GROUPS[0]);
  const { getRolePermission } = usePortalRolePermissions(portalRolePerms);

  useEffect(() => {
    if (!resolvedProjectId) return;
    loadData();
  }, [resolvedProjectId]);

  async function loadData() {
    if (!resolvedProjectId) return;

    const [membersRes, permsRes] = await Promise.all([
      supabase
        .from("project_members")
        .select("id, user_id, project_role, profiles(*)")
        .eq("project_id", resolvedProjectId),
      supabase
        .from("user_permissions")
        .select("*")
        .eq("project_id", resolvedProjectId),
    ]);

    const permsMap = new Map<string, UserPermission>();
    for (const p of (permsRes.data || []) as UserPermission[]) {
      permsMap.set(p.user_id, p);
    }

    const mapped: MemberWithPermissions[] = (membersRes.data || []).map(
      (m: Record<string, unknown>) => ({
        memberId: m.id as string,
        userId: m.user_id as string,
        profile: m.profiles as Profile,
        projectRole: m.project_role as ProjectRoleType | null,
        permissions: permsMap.get(m.user_id as string) || null,
      })
    );

    const isAdminRole = (m: MemberWithPermissions) =>
      m.projectRole === ROLES.ADMIN || m.projectRole === ROLES.PROJECT_ADMIN;
    mapped.sort((a, b) => {
      const aIsAdmin = isAdminRole(a);
      const bIsAdmin = isAdminRole(b);
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return (a.profile?.last_name || "").localeCompare(b.profile?.last_name || "");
    });

    setMembers(mapped);
    setLoading(false);
  }

  function isLockedAdmin(m: MemberWithPermissions): boolean {
    // Роль «Администратор» (портала) — всегда заблокирована
    if (m.projectRole === ROLES.ADMIN) return true;
    // Роль «Администратор проекта» — заблокирована, если текущий пользователь не портальный админ
    if (m.projectRole === ROLES.PROJECT_ADMIN && !currentUserIsPortalAdmin) return true;
    return false;
  }

  const REQUEST_KEYS: PermissionKey[] = [
    "can_view_requests", "can_create_requests", "can_execute_requests",
    "can_edit_requests", "can_add_request_files", "can_delete_requests",
    "can_change_request_status",
  ];

  function getEffectiveValue(m: MemberWithPermissions, key: PermissionKey): boolean {
    if (m.projectRole === ROLES.ADMIN) return true;
    if (m.projectRole === ROLES.PROJECT_ADMIN) {
      return key !== "can_change_status";
    }
    // Индивидуальное переопределение
    if (m.permissions) {
      const val = m.permissions[key];
      if (val !== undefined && val !== null) return val as boolean;
    }
    // Разрешения заявок — только индивидуальные, без fallback на роль
    if (REQUEST_KEYS.includes(key)) return false;
    // Портальные настройки роли
    if (m.projectRole) {
      return getRolePermission(m.projectRole, key);
    }
    return false;
  }

  async function togglePermission(m: MemberWithPermissions, key: PermissionKey) {
    if (!resolvedProjectId || isLockedAdmin(m)) return;
    setSaving(m.userId);

    const current = getEffectiveValue(m, key);

    if (m.permissions) {
      await supabase
        .from("user_permissions")
        .update({ [key]: !current })
        .eq("project_id", resolvedProjectId)
        .eq("user_id", m.userId);
    } else {
      await supabase.from("user_permissions").insert({
        project_id: resolvedProjectId,
        user_id: m.userId,
        [key]: !current,
      });
    }

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
        Загрузка разрешений...
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        В проекте нет участников. Добавьте участников на вкладке «Доступ к проекту».
      </div>
    );
  }

  return (
    <div className="ds-card">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>
          Разрешения участников ({members.length})
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--ds-text-faint)" }}>
          Переключатели переопределяют дефолтные разрешения роли. Наведите на название разрешения для подсказки.
        </p>
      </div>

      {/* Вкладки групп */}
      <div className="flex flex-wrap gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}>
        {PERM_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeGroup === g ? "ds-btn shadow-sm" : "hover:bg-white/50"
            }`}
            style={activeGroup !== g ? { color: "var(--ds-text-muted)" } : undefined}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
              <th className="text-left px-3 py-2 font-medium sticky left-0 min-w-[180px]" style={{ color: "var(--ds-text-muted)", background: "var(--ds-surface-sunken)", borderRight: "1px solid var(--ds-border)" }}>Участник</th>
              <th className="text-left px-3 py-2 font-medium min-w-[140px]" style={{ color: "var(--ds-text-muted)" }}>Роль</th>
              {PERMISSION_COLS.filter((c) => c.group === activeGroup).map((col) => (
                <th
                  key={col.key}
                  className="text-center px-2 py-2 font-medium min-w-[70px] cursor-help"
                  style={{ color: "var(--ds-text-muted)" }}
                  title={`${col.group}: ${col.label}`}
                >
                  <span style={{ borderBottom: "1px dotted var(--ds-text-faint)" }}>{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const locked = isLockedAdmin(m);
              const isAdminBadge = m.projectRole === ROLES.ADMIN || m.projectRole === ROLES.PROJECT_ADMIN;
              const isBusy = saving === m.userId;

              return (
                <tr key={m.userId} style={{ borderBottom: "1px solid var(--ds-border)" }}>
                  <td className="px-4 py-1.5 sticky left-0" style={{ background: "var(--ds-surface)", borderRight: "1px solid var(--ds-border)" }}>
                    <div className="font-medium text-xs" style={{ color: "var(--ds-text)" }}>{fullName(m.profile)}</div>
                    <div className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>{m.profile?.organization}</div>
                  </td>
                  <td className="px-3 py-1.5">
                    {m.projectRole ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={isAdminBadge
                          ? { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" }
                          : { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                        }
                      >
                        {m.projectRole}
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>Без роли</span>
                    )}
                  </td>
                  {PERMISSION_COLS.filter((c) => c.group === activeGroup).map((col) => {
                    const isOn = getEffectiveValue(m, col.key);
                    return (
                      <td key={col.key} className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => togglePermission(m, col.key)}
                          disabled={locked || isBusy}
                          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${
                            isBusy ? "opacity-50" : ""
                          }`}
                          style={isOn ? { background: "var(--ds-accent)" } : { background: "var(--ds-border-strong)" }}
                          title={locked ? "Разрешения заблокированы для этой роли" : col.label}
                        >
                          <span
                            className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                              isOn ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
