import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { formatSize, downloadStorage } from "@/lib/utils";
import type { InstallationWork, WorkMaterial } from "./WorkCard";

interface WorkDetail extends InstallationWork {
  files: { id: string; file_name: string; storage_path: string; file_size: number; category: string; created_at: string }[];
  log: { id: string; action: string; details: Record<string, unknown> | null; created_at: string; last_name: string; first_name: string }[];
}

interface Props {
  workId: string;
  onClose: () => void;
  onUpdated: () => void;
}

type Tab = "info" | "materials" | "files";

export default function WorkDetailModal({ workId, onClose, onUpdated }: Props) {
  const { isProjectAdmin, isPortalAdmin } = useProject();
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [actionLoading, setActionLoading] = useState(false);

  // Material usage form
  const [usageAmounts, setUsageAmounts] = useState<Record<string, string>>({});
  const [deliveryAmounts, setDeliveryAmounts] = useState<Record<string, string>>({});
  const [showDelivery, setShowDelivery] = useState<string | null>(null);

  // Dispositions (for completing)
  const [showComplete, setShowComplete] = useState(false);
  const [dispositions, setDispositions] = useState<{ id: string; name: string; unit: string; unused: number; action: "returned" | "scrap"; qty: string }[]>([]);

  const loadWork = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WorkDetail>(`/api/installation/works/${workId}`);
    if (res.data) {
      const d = res.data;
      setWork({
        ...d,
        materials: d.materials || [],
        files: d.files || [],
        log: d.log || [],
      });
    }
    setLoading(false);
  }, [workId]);

  useEffect(() => { loadWork(); }, [loadWork]);

  if (loading || !work) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="ds-card p-8"><div className="ds-spinner mx-auto" /></div>
      </div>
    );
  }

  const isInProgress = work.status === "in_progress";
  const isPlanned = work.status === "planned";
  const isCompleted = work.status === "completed";
  const canAdmin = isProjectAdmin || isPortalAdmin;
  const location = [work.building_name, work.work_type_name, work.floor_name, work.construction_name].filter(Boolean).join(" / ") || "—";
  const statusLabel = isPlanned ? "Запланировано" : isInProgress ? "В процессе" : "Завершено";
  const statusColor = isPlanned ? "#3b82f6" : isInProgress ? "#f59e0b" : "#22c55e";

  async function handleStart() {
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/start`, {});
    setActionLoading(false);
    loadWork();
    onUpdated();
  }

  async function handleUseMaterial(matId: string, orderItemId: string) {
    const qty = Number(usageAmounts[matId]) || 0;
    if (qty <= 0) return;
    // Validate: нельзя больше чем в наличии
    const mat = work.materials.find(m => m.id === matId);
    if (mat && qty > mat.available_qty - mat.used_qty) {
      alert(`Нельзя использовать больше чем в наличии (${mat.available_qty - mat.used_qty})`);
      return;
    }
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/use-material`, { installation_material_id: matId, quantity: qty });
    setUsageAmounts(p => ({ ...p, [matId]: "" }));
    setActionLoading(false);
    loadWork();
    onUpdated();
  }

  async function handleDelivery(orderItemId: string) {
    const qty = Number(deliveryAmounts[orderItemId]) || 0;
    if (qty <= 0) return;
    setActionLoading(true);
    await api.post("/api/materials/deliveries", { items: [{ order_item_id: orderItemId, quantity: qty }] });
    setDeliveryAmounts(p => ({ ...p, [orderItemId]: "" }));
    setShowDelivery(null);
    setActionLoading(false);
    loadWork();
  }

  function prepareComplete() {
    const disps = work.materials
      .filter(m => m.available_qty - m.used_qty > 0)
      .map(m => ({
        id: m.order_item_id || m.id,
        name: m.material_name,
        unit: m.unit_short,
        unused: m.available_qty - m.used_qty,
        action: "returned" as const,
        qty: String(m.available_qty - m.used_qty),
      }));
    setDispositions(disps);
    setShowComplete(true);
  }

  async function handleComplete() {
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/complete`, {
      dispositions: dispositions.map(d => ({
        order_item_id: d.id,
        quantity: Number(d.qty) || 0,
        disposition: d.action,
      })),
    });
    setActionLoading(false);
    setShowComplete(false);
    loadWork();
    onUpdated();
  }

  async function handleFileUpload() {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true;
    input.onchange = async (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.files) return;
      for (const file of Array.from(t.files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("work_id", workId);
        await api.upload("/api/installation/files", fd);
      }
      loadWork();
    };
    input.click();
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "info", label: "Информация" },
    { key: "materials", label: "Материалы", badge: work.materials.length },
    { key: "files", label: "Файлы", badge: work.files.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ maxWidth: isMobile ? "100%" : "700px", maxHeight: "90vh", background: "var(--ds-surface)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Работа #{work.work_number || workId.slice(0, 6)}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor }}>
              {statusLabel}
            </span>
          </div>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--ds-border)" }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
              style={activeTab === tab.key
                ? { color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                : { color: "var(--ds-text-muted)", borderColor: "transparent" }}>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1.5 text-xs px-1 rounded-full" style={{ background: "var(--ds-surface-sunken)" }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* === INFO TAB === */}
          {activeTab === "info" && (
            <div className="space-y-4">
              <InfoRow label="Место" value={location} />
              <InfoRow label="Плановая дата" value={work.planned_date || "—"} />
              {work.started_at && <InfoRow label="Начато" value={new Date(work.started_at).toLocaleString("ru")} />}
              {work.completed_at && <InfoRow label="Завершено" value={new Date(work.completed_at).toLocaleString("ru")} />}
              <InfoRow label="Прогресс" value={`${work.progress || 0}%`} />
              {work.notes && <InfoRow label="Примечание" value={work.notes} />}

              {/* Actions */}
              <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--ds-border)" }}>
                {isPlanned && (
                  <button onClick={handleStart} disabled={actionLoading} className="ds-btn text-sm">
                    {actionLoading ? "..." : "Начать процесс"}
                  </button>
                )}
                {isInProgress && !showComplete && (
                  <button onClick={prepareComplete} disabled={actionLoading} className="ds-btn text-sm" style={{ background: "#22c55e" }}>
                    Завершить монтаж
                  </button>
                )}
              </div>

              {/* Complete dispositions */}
              {showComplete && (
                <div className="p-4 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>Неиспользованные материалы</h4>
                  {dispositions.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Все материалы использованы</p>
                  ) : dispositions.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-2 mb-2">
                      <span className="text-sm flex-1" style={{ color: "var(--ds-text)" }}>{d.name} ({d.unused} {d.unit})</span>
                      <select className="ds-input w-28 text-xs" value={d.action}
                        onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, action: e.target.value as "returned" | "scrap" } : x))}>
                        <option value="returned">В остатки</option>
                        <option value="scrap">В утиль</option>
                      </select>
                      <input className="ds-input w-16 text-xs text-center" type="number" value={d.qty}
                        onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleComplete} disabled={actionLoading} className="ds-btn text-sm">
                      {actionLoading ? "..." : "Подтвердить завершение"}
                    </button>
                    <button onClick={() => setShowComplete(false)} className="ds-btn-secondary text-sm">Отмена</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === MATERIALS TAB === */}
          {activeTab === "materials" && (
            <div className="space-y-3">
              {work.materials.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет привязанных материалов</p>
              ) : work.materials.map(mat => {
                const remaining = mat.available_qty - mat.used_qty;
                const pct = mat.required_qty > 0 ? Math.round((mat.used_qty / mat.required_qty) * 100) : 0;
                return (
                  <div key={mat.id} className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{mat.material_name}</span>
                      <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{mat.unit_short}</span>
                    </div>
                    {/* Progress bars */}
                    <div className="space-y-1 mb-2">
                      <BarRow label="Нужно" value={mat.required_qty} max={mat.required_qty} color="#9ca3af" />
                      <BarRow label="В наличии" value={mat.available_qty} max={mat.required_qty} color="#22c55e" />
                      <BarRow label="Использовано" value={mat.used_qty} max={mat.required_qty} color="#f59e0b" />
                    </div>
                    <div className="text-xs text-right mb-2" style={{ color: "var(--ds-text-faint)" }}>Прогресс: {pct}%</div>

                    {/* Actions for in-progress */}
                    {isInProgress && (
                      <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--ds-border)" }}>
                        <input className="ds-input w-20 text-xs text-center" type="number" min="0"
                          max={remaining} step="0.01" placeholder="Кол-во"
                          value={usageAmounts[mat.id] || ""}
                          onChange={e => setUsageAmounts(p => ({ ...p, [mat.id]: e.target.value }))} />
                        <button onClick={() => handleUseMaterial(mat.id, mat.order_item_id || "")}
                          disabled={actionLoading || !usageAmounts[mat.id]}
                          className="ds-btn text-xs px-2 py-1">Зафиксировать</button>

                        {remaining < mat.required_qty - mat.used_qty && mat.order_item_id && (
                          <>
                            {showDelivery === mat.id ? (
                              <div className="flex items-center gap-1">
                                <input className="ds-input w-16 text-xs text-center" type="number" min="0" placeholder="Кол-во"
                                  value={deliveryAmounts[mat.order_item_id || ""] || ""}
                                  onChange={e => setDeliveryAmounts(p => ({ ...p, [mat.order_item_id || ""]: e.target.value }))} />
                                <button onClick={() => handleDelivery(mat.order_item_id || "")} disabled={actionLoading}
                                  className="ds-btn-secondary text-xs px-2 py-1">OK</button>
                                <button onClick={() => setShowDelivery(null)} className="text-xs" style={{ color: "var(--ds-text-faint)" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => setShowDelivery(mat.id)} className="text-xs underline" style={{ color: "var(--ds-accent)" }}>
                                Поступление
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* === FILES TAB === */}
          {activeTab === "files" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>Файлы ({work.files.length})</h4>
                {!isCompleted && (
                  <button onClick={handleFileUpload} className="ds-btn-secondary text-xs px-3 py-1.5">+ Добавить файл</button>
                )}
              </div>
              {work.files.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет файлов</p>
              ) : (
                <ul className="space-y-1">
                  {work.files.map(f => (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "var(--ds-surface-sunken)" }}>
                      <span className="text-sm flex-1 truncate" style={{ color: "var(--ds-text)" }}>{f.file_name}</span>
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>
                      <button onClick={() => downloadStorage(f.storage_path, f.file_name)} className="ds-icon-btn" title="Скачать">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-medium w-28 shrink-0 pt-0.5" style={{ color: "var(--ds-text-faint)" }}>{label}</span>
      <span className="text-sm" style={{ color: "var(--ds-text)" }}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 text-right" style={{ color: "var(--ds-text-faint)" }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--ds-border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] w-12" style={{ color: "var(--ds-text-faint)" }}>{value}/{max}</span>
    </div>
  );
}
