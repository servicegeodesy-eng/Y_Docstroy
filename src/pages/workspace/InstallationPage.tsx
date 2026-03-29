import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import WorkCard from "@/components/installation/WorkCard";
import CreateWorkModal from "@/components/installation/CreateWorkModal";
import WorkProcessModal from "@/components/installation/WorkProcessModal";
import type { InstallationWork } from "@/components/installation/WorkCard";

type Tab = "planned" | "in_progress" | "completed";

export default function InstallationPage() {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<Tab>("planned");

  // Data
  const [works, setWorks] = useState<InstallationWork[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWork, setSelectedWork] = useState<InstallationWork | null>(null);

  const loadWorks = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const res = await api.get<InstallationWork[]>("/api/installation/works", {
      project_id: project.id,
    });
    if (res.data) setWorks(res.data);
    setLoading(false);
  }, [project]);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  if (!project) return null;

  const plannedList = works.filter((w) => w.status === "planned");
  const inProgressList = works.filter((w) => w.status === "in_progress");
  const completedList = works.filter((w) => w.status === "completed");

  const currentList =
    activeTab === "planned" ? plannedList
    : activeTab === "in_progress" ? inProgressList
    : completedList;

  const handleCreated = () => {
    setShowCreate(false);
    loadWorks();
  };

  const handleWorkUpdated = () => {
    setSelectedWork(null);
    loadWorks();
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "planned", label: "Запланировано", count: plannedList.length },
    { key: "in_progress", label: "В процессе", count: inProgressList.length },
    { key: "completed", label: "Завершено", count: completedList.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
          Монтаж
        </h2>
        <button
          className="ds-btn text-sm flex items-center gap-1.5"
          onClick={() => setShowCreate(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!isMobile && "Новые работы"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit mb-4" style={{ background: "var(--ds-surface-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
            style={activeTab === tab.key
              ? { background: "var(--ds-surface)", color: "var(--ds-text)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
              : { color: "var(--ds-text-faint)" }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === tab.key
                    ? "color-mix(in srgb, var(--ds-accent) 15%, transparent)"
                    : "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)",
                  color: activeTab === tab.key ? "var(--ds-accent)" : "var(--ds-text-faint)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="ds-card p-8 text-center">
          <div
            className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-2"
            style={{ color: "var(--ds-accent)" }}
          />
          <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
        </div>
      ) : currentList.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"}`}>
          {currentList.map((work) => (
            <WorkCard
              key={work.id}
              work={work}
              onClick={() => setSelectedWork(work)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateWorkModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {selectedWork && (
        <WorkProcessModal
          work={selectedWork}
          onClose={() => setSelectedWork(null)}
          onUpdated={handleWorkUpdated}
        />
      )}
    </div>
  );
}

/* ============================================================================
   Empty State
   ============================================================================ */

function EmptyState({ tab }: { tab: Tab }) {
  const hints: Record<Tab, { message: string; hint: string }> = {
    planned: {
      message: "Нет запланированных работ",
      hint: "Нажмите «Новые работы» для планирования монтажа",
    },
    in_progress: {
      message: "Нет работ в процессе",
      hint: "Начните выполнение запланированных работ",
    },
    completed: {
      message: "Нет завершённых работ",
      hint: "Завершённые работы появятся здесь",
    },
  };

  const { message, hint } = hints[tab];

  return (
    <div className="ds-card p-8 text-center">
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
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
        />
      </svg>
      <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>{message}</p>
      <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>{hint}</p>
    </div>
  );
}
