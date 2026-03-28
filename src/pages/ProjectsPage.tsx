import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { useTheme } from "@/lib/ThemeContext";
import { isGeoMode } from "@/lib/geoMode";
import ProjectModal from "@/components/project/ProjectModal";
import AssignUsersModal from "@/components/project/AssignUsersModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PermissionsTab from "@/components/admin/PermissionsTab";
import RolePermissionsEditor from "@/components/admin/RolePermissionsEditor";
import CellPermissionsPage from "@/components/admin/CellPermissionsPage";
import ProfileModal from "@/components/ProfileModal";
import { AppLogo } from "@/components/layout/GeoLogo";
import { shortName, type ProfileShort } from "@/lib/utils";
import { ROLES } from "@/types";

interface Project {
  id: string;
  name: string;
  description: string | null;
  role: string;
}

type Profile = ProfileShort;

const ARCHIVE_KEY = "archived_project_ids";

function getArchivedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveArchivedIds(ids: Set<string>) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...ids]));
}

export default function ProjectsPage() {
  const { user, isPortalAdmin, isGlobalReader, projectMemberships, profileName } = useAuth();
  const { isMobile } = useMobile();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(profileName);
  const [showAssignUsers, setShowAssignUsers] = useState(false);
  const [permissionsProject, setPermissionsProject] = useState<Project | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showRolePerms, setShowRolePerms] = useState(false);
  const [showCellPerms, setShowCellPerms] = useState(false);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(getArchivedIds);
  const [showArchive, setShowArchive] = useState(false);
  const [unreadProjects, setUnreadProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profileName) setProfile(profileName);
  }, [profileName]);

  // Загружаем проекты с непрочитанными уведомлениями (только факт наличия, без подсчёта)
  useEffect(() => {
    if (!user) return;
    async function loadUnread() {
      const { data } = await supabase
        .from("notifications")
        .select("url")
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (!data) return;
      const ids = new Set<string>();
      for (const n of data) {
        const match = n.url.match(/\/projects\/([^/]+)/);
        if (match) ids.add(match[1]);
      }
      setUnreadProjects(ids);
    }
    loadUnread();
    const interval = setInterval(loadUnread, isMobile ? 120000 : 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("last_name, first_name, middle_name")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setProfile(data);
  }

  useEffect(() => {
    if (!user) return;
    if (isPortalAdmin || isGlobalReader) {
      loadProjectsFromDb();
    } else {
      // Обычные пользователи — используем данные из AuthContext (уже загружены)
      const mapped = projectMemberships.map((m) => ({
        id: m.project_id,
        name: m.project_name,
        description: m.project_description,
        role: (m.project_role === ROLES.PROJECT_ADMIN || m.project_role === ROLES.ADMIN) ? "admin" : m.role,
      }));
      setProjects(mapped);
      setLoading(false);
    }
  }, [user, isPortalAdmin, isGlobalReader, projectMemberships]);

  const geo = isGeoMode();

  // Не-админы — сразу переходят к первому проекту (переключение через header)
  // Админы с 1 проектом — тоже сразу переходят
  useEffect(() => {
    if (loading || projects.length === 0) return;
    if (!isPortalAdmin || projects.length === 1) {
      const defaultPage = geo ? "requests" : "registry";
      navigate(`/projects/${projects[0].id}/${defaultPage}`, { replace: true });
    }
  }, [loading, projects, navigate, geo, isPortalAdmin]);

  async function loadProjectsFromDb() {
    const { data } = await supabase
      .from("projects")
      .select("id, name, description")
      .order("created_at", { ascending: false });
    if (data) {
      setProjects(
        data.map((p) => ({
          ...p,
          role: isPortalAdmin ? "admin" : "reader",
        }))
      );
    }
    setLoading(false);
  }

  async function handleCreate(name: string, description: string) {
    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user!.id)
      .maybeSingle();

    if (!profileCheck) {
      throw new Error(
        "Ваш профиль не найден в базе данных. Пожалуйста, выйдите и зарегистрируйтесь заново."
      );
    }

    const projectId = crypto.randomUUID();

    const { error } = await supabase.rpc("create_project_with_owner", {
      p_project_id: projectId,
      p_name: name,
      p_description: description || null,
    });
    if (error) throw new Error(error.message);
    await loadProjectsFromDb();
  }

  async function handleEdit(name: string, description: string) {
    if (!editProject) return;
    const { error } = await supabase
      .from("projects")
      .update({ name, description: description || null })
      .eq("id", editProject.id);
    if (error) throw new Error(error.message);
    setEditProject(null);
    await loadProjectsFromDb();
  }

  async function handleDelete() {
    if (!deleteProject) return;
    setDeleting(true);
    await supabase.from("projects").delete().eq("id", deleteProject.id);
    setDeleteProject(null);
    setDeleting(false);
    const next = new Set(archivedIds);
    next.delete(deleteProject.id);
    setArchivedIds(next);
    saveArchivedIds(next);
    await loadProjectsFromDb();
  }

  function archiveProject(id: string) {
    const next = new Set(archivedIds);
    next.add(id);
    setArchivedIds(next);
    saveArchivedIds(next);
  }

  function restoreProject(id: string) {
    const next = new Set(archivedIds);
    next.delete(id);
    setArchivedIds(next);
    saveArchivedIds(next);
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Если серверный signOut не удался — очищаем локально
      await supabase.auth.signOut({ scope: "local" });
    }
    navigate("/auth");
  }

  const displayName = shortName(profile);

  const activeProjects = projects.filter((p) => !archivedIds.has(p.id));
  const archivedProjects = projects.filter((p) => archivedIds.has(p.id));

  return (
    <div className="min-h-screen bg-[var(--ds-surface-sunken)] transition-colors">
      {/* Header */}
      <header className="ds-header px-4 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2">
          <AppLogo size={36} />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Переключатель темы */}
            <button
              onClick={toggleTheme}
              className="ds-icon-btn shrink-0"
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowProfile(true)}
              className="text-sm transition-colors flex items-center gap-1.5 min-w-0 shrink"
              style={{ color: "var(--ds-text-muted)" }}
              title="Личный кабинет"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{displayName}</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-sm transition-colors shrink-0"
              style={{ color: "var(--ds-text-faint)" }}
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="ds-spinner mx-auto mb-3" />
              <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Загрузка проектов...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold" style={{ color: "var(--ds-text)" }}>
                  Выбор проекта
                </h2>
                <p className="text-sm mt-1 hidden sm:block" style={{ color: "var(--ds-text-muted)" }}>
                  Выберите проект для работы
                </p>
              </div>
              {isPortalAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowRolePerms(true)}
                    className="ds-btn-secondary flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="hidden sm:inline">Разрешения ролей</span>
                    <span className="sm:hidden">Роли</span>
                  </button>
                  <button
                    onClick={() => setShowCellPerms(true)}
                    className="ds-btn-secondary flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="hidden sm:inline">Разрешения ячеек</span>
                    <span className="sm:hidden">Ячейки</span>
                  </button>
                  <button
                    onClick={() => setShowAssignUsers(true)}
                    className="ds-btn-secondary flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="hidden sm:inline">Назначить пользователей</span>
                    <span className="sm:hidden">Пользователи</span>
                  </button>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="ds-btn text-xs sm:text-sm sm:px-3"
                    title="Новый проект"
                  >
                    <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">+ Новый проект</span>
                  </button>
                </div>
              )}
            </div>

            {activeProjects.length === 0 && archivedProjects.length === 0 ? (
              <div className="ds-card p-8 sm:p-16 text-center">
                <div className="mb-4 flex justify-center">
                  <AppLogo size={64} />
                </div>
                <h3 className="text-lg font-medium mb-2" style={{ color: "var(--ds-text)" }}>
                  Нет проектов
                </h3>
                {isPortalAdmin ? (
                  <>
                    <p className="text-sm mb-6" style={{ color: "var(--ds-text-muted)" }}>
                      Создайте первый проект для начала работы с порталом.
                    </p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="ds-btn"
                    >
                      Создать проект
                    </button>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
                    Для отображения проектов <span className="font-bold" style={{ color: "var(--ds-text)" }}>ОБРАТИТЕСЬ К АДМИНИСТРАТОРУ</span>
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Активные проекты */}
                {activeProjects.length === 0 ? (
                  <div className="ds-card p-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
                    Все проекты перемещены в архив
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {activeProjects.map((project) => (
                      <div
                        key={project.id}
                        className="ds-card group relative"
                      >
                        {unreadProjects.has(project.id) && (
                          <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-red-500 z-10 shadow" />
                        )}
                        <Link
                          to={`/projects/${project.id}/registry`}
                          className="block px-4 py-3"
                        >
                          <h3 className="font-semibold text-sm transition-colors" style={{ color: "var(--ds-text)" }}>
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="text-xs line-clamp-2 mt-1" style={{ color: "var(--ds-text-muted)" }}>
                              {project.description}
                            </p>
                          )}
                        </Link>
                        {isPortalAdmin && (
                          <div className="absolute top-2 right-2 flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setPermissionsProject(project);
                              }}
                              className="ds-icon-btn !p-1.5"
                              title="Разрешения"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setEditProject(project);
                              }}
                              className="ds-icon-btn !p-1.5"
                              title="Редактировать"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                archiveProject(project.id);
                              }}
                              className="ds-icon-btn !p-1.5"
                              title="В архив"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Архив */}
                {archivedProjects.length > 0 && (
                  <div className="mt-8">
                    <button
                      onClick={() => setShowArchive(!showArchive)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors mb-3"
                      style={{ color: "var(--ds-text-muted)" }}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${showArchive ? "rotate-90" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Архив ({archivedProjects.length})
                    </button>

                    {showArchive && (
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {archivedProjects.map((project) => (
                          <div
                            key={project.id}
                            className="ds-card opacity-70 group relative"
                          >
                            <Link
                              to={`/projects/${project.id}/registry`}
                              className="block px-4 py-3"
                            >
                              <h3 className="font-semibold text-sm transition-colors" style={{ color: "var(--ds-text-muted)" }}>
                                {project.name}
                              </h3>
                              {project.description && (
                                <p className="text-xs line-clamp-2 mt-1" style={{ color: "var(--ds-text-faint)" }}>
                                  {project.description}
                                </p>
                              )}
                            </Link>
                            {isPortalAdmin && (
                              <div className="absolute top-2 right-2 flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    restoreProject(project.id);
                                  }}
                                  className="ds-icon-btn !p-1.5"
                                  title="Восстановить из архива"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setDeleteProject(project);
                                  }}
                                  className="ds-icon-btn !p-1.5"
                                  title="Удалить навсегда"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <ProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />
      {editProject && (
        <ProjectModal
          open
          onClose={() => setEditProject(null)}
          onSave={handleEdit}
          initial={{
            name: editProject.name,
            description: editProject.description ?? "",
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDelete}
        title="Удалить проект"
        message={`Вы уверены, что хотите удалить проект «${deleteProject?.name}»? Все данные будут удалены безвозвратно.`}
        loading={deleting}
      />
      {showAssignUsers && (
        <AssignUsersModal
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setShowAssignUsers(false)}
        />
      )}
      {permissionsProject && (
        <div className="fixed inset-0 z-50 flex flex-col transition-colors" style={{ background: "var(--ds-surface)" }}>
          <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)" }}>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>
                Разрешения — {permissionsProject.name}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
                Индивидуальные разрешения участников проекта. Переопределяют дефолтные разрешения роли.
              </p>
            </div>
            <button
              onClick={() => setPermissionsProject(null)}
              className="ds-icon-btn"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <PermissionsTab projectId={permissionsProject.id} />
          </div>
        </div>
      )}
      {showProfile && (
        <ProfileModal onClose={() => { setShowProfile(false); loadProfile(); }} />
      )}
      {showRolePerms && (
        <RolePermissionsEditor onClose={() => setShowRolePerms(false)} />
      )}
      {showCellPerms && (
        <CellPermissionsPage onClose={() => setShowCellPerms(false)} />
      )}
    </div>
  );
}
