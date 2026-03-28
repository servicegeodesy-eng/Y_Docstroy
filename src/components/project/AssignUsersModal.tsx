import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { shortName as shortNameUtil, fullName as fullNameUtil } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { PROJECT_ROLES } from "@/types";

interface ProjectInfo {
  id: string;
  name: string;
}

interface ProfileRow {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  is_portal_admin: boolean;
  organization: string | null;
}

interface MemberRow {
  id: string;
  project_id: string;
  user_id: string;
  project_role: string | null;
}

interface Props {
  projects: ProjectInfo[];
  onClose: () => void;
}

export default function AssignUsersModal({ projects, onClose }: Props) {
  const { isPortalAdmin } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editLastName, setEditLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const availableRoles = isPortalAdmin ? PROJECT_ROLES : PROJECT_ROLES.filter((r) => r !== "Администратор");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [profilesRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("id, last_name, first_name, middle_name, is_portal_admin, organization").order("last_name"),
      supabase.from("project_members").select("id, project_id, user_id, project_role"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    if (membersRes.data) setMembers(membersRes.data as MemberRow[]);
    setLoading(false);
  }

  function fullName(p: ProfileRow) {
    return fullNameUtil(p);
  }

  function shortName(p: ProfileRow) {
    return shortNameUtil(p);
  }

  function getMember(userId: string, projectId: string): MemberRow | undefined {
    return members.find((m) => m.user_id === userId && m.project_id === projectId);
  }

  async function toggleProject(userId: string, projectId: string) {
    setSaving(projectId);
    const existing = getMember(userId, projectId);

    if (existing) {
      await supabase.from("project_members").delete().eq("id", existing.id);
      await supabase.from("user_permissions").delete().eq("project_id", projectId).eq("user_id", userId);
      setMembers((prev) => prev.filter((m) => m.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: userId, role: "member" })
        .select("id, project_id, user_id, project_role")
        .single();
      if (data) {
        setMembers((prev) => [...prev, data as MemberRow]);
      }
    }
    setSaving(null);
  }

  function startEditName(profile: ProfileRow) {
    setEditLastName(profile.last_name);
    setEditingName(true);
  }

  async function saveEditName() {
    if (!selectedUser || !editLastName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ last_name: editLastName.trim() })
      .eq("id", selectedUser.id);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === selectedUser.id ? { ...p, last_name: editLastName.trim() } : p)),
      );
    }
    setSavingName(false);
    setEditingName(false);
  }

  async function changeRole(memberId: string, role: string) {
    setSaving(memberId);
    const member = members.find((m) => m.id === memberId);
    const roleChanged = member && (role || null) !== member.project_role;

    await supabase
      .from("project_members")
      .update({ project_role: role || null })
      .eq("id", memberId);

    // При смене роли сбросить индивидуальные разрешения — применятся дефолты новой роли
    if (roleChanged && member) {
      await supabase
        .from("user_permissions")
        .delete()
        .eq("project_id", member.project_id)
        .eq("user_id", member.user_id);
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, project_role: role || null } : m)),
    );
    setSaving(null);
  }

  async function resetPassword(profile: ProfileRow) {
    if (!confirm(`Сбросить пароль пользователя ${fullName(profile)}?\n\nБудет сгенерирован временный пароль.`)) return;
    setResettingPassword(true);
    setResetResult(null);

    const { data, error } = await supabase.rpc("request_password_reset", { target_user_id: profile.id });
    if (error) {
      alert("Ошибка сброса пароля: " + error.message);
      setResettingPassword(false);
      return;
    }

    const result = data as { success?: boolean; error?: string; temp_password?: string } | null;
    if (result && !result.success) {
      alert(result.error || "Неизвестная ошибка");
      setResettingPassword(false);
      return;
    }

    if (result?.temp_password) {
      setResetResult({ userId: profile.id, password: result.temp_password });
    } else {
      alert("Пароль сброшен. Уведомление отправлено на почту администратора.");
    }
    setResettingPassword(false);
  }

  async function deleteUser(profile: ProfileRow) {
    if (userProjectCount(profile.id) > 0 || profile.is_portal_admin) return;
    if (!confirm(`Удалить пользователя ${fullName(profile)}?\n\nЭто действие необратимо — будут удалены профиль и учётная запись.`)) return;
    setSaving(profile.id);
    const { error } = await supabase.rpc("delete_user_completely", { target_user_id: profile.id });
    if (error) {
      alert("Ошибка удаления: " + error.message);
    } else {
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      if (selectedUserId === profile.id) setSelectedUserId(null);
    }
    setSaving(null);
  }

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return fullName(p).toLowerCase().includes(q) || (p.organization || "").toLowerCase().includes(q);
  });

  const userProjectCount = (userId: string) => members.filter((m) => m.user_id === userId).length;
  const selectedUser = profiles.find((p) => p.id === selectedUserId);

  // Сортировка: 0 проектов вверху, потом по алфавиту
  const sorted = [...filtered].sort((a, b) => {
    const aCount = userProjectCount(a.id);
    const bCount = userProjectCount(b.id);
    if (aCount === 0 && bCount > 0) return -1;
    if (aCount > 0 && bCount === 0) return 1;
    return (a.last_name || "").localeCompare(b.last_name || "", "ru");
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--ds-surface)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Назначение пользователей на проекты</h2>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Left panel — users */}
            <div className="w-1/2 flex flex-col" style={{ borderRight: "1px solid var(--ds-border)" }}>
              <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)" }}>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по ФИО или email..."
                    className="ds-input w-full pl-10"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sorted.map((p, i) => {
                  const count = userProjectCount(p.id);
                  const prevCount = i > 0 ? userProjectCount(sorted[i - 1].id) : -1;
                  const showDivider = i > 0 && prevCount === 0 && count > 0;
                  return (
                    <div key={p.id}>
                      {i === 0 && count === 0 && (
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide" style={{ background: "color-mix(in srgb, #f59e0b 8%, var(--ds-surface))", color: "#f59e0b" }}>
                          Без проектов
                        </div>
                      )}
                      {showDivider && (
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                          Назначены в проекты
                        </div>
                      )}
                      <div
                        className="w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        style={selectedUserId === p.id
                          ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", borderLeft: "2px solid var(--ds-accent)" }
                          : { borderBottom: "1px solid var(--ds-border)" }
                        }
                        onClick={() => { setSelectedUserId(p.id); setResetResult(null); }}
                      >
                        <span className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>{shortName(p)}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-medium" style={{ color: count === 0 ? "#f59e0b" : "var(--ds-accent)" }}>
                            {count} {count === 1 ? "проект" : count < 5 && count > 0 ? "проекта" : "проектов"}
                          </span>
                          {count === 0 && isPortalAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteUser(p); }}
                              disabled={saving === p.id}
                              className="px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors"
                              style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))" }}
                              title="Удалить пользователя"
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sorted.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Пользователи не найдены</div>
                )}
              </div>
            </div>

            {/* Right panel — projects */}
            <div className="w-1/2 flex flex-col">
              {selectedUser ? (
                <>
                  <div className="px-4 py-3 shrink-0" style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="ds-input flex-1 px-2 py-1 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditName();
                            if (e.key === "Escape") setEditingName(false);
                          }}
                        />
                        <button
                          onClick={saveEditName}
                          disabled={savingName || !editLastName.trim()}
                          className="ds-btn px-2 py-1 text-xs"
                        >
                          {savingName ? "..." : "Сохранить"}
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="ds-btn-secondary px-2 py-1 text-xs"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{fullName(selectedUser)}</div>
                        <button
                          onClick={() => startEditName(selectedUser)}
                          className="ds-icon-btn p-0.5"
                          title="Редактировать ФИО"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{selectedUser.organization}</span>
                      {isPortalAdmin && (
                        <button
                          onClick={() => resetPassword(selectedUser)}
                          disabled={resettingPassword}
                          className="px-2 py-0.5 text-[10px] rounded font-medium transition-colors"
                          style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}
                        >
                          {resettingPassword ? "Сброс..." : "Сбросить пароль"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Результат сброса пароля */}
                  {resetResult && resetResult.userId === selectedUser.id && (
                    <div className="px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)", background: "color-mix(in srgb, #22c55e 8%, var(--ds-surface))" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium" style={{ color: "var(--ds-text)" }}>Временный пароль:</p>
                          <code className="text-base font-mono tracking-wider px-2 py-0.5 rounded inline-block mt-0.5"
                            style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text)" }}>
                            {resetResult.password}
                          </code>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
                            Сообщите пароль пользователю. После входа потребуется задать новый.
                          </p>
                        </div>
                        <button onClick={() => setResetResult(null)} className="ds-btn-secondary px-2 py-0.5 text-xs shrink-0">
                          Закрыть
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {projects.map((proj) => {
                      const member = getMember(selectedUser.id, proj.id);
                      const isMember = !!member;
                      const isBusy = saving === proj.id;
                      return (
                        <div
                          key={proj.id}
                          className={`flex items-center gap-3 px-4 py-2 ${isBusy ? "opacity-50" : ""}`}
                          style={{ borderBottom: "1px solid var(--ds-border)" }}
                        >
                          <button
                            onClick={() => toggleProject(selectedUser.id, proj.id)}
                            disabled={isBusy}
                            className="w-5 h-5 rounded border-2 shrink-0 inline-flex items-center justify-center transition-colors"
                            style={isMember
                              ? { background: "var(--ds-accent)", borderColor: "var(--ds-accent)", color: "white" }
                              : { borderColor: "var(--ds-border-strong)" }
                            }
                          >
                            {isMember && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{ color: "var(--ds-text)" }}>{proj.name}</div>
                            {isMember && (
                              <select
                                value={member.project_role || ""}
                                onChange={(e) => changeRole(member.id, e.target.value)}
                                disabled={saving === member.id}
                                className="ds-input mt-0.5 w-full px-2 py-0.5 text-xs"
                              >
                                <option value="">Без роли</option>
                                {availableRoles.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {projects.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет проектов</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p>Выберите пользователя слева</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--ds-border)" }}>
          <button onClick={onClose} className="ds-btn-secondary">
            Закрыть
          </button>
        </div>
    </div>
  );
}
