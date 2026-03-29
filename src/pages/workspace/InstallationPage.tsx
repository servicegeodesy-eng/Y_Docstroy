import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import CreateWorkModal from "@/components/installation/CreateWorkModal";
import WorkDetailModal from "@/components/installation/WorkDetailModal";
import type { InstallationWork, WorkMaterial } from "@/components/installation/WorkCard";

type Tab = "planned" | "in_progress";

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Завершено",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
};

/* ============================================================================
   MaterialProgress -- 3-level stacked bars for a single material
   ============================================================================ */

function MaterialProgress({ mat }: { mat: WorkMaterial }) {
  const max = Math.max(mat.required_qty, 1);
  const availablePct = Math.min((mat.available_qty / max) * 100, 100);
  const usedPct = Math.min((mat.used_qty / max) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs truncate"
        style={{ color: "var(--ds-text-muted)", maxWidth: 120 }}
      >
        {mat.material_name}
      </span>
      <div
        className="flex-1 h-3 rounded-full overflow-hidden relative"
        style={{ background: "var(--ds-surface-sunken)", minWidth: 60 }}
      >
        {/* Green = available (in stock) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${availablePct}%`, background: "#22c55e", opacity: 0.45 }}
        />
        {/* Orange = used (consumed) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${usedPct}%`, background: "#f59e0b" }}
        />
      </div>
      <span
        className="text-[10px] font-mono whitespace-nowrap"
        style={{ color: "var(--ds-text-faint)" }}
      >
        {mat.used_qty}/{mat.available_qty}/{mat.required_qty}
        {mat.unit_short ? ` ${mat.unit_short}` : ""}
      </span>
    </div>
  );
}

/* ============================================================================
   WorkRow -- single table row for a work
   ============================================================================ */

function WorkRow({
  work,
  idx,
  onClick,
}: {
  work: InstallationWork;
  idx: number;
  onClick: () => void;
}) {
  const location = [work.building_name, work.work_type_name].filter(Boolean).join(" / ");
  const sub = [work.floor_name, work.construction_name].filter(Boolean).join(" / ");
  const date = work.planned_date
    ? new Date(work.planned_date).toLocaleDateString("ru")
    : "";
  const statusColor = STATUS_COLORS[work.status] || "var(--ds-text-faint)";
  const progress = work.progress ?? 0;

  return (
    <tr className="cursor-pointer" onClick={onClick}>
      <td className="text-sm font-medium" style={{ color: "var(--ds-accent)" }}>
        {idx}
      </td>
      <td className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
        {date}
      </td>
      <td>
        <div className="text-sm" style={{ color: "var(--ds-text)" }}>{location}</div>
        {sub && (
          <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{sub}</div>
        )}
      </td>
      <td>
        <div className="flex flex-col gap-0.5">
          {(work.materials || []).map((mat) => (
            <MaterialProgress key={mat.id} mat={mat} />
          ))}
        </div>
      </td>
      <td className="text-center">
        <span className="text-sm font-bold" style={{ color: "var(--ds-text)" }}>
          {progress}%
        </span>
      </td>
      <td>
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
            color: statusColor,
          }}
        >
          {STATUS_LABELS[work.status] || work.status}
        </span>
      </td>
    </tr>
  );
}

/* ============================================================================
   Main page component
   ============================================================================ */

export default function InstallationPage() {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<Tab>("planned");
  // Data
  const [works, setWorks] = useState<InstallationWork[]>([]);
  const [loading, setLoading] = useState(false);

  // Archive
  const [showArchive, setShowArchive] = useState(false);

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

  const activeCount = plannedList.length + inProgressList.length;

  const currentList =
    activeTab === "planned" ? plannedList : inProgressList;

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
  ];

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <div className="flex items-center gap-2">
          <h2
            className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`}
            style={{ color: "var(--ds-text)" }}
          >
            Монтаж
          </h2>
          {activeCount > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: "color-mix(in srgb, var(--ds-accent) 15%, transparent)",
                color: "var(--ds-accent)",
              }}
            >
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit mb-4" style={{ background: "var(--ds-surface-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
            style={
              activeTab === tab.key
                ? { background: "var(--ds-surface)", color: "var(--ds-text)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
                : { color: "var(--ds-text-faint)" }
            }
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

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3">
        <LegendDot color="#9ca3af" label="Заявлено" />
        <LegendDot color="#22c55e" label="Доступно" />
        <LegendDot color="#f59e0b" label="Использовано" />
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
      ) : currentList.length === 0 && completedList.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div>
          {/* Active works table */}
          <div className="ds-card overflow-hidden">
            <table className="ds-table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th className="w-24">Дата</th>
                  <th>Место / Вид работ</th>
                  <th>Материалы</th>
                  <th className="w-20">Прогресс</th>
                  <th className="w-28">Статус</th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center"
                      style={{ color: "var(--ds-text-faint)" }}
                    >
                      Нет работ в этой категории
                    </td>
                  </tr>
                ) : (
                  currentList.map((work, i) => (
                    <WorkRow
                      key={work.id}
                      work={work}
                      idx={i + 1}
                      onClick={() => setSelectedWork(work)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Archive section */}
          {completedList.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5"
                style={{ color: "var(--ds-text-faint)" }}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showArchive ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Архив ({completedList.length})
              </button>
              {showArchive && (
                <div className="ds-card overflow-hidden mt-1">
                  <table className="ds-table">
                    <tbody>
                      {completedList.map((work, i) => (
                        <WorkRow
                          key={work.id}
                          work={work}
                          idx={i + 1}
                          onClick={() => setSelectedWork(work)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </>

      {/* Modals */}
      {showCreate && (
        <CreateWorkModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {selectedWork && (
        <WorkDetailModal
          workId={selectedWork.id}
          onClose={() => setSelectedWork(null)}
          onUpdated={handleWorkUpdated}
        />
      )}
    </div>
  );
}

/* ============================================================================
   Sub-components
   ============================================================================ */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ds-text-faint)" }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
      {label}
    </span>
  );
}

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
