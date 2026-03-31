import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import WorkMaskPreview from "@/components/installation/WorkMaskPreview";

interface WorkMaterial {
  id: string;
  material_name: string;
  unit_short: string;
  required_qty: number;
  used_qty: number;
  available_qty: number;
}

interface MaterialWork {
  id: string;
  status: "planned" | "in_progress" | "completed";
  building_name: string;
  work_type_name: string;
  floor_name: string | null;
  construction_name: string | null;
  planned_date: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  completion_comment: string | null;
  materials: WorkMaterial[];
}

interface Disposition {
  material_id: string;
  name: string;
  unit: string;
  unused: number;
  action: "returned" | "scrap";
  qty: string;
  notes: string;
}

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

export default function MaterialsPage() {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const [works, setWorks] = useState<MaterialWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [expandedWork, setExpandedWork] = useState<string | null>(null);

  const loadWorks = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const res = await api.get<MaterialWork[]>("/api/installation/works", { project_id: project.id });
    if (res.data) {
      setWorks(res.data.map(w => ({
        ...w,
        materials: ((w.materials || []) as unknown as Record<string, unknown>[]).map(m => ({
          id: m.id as string,
          material_name: (m.material_name || "") as string,
          unit_short: (m.unit_short || "") as string,
          required_qty: Number(m.required_qty) || 0,
          used_qty: Number(m.used_qty) || 0,
          available_qty: Number(m.available_qty) || 0,
        })),
      })));
    }
    setLoading(false);
  }, [project]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  if (!project) return null;

  // Фильтруем работы с материалами
  const worksWithMaterials = works.filter(w => (w.materials || []).length > 0);
  const activeWorks = worksWithMaterials.filter(w => w.status !== "completed");
  const completedWorks = worksWithMaterials.filter(w => w.status === "completed");

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
          Материалы
        </h2>
      </div>

      {loading ? (
        <div className="ds-card p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-2" style={{ color: "var(--ds-accent)" }} />
          <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
        </div>
      ) : worksWithMaterials.length === 0 ? (
        <div className="ds-card p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>Нет данных по материалам</p>
          <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Материалы появятся после создания работ с указанием материалов</p>
        </div>
      ) : (
        <>
          {/* Активные работы */}
          <div className="space-y-3">
            {activeWorks.map(work => (
              <MaterialWorkCard
                key={work.id}
                work={work}
                expanded={expandedWork === work.id}
                onToggle={() => setExpandedWork(expandedWork === work.id ? null : work.id)}
                onUpdated={loadWorks}
                isMobile={isMobile}
              />
            ))}
          </div>

          {activeWorks.length === 0 && completedWorks.length > 0 && (
            <div className="ds-card p-6 text-center mb-3">
              <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет активных работ с материалами</p>
            </div>
          )}

          {/* Архив */}
          {completedWorks.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5"
                style={{ color: "var(--ds-text-faint)" }}
              >
                <svg className={`w-3 h-3 transition-transform ${showArchive ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Завершённые ({completedWorks.length})
              </button>
              {showArchive && (
                <div className="space-y-3 mt-2">
                  {completedWorks.map(work => (
                    <MaterialWorkCard
                      key={work.id}
                      work={work}
                      expanded={expandedWork === work.id}
                      onToggle={() => setExpandedWork(expandedWork === work.id ? null : work.id)}
                      onUpdated={loadWorks}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* === Карточка работы с материалами === */

function MaterialWorkCard({ work, expanded, onToggle, onUpdated, isMobile }: {
  work: MaterialWork;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
  isMobile: boolean;
}) {
  const location = [work.building_name, work.work_type_name].filter(Boolean).join(" / ");
  const subLocation = [work.floor_name, work.construction_name].filter(Boolean).join(" / ");
  const statusColor = STATUS_COLORS[work.status] || "#9ca3af";
  const isCompleted = work.status === "completed";
  const isInProgress = work.status === "in_progress";

  // Сводка по материалам
  const totalRequired = work.materials.reduce((s, m) => s + m.required_qty, 0);
  const totalUsed = work.materials.reduce((s, m) => s + m.used_qty, 0);
  const overuse = Math.max(0, totalUsed - totalRequired);

  return (
    <div className="ds-card overflow-hidden">
      {/* Заголовок карточки — кликабельный */}
      <div className="cursor-pointer" onClick={onToggle}>
        <div className={`p-4 ${isMobile ? "" : "flex gap-4"}`}>
          {/* Левая часть: информация о работе */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{location}</span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor }}
              >
                {STATUS_LABELS[work.status]}
              </span>
              <svg className={`w-4 h-4 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--ds-text-faint)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {subLocation && (
              <p className="text-xs mb-2" style={{ color: "var(--ds-text-faint)" }}>{subLocation}</p>
            )}

            {/* Сводка материалов в компактном виде */}
            <div className="flex flex-wrap gap-3 mt-2">
              <MaterialStat label="Использовано" value={totalUsed} color="#f59e0b" />
              {overuse > 0 && <MaterialStat label="Перерасход" value={overuse} color="#ef4444" />}
              <MaterialStat label="Заявлено" value={totalRequired} color="#9ca3af" />
            </div>
          </div>

          {/* Правая часть: превью подложки (десктоп) */}
          {!isMobile && (
            <div className="shrink-0" style={{ width: 160 }}>
              <WorkMaskPreview workId={work.id} />
            </div>
          )}
        </div>

        {/* Превью на мобильном — под основным блоком */}
        {isMobile && (
          <div className="px-4 pb-3">
            <WorkMaskPreview workId={work.id} />
          </div>
        )}
      </div>

      {/* Развёрнутый вид: детали по каждому материалу */}
      {expanded && (
        <div className="border-t" style={{ borderColor: "var(--ds-border)" }}>
          <div className="p-4 space-y-3">
            {work.materials.map(mat => {
              const matOveruse = Math.max(0, mat.used_qty - mat.required_qty);
              const matRemaining = Math.max(0, mat.required_qty - mat.used_qty);

              return (
                <div key={mat.id} className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{mat.material_name}</span>
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{mat.unit_short}</span>
                  </div>
                  <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
                    <MaterialStatBlock label="Использовано" value={mat.used_qty} unit={mat.unit_short} color="#f59e0b" />
                    <MaterialStatBlock label="Перерасход" value={matOveruse} unit={mat.unit_short} color={matOveruse > 0 ? "#ef4444" : "#9ca3af"} />
                    <MaterialStatBlock label="Заявлено" value={mat.required_qty} unit={mat.unit_short} color="#3b82f6" />
                    <MaterialStatBlock label="Остаток" value={matRemaining} unit={mat.unit_short} color={matRemaining > 0 ? "#22c55e" : "#9ca3af"} />
                  </div>
                  {/* Прогресс-бар */}
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--ds-border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, mat.required_qty > 0 ? (mat.used_qty / mat.required_qty) * 100 : 0)}%`,
                        background: matOveruse > 0 ? "#ef4444" : "#f59e0b",
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Комментарий при перерасходе (если работа завершена) */}
            {isCompleted && work.completion_comment && (
              <div className="p-3 rounded-lg" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#ef4444" }}>Комментарий к перерасходу</p>
                <p className="text-sm" style={{ color: "var(--ds-text)" }}>{work.completion_comment}</p>
              </div>
            )}

            {/* Кнопка завершения для in_progress */}
            {isInProgress && (
              <CompleteWorkSection workId={work.id} materials={work.materials} onCompleted={onUpdated} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* === Секция завершения работы === */

function CompleteWorkSection({ workId, materials, onCompleted }: {
  workId: string;
  materials: WorkMaterial[];
  onCompleted: () => void;
}) {
  const [showComplete, setShowComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completionComment, setCompletionComment] = useState("");

  // Определяем ситуацию: перерасход или остатки
  const hasOveruse = materials.some(m => m.used_qty > m.required_qty);
  const hasUnused = materials.some(m => m.used_qty < m.required_qty);

  const [dispositions, setDispositions] = useState<Disposition[]>([]);

  const startComplete = () => {
    // Формируем dispositions для материалов с остатками
    setDispositions(materials
      .filter(m => m.required_qty - m.used_qty > 0)
      .map(m => ({
        material_id: m.id,
        name: m.material_name,
        unit: m.unit_short,
        unused: m.required_qty - m.used_qty,
        action: "returned" as const,
        qty: String(m.required_qty - m.used_qty),
        notes: "",
      }))
    );
    setShowComplete(true);
  };

  const handleComplete = async () => {
    // Валидация: при перерасходе комментарий обязателен
    if (hasOveruse && !completionComment.trim()) {
      alert("Укажите причину перерасхода материалов");
      return;
    }

    setLoading(true);
    await api.post(`/api/installation/works/${workId}/complete`, {
      completion_comment: completionComment || null,
      dispositions: dispositions.map(d => ({
        material_id: d.material_id,
        quantity: Number(d.qty) || 0,
        disposition: d.action,
        notes: d.notes || null,
      })),
    });
    setLoading(false);
    setShowComplete(false);
    onCompleted();
  };

  if (!showComplete) {
    return (
      <button onClick={startComplete} className="ds-btn-secondary w-full text-sm py-2" style={{ color: "#22c55e", borderColor: "#22c55e" }}>
        Завершить работу
      </button>
    );
  }

  return (
    <div className="p-4 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
      <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>Завершение работы</h4>

      {/* Перерасход: комментарий обязателен */}
      {hasOveruse && (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1" style={{ color: "#ef4444" }}>
            Обнаружен перерасход материалов. Укажите причину *
          </label>
          <textarea
            className="ds-input w-full text-sm"
            rows={2}
            placeholder="Почему материалов использовано больше плана..."
            value={completionComment}
            onChange={e => setCompletionComment(e.target.value)}
          />
        </div>
      )}

      {/* Остатки: выбор куда направить */}
      {hasUnused && dispositions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Неиспользованные материалы</p>
          {dispositions.map((d, i) => (
            <div key={d.material_id} className="mb-3 p-2 rounded" style={{ background: "var(--ds-surface)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm flex-1" style={{ color: "var(--ds-text)" }}>{d.name} ({d.unused} {d.unit})</span>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <select
                  className="ds-input text-xs flex-1"
                  value={d.action}
                  onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, action: e.target.value as "returned" | "scrap" } : x))}
                >
                  <option value="returned">В остатки</option>
                  <option value="scrap">В утиль</option>
                </select>
                <input
                  className="ds-input w-20 text-xs text-center"
                  type="number"
                  value={d.qty}
                  onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                />
              </div>
              <textarea
                className="ds-input w-full text-xs"
                rows={1}
                placeholder="Комментарий..."
                value={d.notes}
                onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleComplete} disabled={loading} className="ds-btn text-sm">
          {loading ? "..." : "Подтвердить завершение"}
        </button>
        <button onClick={() => setShowComplete(false)} className="ds-btn-secondary text-sm">Отмена</button>
      </div>
    </div>
  );
}

/* === Утилиты для отображения === */

function MaterialStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--ds-text-faint)" }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      {label}: <span className="font-medium" style={{ color }}>{value}</span>
    </span>
  );
}

function MaterialStatBlock({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="text-center p-2 rounded" style={{ background: "var(--ds-surface)" }}>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--ds-text-faint)" }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color }}>{value}</p>
      <p className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>{unit}</p>
    </div>
  );
}
