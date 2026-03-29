import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useProject, ProjectProvider } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { isGeoMode } from "@/lib/geoMode";
import Sidebar from "./Sidebar";
import SubscriptionBanner from "./SubscriptionBanner";
import { AppLogo } from "./GeoLogo";
import ProjectSwitcher from "./ProjectSwitcher";
import NotificationBell from "./NotificationBell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useCallback, useRef } from "react";
import { shortName, type ProfileShort } from "@/lib/utils";
import { useBadgeCounts, type BadgeCounts } from "@/hooks/useBadgeCounts";

function WorkspaceContent() {
  const { user } = useAuth();
  const { project, loading, loadError, isProjectAdmin, hasPermission } = useProject();
  const { isMobile, toggleMode, menuOpen, setMenuOpen } = useMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const [profile, setProfile] = useState<ProfileShort | null>(null);
  const [hasNewTasks, setHasNewTasks] = useState(false);
  const prevNotifCount = useRef<number | null>(null);

  const geo = isGeoMode();
  const canSeeTasks = geo ? false : hasPermission("can_view_tasks");
  const badges = useBadgeCounts(projectId);

  // Когда count уведомлений растёт — показываем кружок на задачах
  const handleNotifCountChange = useCallback((count: number) => {
    if (prevNotifCount.current !== null && count > prevNotifCount.current) {
      setHasNewTasks(true);
    }
    prevNotifCount.current = count;
  }, []);

  // Когда пользователь на странице задач — гасим кружок
  useEffect(() => {
    if (location.pathname.endsWith("/tasks")) {
      setHasNewTasks(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("last_name, first_name, middle_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors" style={{ background: "var(--ds-surface-sunken)" }}>
        <div className="text-center">
          <div className="ds-spinner mx-auto mb-3" />
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors" style={{ background: "var(--ds-surface-sunken)" }}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "#ef4444" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>{loadError}</p>
          <p className="text-sm mb-4" style={{ color: "var(--ds-text-faint)" }}>Проверьте подключение к интернету</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => window.location.reload()} className="ds-btn text-sm font-medium">
              Обновить страницу
            </button>
            <button onClick={() => navigate("/projects")} className="ds-btn-secondary text-sm font-medium">
              К проектам
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors" style={{ background: "var(--ds-surface-sunken)" }}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mb-4" style={{ color: "var(--ds-text-muted)" }}>Проект не найден</p>
          <button onClick={() => navigate("/projects")} className="ds-icon-btn text-sm font-medium">
            Вернуться к проектам
          </button>
        </div>
      </div>
    );
  }


  const displayName = shortName(profile);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Если серверный signOut не удался — очищаем локально
      await supabase.auth.signOut({ scope: "local" });
    }
    navigate("/auth");
  }

  const canViewRequests = hasPermission("can_view_requests");

  // Geo-режим: нет доступа к заявкам — показать заглушку
  if (geo && !canViewRequests) {
    return (
      <div className="h-screen flex overflow-hidden transition-colors" style={{ background: "var(--ds-surface-sunken)" }}>
        <div className="flex-1 flex flex-col min-w-0">
          <header data-print-hide className="ds-header px-6 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <h1 className="font-semibold truncate text-base" style={{ color: "var(--ds-text)" }}>
                  {project.name}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{displayName}</span>
              <button onClick={handleLogout} className="ds-icon-btn text-sm" title="Выйти">Выйти</button>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="mb-2 font-medium" style={{ color: "var(--ds-text)" }}>Нет доступа к заявкам</p>
              <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Обратитесь к администратору проекта для получения доступа.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden print:bg-white transition-colors" style={{ background: "var(--ds-surface-sunken)" }}>
      {/* Десктоп сайдбар — скрыт в geo-режиме */}
      {!geo && !isMobile && <Sidebar isAdmin={isProjectAdmin} badges={badges} />}

      {/* Мобильное меню-оверлей — скрыт в geo-режиме */}
      {!geo && isMobile && menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full">
            <Sidebar isAdmin={isProjectAdmin} mobileMode onNavigate={() => setMenuOpen(false)} badges={badges} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header data-print-hide className={`ds-header ${isMobile ? "flex-col !items-stretch gap-1 px-3 py-2" : "px-6 py-3"}`}>
          {geo && !isMobile ? (
            /* ═══ GEO HEADER — DESKTOP ═══ */
            <>
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-1 shrink-0" style={{ minWidth: 150 }}>
                  <ShareInstallButton />
                  <AppLogo size={28} />
                </div>
                <div className="flex items-center gap-2">
                  <ProjectSwitcher currentName={project.name} />
                  <button
                    onClick={() => navigate(`/projects/${projectId}/requests`)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname.endsWith("/requests") ? "bg-[var(--ds-accent)] text-white" : "hover:bg-[var(--ds-surface-elevated)]"
                    }`}
                    style={!location.pathname.endsWith("/requests") ? { color: "var(--ds-text)" } : undefined}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span>Заявки</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <NotificationBell onCountChange={handleNotifCountChange} />
                  <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{displayName}</span>
                  <button onClick={handleLogout} className="ds-icon-btn text-sm" title="Выйти">Выйти</button>
                </div>
              </div>
            </>
          ) : geo && isMobile ? (
            /* ═══ GEO HEADER — MOBILE (2 строки) ═══ */
            <>
              {/* Строка 1: лого + название ЖК с переключателем (название прижато вправо) */}
              <div className="flex items-center gap-2 w-full">
                <ShareInstallButton />
                <AppLogo size={24} />
                <div className="flex-1" />
                <ProjectSwitcher currentName={project.name} compact alignRight />
              </div>
              {/* Строка 2: заявки + задачи + иконки */}
              <div className="flex items-center justify-between w-full -mt-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/projects/${projectId}/requests`)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname.endsWith("/requests") ? "bg-[var(--ds-accent)] text-white" : "hover:bg-[var(--ds-surface-elevated)]"
                    }`}
                    style={!location.pathname.endsWith("/requests") ? { color: "var(--ds-text)" } : undefined}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span>Заявки</span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <NotificationBell onCountChange={handleNotifCountChange} />
                  <button onClick={handleLogout} className="ds-icon-btn" title="Выйти">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
                </div>
              </div>
            </>
          ) : isMobile ? (
            /* ═══ NORMAL HEADER — MOBILE (2 строки) ═══ */
            <>
              {/* Строка 1: меню + название ЖК */}
              <div className="flex items-center gap-2 w-full">
                <button onClick={() => setMenuOpen(true)} className="ds-icon-btn shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <ProjectSwitcher currentName={project.name} description={project.description} compact />
              </div>
              {/* Строка 2: задачи + иконки */}
              <div className="flex items-center justify-between w-full -mt-1">
                <div className="flex items-center gap-1">
                  {canSeeTasks && (
                    <button
                      onClick={() => navigate(`/projects/${projectId}/tasks`)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        location.pathname.endsWith("/tasks") ? "bg-[var(--ds-accent)] text-white" : "hover:bg-[var(--ds-surface-elevated)]"
                      }`}
                      style={!location.pathname.endsWith("/tasks") ? { color: "var(--ds-text)" } : undefined}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      <span>Задачи</span>
                      {hasNewTasks && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <NotificationBell onCountChange={handleNotifCountChange} />
                  <button onClick={toggleMode} className="ds-icon-btn" title="Десктоп-версия">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </button>
                  <button onClick={handleLogout} className="ds-icon-btn" title="Выйти">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ═══ NORMAL HEADER — DESKTOP ═══ */
            <>
              <div className="flex items-center gap-2 min-w-0">
                <ProjectSwitcher currentName={project.name} description={project.description} />
              </div>

              <div className="flex items-center gap-2">
                {canSeeTasks && (
                  <button
                    onClick={() => navigate(`/projects/${projectId}/tasks`)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname.endsWith("/tasks") ? "bg-[var(--ds-accent)] text-white" : "hover:bg-[var(--ds-surface-elevated)]"
                    }`}
                    style={!location.pathname.endsWith("/tasks") ? { color: "var(--ds-text)" } : undefined}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    <span>Задачи</span>
                    {hasNewTasks && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <NotificationBell onCountChange={handleNotifCountChange} />
                <button onClick={toggleMode} className="ds-icon-btn" title="Мобильная версия">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </button>
                <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{displayName}</span>
                <button onClick={handleLogout} className="ds-icon-btn text-sm" title="Выйти">Выйти</button>
              </div>
            </>
          )}
        </header>

        {!geo && <SubscriptionBanner />}

        {/* Content */}
        <main className={`flex-1 flex flex-col min-h-0 overflow-auto ${isMobile ? "p-3" : "p-6"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ShareInstallButton() {
  const [copied, setCopied] = useState(false);
  const installUrl = `${window.location.origin}/install`;
  const geo = isGeoMode();

  const handleShare = async () => {
    if ("ontouchstart" in window && navigator.share) {
      try {
        await navigator.share({ title: geo ? "Служба геодезии" : "DocStroy", text: "Установить приложение", url: installUrl });
      } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  return (
    <button onClick={handleShare} className="ds-icon-btn shrink-0" title={copied ? "Скопировано!" : "Поделиться ссылкой"}>
      {copied ? (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
}

export default function WorkspaceLayout() {
  return (
    <ProjectProvider>
      <WorkspaceContent />
    </ProjectProvider>
  );
}
