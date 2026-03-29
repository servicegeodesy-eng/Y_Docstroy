import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import CreateWorkModal from "@/components/installation/CreateWorkModal";
import WorkDetailModal from "@/components/installation/WorkDetailModal";
import type { InstallationWork, WorkMaterial } from "@/components/installation/WorkCard";

const STATUS_LABELS: Record<string, string> = { planned: "Запланировано", in_progress: "В процессе", completed: "Завершено" };
const STATUS_COLORS: Record<string, string> = { planned: "#3b82f6", in_progress: "#f59e0b", completed: "#22c55e" };

type FilterKey = "building" | "workType" | "floor" | "construction";

export default function InstallationPage() {
  const { project, isProjectAdmin, isPortalAdmin } = useProject();
  const { user } = useAuth();
  const { isMobile } = useMobile();

  const [works, setWorks] = useState<InstallationWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [showAllWorks, setShowAllWorks] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState<Record<FilterKey, Set<string>>>({ building: new Set(), workType: new Set(), floor: new Set(), construction: new Set() });

  const loadWorks = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const params: Record<string, string> = { project_id: project.id };
    if (!showAllWorks && user) params.created_by = user.id;
    const res = await api.get<InstallationWork[]>("/api/installation/works", params);
    if (res.data) setWorks(res.data);
    setLoading(false);
  }, [project, showAllWorks, user]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  if (!project) return null;

  const hasActiveFilters = search || dateFrom || dateTo || Object.values(filters).some(s => s.size > 0);
  const activeFilterCount = (search ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + Object.values(filters).reduce((a, s) => a + s.size, 0);

  const filterOptions = useMemo(() => {
    const sets: Record<FilterKey, Set<string>> = { building: new Set(), workType: new Set(), floor: new Set(), construction: new Set() };
    for (const w of works) {
      if (w.building_name) sets.building.add(w.building_name);
      if (w.work_type_name) sets.workType.add(w.work_type_name);
      if (w.floor_name) sets.floor.add(w.floor_name);
      if (w.construction_name) sets.construction.add(w.construction_name);
    }
    return { building: [...sets.building].sort(), workType: [...sets.workType].sort(), floor: [...sets.floor].sort(), construction: [...sets.construction].sort() };
  }, [works]);

  function applyFilters(list: InstallationWork[]) {
    return list.filter(w => {
      if (filters.building.size > 0 && !filters.building.has(w.building_name || "")) return false;
      if (filters.workType.size > 0 && !filters.workType.has(w.work_type_name || "")) return false;
      if (filters.floor.size > 0 && !filters.floor.has(w.floor_name || "")) return false;
      if (filters.construction.size > 0 && !filters.construction.has(w.construction_name || "")) return false;
      if (dateFrom && w.planned_date && w.planned_date < dateFrom) return false;
      if (dateTo && w.planned_date && w.planned_date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const fields = [w.building_name, w.work_type_name, w.notes].filter(Boolean);
        if (!fields.some(f => f!.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }

  const inProgressList = applyFilters(works.filter(w => w.status === "in_progress"));
  const plannedList = applyFilters(works.filter(w => w.status === "planned"));
  const completedList = applyFilters(works.filter(w => w.status === "completed"));

  function clearFilters() {
    setSearch(""); setDateFrom(""); setDateTo("");
    setFilters({ building: new Set(), workType: new Set(), floor: new Set(), construction: new Set() });
  }

  function toggleFilter(key: FilterKey, value: string) {
    setFilters(prev => {
      const s = new Set(prev[key]);
      if (s.has(value)) s.delete(value); else s.add(value);
      return { ...prev, [key]: s };
    });
  }

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-4"}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>Монтаж</h2>
          <button onClick={() => setShowFilters(v => !v)} className="ds-icon-btn relative" style={showFilters || hasActiveFilters ? { color: "var(--ds-accent)" } : undefined}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
          {hasActiveFilters && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, transparent)", color: "var(--ds-accent)" }}>x{activeFilterCount}</span>}
        </div>
        <button className="ds-btn text-sm flex items-center gap-1.5" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {!isMobile && "Новые работы"}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="ds-card p-3 mb-4 flex flex-wrap gap-2 items-center" data-print-hide>
          <input className="ds-input text-sm" style={{ maxWidth: 200 }} placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
          <input type="date" className="ds-input text-sm w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="ds-input text-sm w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(["building", "workType", "floor", "construction"] as FilterKey[]).map(key => {
            const opts = filterOptions[key];
            if (opts.length === 0) return null;
            const labels: Record<FilterKey, string> = { building: "Место", workType: "Вид работ", floor: "Уровень", construction: "Конструкция" };
            return (
              <select key={key} className="ds-input text-sm w-auto" value="" onChange={e => { if (e.target.value) toggleFilter(key, e.target.value); }}>
                <option value="">{labels[key]}{filters[key].size > 0 ? ` (${filters[key].size})` : ""}</option>
                {opts.map(o => <option key={o} value={o}>{filters[key].has(o) ? "✓ " : ""}{o}</option>)}
              </select>
            );
          })}
          <button onClick={() => setShowAllWorks(v => !v)} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${showAllWorks ? "ds-btn" : "ds-btn-secondary"}`}>
            {showAllWorks ? "Все работы" : "Мои работы"}
          </button>
          {hasActiveFilters && <button onClick={clearFilters} className="text-xs underline" style={{ color: "var(--ds-accent)" }}>Сбросить</button>}
        </div>
      )}

      {loading ? (
        <div className="ds-card p-8 text-center">
          <div className="ds-spinner mx-auto mb-2" />
          <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
        </div>
      ) : (
        <>
          {/* В процессе */}
          {inProgressList.length > 0 && (
            <div className="ds-card overflow-hidden mb-3">
              <table className="ds-table">
                <thead><tr>
                  <th className="w-12">#</th><th className="w-24">Дата</th><th>Место / Вид работ</th><th>Материалы</th><th className="w-20">Прогресс</th><th className="w-28">Статус</th>
                </tr></thead>
                <tbody>
                  {inProgressList.map((w, i) => <WorkRow key={w.id} work={w} idx={i + 1} onClick={() => setSelectedWorkId(w.id)} />)}
                </tbody>
              </table>
            </div>
          )}

          {/* Разделитель */}
          {inProgressList.length > 0 && plannedList.length > 0 && (
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px" style={{ background: "var(--ds-border)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--ds-text-faint)" }}>Запланировано</span>
              <div className="flex-1 h-px" style={{ background: "var(--ds-border)" }} />
            </div>
          )}

          {/* Запланировано */}
          {plannedList.length > 0 && (
            <div className="ds-card overflow-hidden">
              <table className="ds-table">
                {inProgressList.length === 0 && (
                  <thead><tr>
                    <th className="w-12">#</th><th className="w-24">Дата</th><th>Место / Вид работ</th><th>Материалы</th><th className="w-20">Прогресс</th><th className="w-28">Статус</th>
                  </tr></thead>
                )}
                <tbody>
                  {plannedList.map((w, i) => <WorkRow key={w.id} work={w} idx={inProgressList.length + i + 1} onClick={() => setSelectedWorkId(w.id)} />)}
                </tbody>
              </table>
            </div>
          )}

          {inProgressList.length === 0 && plannedList.length === 0 && (
            <div className="ds-card p-8 text-center">
              <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>Нет работ</p>
              <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нажмите «Новые работы» для планирования</p>
            </div>
          )}

          {/* Архив */}
          {completedList.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowArchive(!showArchive)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5" style={{ color: "var(--ds-text-faint)" }}>
                <svg className={`w-3 h-3 transition-transform ${showArchive ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                Архив ({completedList.length})
              </button>
              {showArchive && (
                <div className="ds-card overflow-hidden mt-1">
                  <table className="ds-table"><tbody>
                    {completedList.map((w, i) => <WorkRow key={w.id} work={w} idx={i + 1} onClick={() => setSelectedWorkId(w.id)} />)}
                  </tbody></table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCreate && <CreateWorkModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadWorks(); }} />}
      {selectedWorkId && <WorkDetailModal workId={selectedWorkId} onClose={() => { setSelectedWorkId(null); loadWorks(); }} onUpdated={loadWorks} />}
    </div>
  );
}

function MaterialProgress({ mat }: { mat: WorkMaterial }) {
  const max = Math.max(Number(mat.required_qty) || 1, 1);
  const availPct = Math.min((Number(mat.available_qty) / max) * 100, 100);
  const usedPct = Math.min((Number(mat.used_qty) / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs truncate" style={{ color: "var(--ds-text-muted)", maxWidth: 80 }}>{mat.material_name}</span>
      <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: "var(--ds-surface-sunken)", minWidth: 50 }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${availPct}%`, background: "#22c55e", opacity: 0.5 }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${usedPct}%`, background: "#f59e0b" }} />
      </div>
      <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: "var(--ds-text-faint)" }}>
        {mat.used_qty}/{mat.available_qty}/{mat.required_qty}
      </span>
    </div>
  );
}

function WorkRow({ work, idx, onClick }: { work: InstallationWork; idx: number; onClick: () => void }) {
  const location = [work.building_name, work.work_type_name].filter(Boolean).join(" / ");
  const sub = [work.floor_name, work.construction_name].filter(Boolean).join(" / ");
  const date = work.planned_date ? new Date(work.planned_date).toLocaleDateString("ru") : "";
  const color = STATUS_COLORS[work.status] || "#9ca3af";
  const progress = Math.round(Number(work.progress) || 0);
  const mats = work.materials || [];

  return (
    <tr className="cursor-pointer" onClick={onClick}>
      <td className="text-sm font-medium" style={{ color: "var(--ds-accent)" }}>{idx}</td>
      <td className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{date}</td>
      <td>
        <div className="text-sm" style={{ color: "var(--ds-text)" }}>{location}</div>
        {sub && <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{sub}</div>}
      </td>
      <td>
        <div className="flex flex-col gap-0.5">
          {mats.slice(0, 3).map((m, i) => <MaterialProgress key={i} mat={m} />)}
          {mats.length > 3 && <span className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>+{mats.length - 3} ещё</span>}
        </div>
      </td>
      <td className="text-sm font-semibold text-center" style={{ color }}>{progress}%</td>
      <td>
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
          {STATUS_LABELS[work.status] || work.status}
        </span>
      </td>
    </tr>
  );
}
