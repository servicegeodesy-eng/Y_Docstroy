import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { Profile } from "@/types";
import { shortName } from "@/lib/utils";

type PortalRole = "Администратор" | "Администратор проекта" | "Подрядчик" | "Генподрядчик" | "Заказчик" | "Строительный контроль" | "Авторский надзор";
type PortalGroup = "Геодезист" | "Инженер ПТО" | "Инженер" | "Участник" | "Руководитель" | "Производитель работ";
const PORTAL_ROLES: PortalRole[] = ["Администратор", "Администратор проекта", "Подрядчик", "Генподрядчик", "Заказчик", "Строительный контроль", "Авторский надзор"];
const PORTAL_GROUPS: PortalGroup[] = ["Геодезист", "Инженер ПТО", "Инженер", "Участник", "Руководитель", "Производитель работ"];

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: string;
  portal_role: PortalRole | null;
  portal_group: PortalGroup | null;
  profiles: Profile;
}

export default function UsersTab() {
  const { project } = useProject();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<PortalRole | "">("");
  const [editGroup, setEditGroup] = useState<PortalGroup | "">("");

  useEffect(() => {
    if (!project) return;
    loadMembers();
  }, [project]);

  async function loadMembers() {
    if (!project) return;
    const { data } = await supabase
      .from("project_members")
      .select("id, user_id, role, portal_role, portal_group, profiles(*)")
      .eq("project_id", project.id);
    if (data) setMembers(data as unknown as MemberWithProfile[]);
    setLoading(false);
  }

  function startEdit(member: MemberWithProfile) {
    setEditingId(member.id);
    setEditRole(member.portal_role || "");
    setEditGroup(member.portal_group || "");
  }

  async function saveEdit(memberId: string) {
    await supabase
      .from("project_members")
      .update({
        portal_role: editRole || null,
        portal_group: editGroup || null,
      })
      .eq("id", memberId);
    setEditingId(null);
    loadMembers();
  }

  async function removeMember(memberId: string, name: string) {
    if (!confirm(`Удалить участника "${name}" из проекта?`)) return;
    await supabase.from("project_members").delete().eq("id", memberId);
    loadMembers();
  }

  function fullName(p: Profile) {
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
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>
          Участники проекта ({members.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="ds-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Организация</th>
              <th>Роль</th>
              <th>Группа</th>
              <th className="w-32">Действия</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">
                  {fullName(m.profiles)}
                </td>
                <td style={{ color: "var(--ds-text-muted)" }}>{m.profiles.organization}</td>
                <td>
                  {editingId === m.id ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as PortalRole)}
                      className="ds-input text-xs"
                    >
                      <option value="">Не указана</option>
                      {PORTAL_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={m.portal_role
                        ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                        : { color: "var(--ds-text-faint)" }
                      }>
                      {m.portal_role || "—"}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === m.id ? (
                    <select
                      value={editGroup}
                      onChange={(e) => setEditGroup(e.target.value as PortalGroup)}
                      className="ds-input text-xs"
                    >
                      <option value="">Не указана</option>
                      {PORTAL_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={m.portal_group
                        ? { background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" }
                        : { color: "var(--ds-text-faint)" }
                      }>
                      {m.portal_group || "—"}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === m.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => saveEdit(m.id)}
                        className="ds-btn px-2 py-1 text-xs"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="ds-btn-secondary px-2 py-1 text-xs"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="ds-icon-btn"
                        title="Редактировать"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeMember(m.id, fullName(m.profiles))}
                        className="ds-icon-btn"
                        title="Удалить"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
                  Нет участников в проекте
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
