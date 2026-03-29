import { useState, useCallback } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useProject } from "@/lib/ProjectContext";
import { useTheme } from "@/lib/ThemeContext";
import { isGeoMode } from "@/lib/geoMode";
import { usePwaInstall } from "@/lib/usePwaInstall";
import type { BadgeCounts } from "@/hooks/useBadgeCounts";

interface SidebarProps {
  isAdmin: boolean;
  mobileMode?: boolean;
  onNavigate?: () => void;
  badges?: BadgeCounts;
}

export function DocStroyLogo({ size = 32, iconOnly = false }: { size?: number; iconOnly?: boolean }) {
  const s = "#fff";
  const sw = 1.8;
  const buildingIcon = (
    <g stroke={s} strokeWidth={sw} strokeLinecap="round" fill="none" opacity="0.9">
      {/* Front vertical edges — open strokes */}
      <line x1="14" y1="42" x2="14" y2="16" />
      <line x1="27" y1="42" x2="27" y2="16" />
      {/* Perspective edge to vanishing point */}
      <line x1="27" y1="16" x2="36" y2="20" />
      <line x1="27" y1="42" x2="36" y2="42" />
      {/* Right side vertical */}
      <line x1="36" y1="42" x2="36" y2="20" />
      {/* Front horizontal floor lines */}
      <line x1="14" y1="22" x2="27" y2="22" />
      <line x1="14" y1="28" x2="27" y2="28" />
      <line x1="14" y1="34" x2="27" y2="34" />
      {/* Side perspective floor lines */}
      <line x1="27" y1="22" x2="36" y2="25" opacity="0.5" />
      <line x1="27" y1="28" x2="36" y2="30.5" opacity="0.5" />
      <line x1="27" y1="34" x2="36" y2="35.5" opacity="0.5" />
      {/* Front vertical mullions (window dividers) */}
      <line x1="20.5" y1="16" x2="20.5" y2="42" opacity="0.6" />
      {/* Side vertical mullion */}
      <line x1="31.5" y1="20" x2="31.5" y2="42" opacity="0.35" />
      {/* Roofline accent */}
      <line x1="14" y1="16" x2="27" y2="16" />
    </g>
  );

  if (iconOnly) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0">
        <path d="M8 3H32L42 13V45H8V3Z" fill="#1E3A5F" />
        <path d="M32 3L42 13H32V3Z" fill="#F97316" />
        {buildingIcon}
      </svg>
    );
  }

  return (
    <svg width={size * 3.6} height={size} viewBox="0 0 172 48" fill="none" className="shrink-0">
      {/* Icon */}
      <path d="M8 3H32L42 13V45H8V3Z" fill="#1E3A5F" />
      <path d="M32 3L42 13H32V3Z" fill="#F97316" />
      {buildingIcon}

      {/* Gable roof */}
      <path d="M56 20L100 6L144 20" stroke="#1E3A5F" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Text "Doc" with dark blue outline */}
      <text
        x="76"
        y="38"
        textAnchor="middle"
        fontFamily="'Inter', 'Montserrat', 'Poppins', system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="-0.5"
        fill="#f1f5f9"
        stroke="#1E3A5F"
        strokeWidth="2.2"
        paintOrder="stroke"
      >Doc</text>
      {/* Text "Stroy" */}
      <text
        x="122"
        y="38"
        textAnchor="middle"
        fontFamily="'Inter', 'Montserrat', 'Poppins', system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="-0.5"
        fill="#5B8DB8"
      >Stroy</text>
    </svg>
  );
}

// Группа 1: основные рабочие вкладки (Реестр → Заявки/Обмен файлами/ГРО добавляются отдельно)
const registryItem = {
  path: "registry",
  label: "Реестр",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
};

const groItem = {
  path: "gro",
  label: "ГРО",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={1.5} d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </svg>
  ),
};

const explorerItem = {
  path: "explorer",
  label: "Проводник",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
};

// Группа 2: карта процесса строительства (заменяет План / Шахматка / Фасады / Благоустройство)
const constructionItem = {
  path: "construction",
  label: "Процесс строительства",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </svg>
  ),
};

const requestItem = {
  path: "requests",
  label: "Заявки",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
};

const fileshareItem = {
  path: "fileshare",
  label: "Обмен файлами",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
};

const adminItem = {
  path: "admin",
  label: "Админ",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const STORAGE_KEY = "sidebar_collapsed";

// Компонент красного кружка-бейджа
function Badge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Sidebar({ isAdmin, mobileMode, onNavigate, badges }: SidebarProps) {
  const { projectId } = useParams();
  const { isPortalAdmin } = useAuth();
  const { hasPermission } = useProject();
  const { theme, toggleTheme } = useTheme();
  const { canInstall, install } = usePwaInstall();
  const navigate = useNavigate();
  const canViewRequests = hasPermission("can_view_requests");
  const geo = isGeoMode();
  const [collapsed, setCollapsed] = useState(() => !mobileMode && localStorage.getItem(STORAGE_KEY) === "1");
  const [copied, setCopied] = useState(false);

  const isCollapsed = mobileMode ? false : collapsed;

  const installUrl = `${window.location.origin}/install`;

  const handleShare = useCallback(async () => {
    if (mobileMode && navigator.share) {
      try {
        await navigator.share({
          title: geo ? "Служба геодезии" : "DocStroy",
          text: "Установить приложение",
          url: installUrl,
        });
      } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [installUrl, mobileMode, geo]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function handleLinkClick() {
    if (onNavigate) onNavigate();
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `ds-nav-link ${isCollapsed ? "justify-center" : ""} ${isActive ? "ds-nav-link-active" : ""}`;

  return (
    <aside className={`ds-sidebar ${isCollapsed ? "w-16" : "w-56"} ${mobileMode ? "h-full" : "h-screen sticky top-0"}`}>
      {/* Логотип + управление */}
      <div className="px-3 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--ds-sidebar-border)" }}>
        {isCollapsed ? (
          <DocStroyLogo size={30} iconOnly />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={handleShare}
              className="ds-icon-btn shrink-0 relative"
              title={copied ? "Скопировано!" : "Поделиться ссылкой для установки"}
            >
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
            <DocStroyLogo size={28} />
          </div>
        )}
        {mobileMode ? (
          <button
            onClick={onNavigate}
            className="ds-icon-btn shrink-0"
            title="Закрыть"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="ds-icon-btn shrink-0"
            title={isCollapsed ? "Развернуть" : "Свернуть"}
          >
            <svg className={`w-4 h-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Кнопка «К проектам» в мобильном режиме */}
      {mobileMode && (
        <button
          onClick={() => { navigate("/projects"); handleLinkClick(); }}
          className="ds-nav-link mt-2"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span>К проектам</span>
        </button>
      )}

      <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
        {/* Реестр */}
        {!geo && (
          <NavLink
            to={`/projects/${projectId}/${registryItem.path}`}
            className={linkClass}
            title={isCollapsed ? registryItem.label : undefined}
            onClick={handleLinkClick}
          >
            <span className="relative shrink-0">
              {registryItem.icon}
              <Badge count={badges?.registry} />
            </span>
            {!isCollapsed && <span className="truncate">{registryItem.label}</span>}
          </NavLink>
        )}

        {/* Заявки */}
        {canViewRequests && (
          <NavLink
            to={`/projects/${projectId}/${requestItem.path}`}
            className={linkClass}
            title={isCollapsed ? requestItem.label : undefined}
            onClick={handleLinkClick}
          >
            <span className="relative shrink-0">
              {requestItem.icon}
              <Badge count={badges?.requests} />
            </span>
            {!isCollapsed && <span className="truncate">{requestItem.label}</span>}
          </NavLink>
        )}

        {/* Обмен файлами */}
        {!geo && (
          <NavLink
            to={`/projects/${projectId}/${fileshareItem.path}`}
            className={linkClass}
            title={isCollapsed ? fileshareItem.label : undefined}
            onClick={handleLinkClick}
          >
            <span className="relative shrink-0">
              {fileshareItem.icon}
              <Badge count={badges?.fileshare} />
            </span>
            {!isCollapsed && <span className="truncate">{fileshareItem.label}</span>}
          </NavLink>
        )}

        {/* ГРО */}
        {!geo && (
          <NavLink
            to={`/projects/${projectId}/${groItem.path}`}
            className={linkClass}
            title={isCollapsed ? groItem.label : undefined}
            onClick={handleLinkClick}
          >
            {groItem.icon}
            {!isCollapsed && <span className="truncate">{groItem.label}</span>}
          </NavLink>
        )}

        {/* Проводник */}
        {!geo && (
          <NavLink
            to={`/projects/${projectId}/${explorerItem.path}`}
            className={linkClass}
            title={isCollapsed ? explorerItem.label : undefined}
            onClick={handleLinkClick}
          >
            {explorerItem.icon}
            {!isCollapsed && <span className="truncate">{explorerItem.label}</span>}
          </NavLink>
        )}

        {!geo && <div className="ds-divider" />}

        {/* Процесс строительства (карта-изображение) */}
        {!geo && (
          <NavLink
            to={`/projects/${projectId}/${constructionItem.path}`}
            className={linkClass}
            title={isCollapsed ? constructionItem.label : undefined}
            onClick={handleLinkClick}
          >
            {constructionItem.icon}
            {!isCollapsed && <span className="leading-tight">Процесс<br/>строительства</span>}
          </NavLink>
        )}

        {!geo && isAdmin && (
          <>
            <div className="ds-divider" />
            <NavLink
              to={`/projects/${projectId}/${adminItem.path}`}
              className={linkClass}
              title={isCollapsed ? adminItem.label : undefined}
              onClick={handleLinkClick}
            >
              {adminItem.icon}
              {!isCollapsed && <span className="truncate">{adminItem.label}</span>}
            </NavLink>
          </>
        )}
      </nav>

      {/* Тема + Инструкция + Поддержка — внизу */}
      <div className="py-3 space-y-1" style={{ borderTop: "1px solid var(--ds-sidebar-border)" }}>
        {/* Переключатель темы */}
        <button
          onClick={toggleTheme}
          className={`ds-nav-link ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? (theme === "dark" ? "Светлая тема" : "Тёмная тема") : undefined}
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          {!isCollapsed && <span className="truncate">{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>}
        </button>

        <NavLink
          to={`/projects/${projectId}/instruction`}
          className={linkClass}
          title={isCollapsed ? "Инструкция" : undefined}
          onClick={handleLinkClick}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {!isCollapsed && <span className="truncate">Инструкция</span>}
        </NavLink>

        {isPortalAdmin && (
          <NavLink
            to={`/projects/${projectId}/structure`}
            className={linkClass}
            title={isCollapsed ? "Структура" : undefined}
            onClick={handleLinkClick}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            {!isCollapsed && <span className="truncate">Структура</span>}
          </NavLink>
        )}

        {canInstall && (
          <button
            onClick={install}
            className={`ds-nav-link ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "Установить приложение" : undefined}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7v7m0 0l-2.5-2.5M12 14l2.5-2.5M9 18h6" />
            </svg>
            {!isCollapsed && <span className="truncate">Установить приложение</span>}
          </button>
        )}

      </div>
    </aside>
  );
}
