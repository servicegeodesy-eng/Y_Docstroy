import { useState } from "react";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";

type Tab = "ordered" | "remaining" | "drafts";

export default function MaterialsPage() {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<Tab>("ordered");

  if (!project) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "ordered", label: "Заказано" },
    { key: "remaining", label: "Остатки" },
    { key: "drafts", label: "Черновики" },
  ];

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
          Материалы
        </h2>
        <button className="ds-btn text-sm">+ Заказать</button>
      </div>

      <div className="flex gap-1 rounded-lg p-1 w-fit mb-4" style={{ background: "var(--ds-surface-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
            style={activeTab === tab.key
              ? { background: "var(--ds-surface)", color: "var(--ds-text)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
              : { color: "var(--ds-text-faint)" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ds-card p-8 text-center">
        <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>
          {activeTab === "ordered" ? "Нет заказов" : activeTab === "remaining" ? "Нет остатков" : "Нет черновиков"}
        </p>
        <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Нажмите «Заказать» для создания первой заявки на материалы
        </p>
      </div>
    </div>
  );
}
