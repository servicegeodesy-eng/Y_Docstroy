import { useState } from "react";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { useNavigate } from "react-router-dom";
import DictionaryManager from "@/components/admin/DictionaryManager";
import ProjectAccessTab from "@/components/admin/ProjectAccessTab";
import ProjectUsersTab from "@/components/admin/ProjectUsersTab";
import ProjectHistoryTab from "@/components/admin/ProjectHistoryTab";
import InviteManager from "@/components/admin/InviteManager";
import SubscriptionPanel from "@/components/admin/SubscriptionPanel";

interface TabDef {
  key: string;
  label: string;
}

export default function AdminPage() {
  const { isProjectAdmin, isPortalAdmin } = useProject();
  const { isMobile } = useMobile();
  const navigate = useNavigate();

  // Формируем вкладки в зависимости от роли
  const tabs: TabDef[] = [];
  if (isPortalAdmin) {
    tabs.push({ key: "access", label: "Доступ к проекту" });
  }
  if (isProjectAdmin && !isPortalAdmin) {
    tabs.push({ key: "users", label: "Пользователи проекта" });
  }
  tabs.push({ key: "invites", label: "Приглашения" });
  tabs.push({ key: "dictionaries", label: "Справочники" });
  tabs.push({ key: "history", label: "История действий" });
  if (isProjectAdmin || isPortalAdmin) {
    tabs.push({ key: "subscription", label: "Подписка" });
  }

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || "permissions");

  if (!isProjectAdmin) {
    return (
      <div className="ds-card p-12 text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3"
          style={{ color: "var(--ds-text-faint)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <h3 className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>Доступ ограничен</h3>
        <p className="text-sm mb-4" style={{ color: "var(--ds-text-faint)" }}>
          У вас нет прав для доступа к администрированию проекта.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-medium"
          style={{ color: "var(--ds-accent)" }}
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
          Администрирование
        </h2>
        {isPortalAdmin && (
          <span className="px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
            Администратор портала
          </span>
        )}
      </div>

      {/* Tabs */}
      <div
        className={`flex gap-1 rounded-lg p-1 ${isMobile ? "mb-3 overflow-x-auto w-full" : "mb-6 w-fit"}`}
        style={{ background: "var(--ds-surface-sunken)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`${isMobile ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "shadow-sm"
                : ""
            }`}
            style={
              activeTab === tab.key
                ? { background: "var(--ds-surface)", color: "var(--ds-text)" }
                : { color: "var(--ds-text-faint)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "access" && isPortalAdmin && <ProjectAccessTab />}
      {activeTab === "users" && !isPortalAdmin && <ProjectUsersTab />}
      {activeTab === "invites" && <InviteManager />}
      {activeTab === "dictionaries" && <DictionaryManager />}
      {activeTab === "history" && <ProjectHistoryTab />}
      {activeTab === "subscription" && <SubscriptionPanel />}
    </div>
  );
}
