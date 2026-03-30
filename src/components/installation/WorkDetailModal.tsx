import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { formatSize, downloadStorage } from "@/lib/utils";
import type { WorkMaterial } from "./WorkCard";
import WorkMaskPreview from "./WorkMaskPreview";

interface WorkFile { id: string; file_name: string; storage_path: string; file_size: number; category: string; created_at: string }
interface WorkData {
  id: string; status: string;
  building_id: string | null; work_type_id: string | null;
  floor_id: string | null; construction_id: string | null;
  building_name: string; work_type_name: string;
  floor_name: string | null; construction_name: string | null;
  planned_date: string; started_at: string | null; completed_at: string | null;
  notes: string | null; progress: number;
  materials: WorkMaterial[]; files: WorkFile[];
}
interface Props { workId: string; onClose: () => void; onUpdated: () => void }

export default function WorkDetailModal({ workId, onClose, onUpdated }: Props) {
  const { isProjectAdmin, isPortalAdmin } = useProject();
  const { isMobile } = useMobile();
  const { buildings, workTypes, floors, constructions } = useDictionaries();
  const [work, setWork] = useState<WorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [overlayPreviewUrl, setOverlayPreviewUrl] = useState("");

  // Edit mode
  const isAdmin = isProjectAdmin || isPortalAdmin;
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ building_id: "", work_type_id: "", floor_id: "", construction_id: "", planned_date: "", notes: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Material usage
  const [usageAmounts, setUsageAmounts] = useState<Record<string, string>>({});
  const [deliveryAmounts, setDeliveryAmounts] = useState<Record<string, string>>({});
  const [showDelivery, setShowDelivery] = useState<string | null>(null);

  // Complete
  const [showComplete, setShowComplete] = useState(false);
  const [dispositions, setDispositions] = useState<{ id: string; name: string; unit: string; unused: number; action: "returned" | "scrap"; qty: string }[]>([]);

  const loadWork = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WorkData>(`/api/installation/works/${workId}`);
    if (res.data) {
      const d = res.data;
      setWork({
        ...d,
        progress: Number(d.progress) || 0,
        materials: (d.materials || []).map((m: Record<string, unknown>) => ({
          ...m,
          required_qty: Number(m.required_qty) || 0,
          available_qty: Number(m.available_qty) || 0,
          used_qty: Number(m.used_qty) || 0,
        })) as WorkMaterial[],
        files: d.files || [],
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
  const location = [work.building_name, work.work_type_name, work.floor_name, work.construction_name].filter(Boolean).join(" / ") || "—";
  const statusLabel = isPlanned ? "Запланировано" : isInProgress ? "В процессе" : "Завершено";
  const statusColor = isPlanned ? "#3b82f6" : isInProgress ? "#f59e0b" : "#22c55e";

  async function handleStart() {
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/start`, {});
    setActionLoading(false);
    loadWork();
  }

  function startEditing() {
    if (!work) return;
    setEditData({
      building_id: work.building_id || "",
      work_type_id: work.work_type_id || "",
      floor_id: work.floor_id || "",
      construction_id: work.construction_id || "",
      planned_date: work.planned_date || "",
      notes: work.notes || "",
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    setActionLoading(true);
    const res = await api.put(`/api/installation/works/${workId}`, editData);
    setActionLoading(false);
    if (res.error) { alert(res.error); return; }
    setEditing(false);
    loadWork(); onUpdated();
  }

  async function handleDelete() {
    setActionLoading(true);
    const res = await api.delete(`/api/installation/works/${workId}`);
    setActionLoading(false);
    if (res.error) { alert(res.error); return; }
    onClose(); onUpdated();
  }

  async function handleUseMaterial(matId: string) {
    const qty = Number(usageAmounts[matId]) || 0;
    if (qty <= 0) return;
    const mat = work!.materials.find(m => m.id === matId);
    if (mat && qty > mat.available_qty - mat.used_qty) {
      alert(`Нельзя использовать больше чем в наличии (${mat.available_qty - mat.used_qty})`);
      return;
    }
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/use-material`, { installation_material_id: matId, quantity: qty });
    setUsageAmounts(p => ({ ...p, [matId]: "" }));
    setActionLoading(false);
    loadWork(); onUpdated();
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
    setDispositions(work!.materials.filter(m => m.available_qty - m.used_qty > 0).map(m => ({
      id: m.order_item_id || m.id, name: m.material_name, unit: m.unit_short,
      unused: m.available_qty - m.used_qty, action: "returned" as const, qty: String(m.available_qty - m.used_qty),
    })));
    setShowComplete(true);
  }

  async function handleComplete() {
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/complete`, {
      dispositions: dispositions.map(d => ({ order_item_id: d.id, quantity: Number(d.qty) || 0, disposition: d.action })),
    });
    setActionLoading(false); setShowComplete(false);
    loadWork(); onUpdated();
  }

  async function handleFileUpload() {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true;
    input.onchange = async (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.files) return;
      for (const file of Array.from(t.files)) {
        const fd = new FormData(); fd.append("file", file); fd.append("work_id", workId);
        await api.upload("/api/installation/files", fd);
      }
      loadWork();
    };
    input.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ maxWidth: isMobile ? "100%" : "900px", maxHeight: "90vh", background: "var(--ds-surface)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Работа</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor }}>
              {statusLabel}
            </span>
            <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{Math.round(work.progress || 0)}%</span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && !editing && (
              <>
                <button onClick={startEditing} className="ds-icon-btn" title="Редактировать">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => setConfirmDelete(true)} className="ds-icon-btn hover:!text-red-500" title="Удалить">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Подтверждение удаления */}
        {confirmDelete && (
          <div className="px-6 py-3 flex items-center justify-between" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", borderBottom: "1px solid var(--ds-border)" }}>
            <span className="text-sm font-medium" style={{ color: "#ef4444" }}>Удалить работу? Это действие необратимо.</span>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={actionLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#ef4444" }}>
                {actionLoading ? "..." : "Да, удалить"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="ds-btn-secondary text-xs px-3 py-1.5">Отмена</button>
            </div>
          </div>
        )}

        {/* Body — scrollable, two columns on desktop */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`${isMobile ? "" : "flex gap-6"}`}>
          {/* Left column — info + materials + files */}
          <div className={`space-y-5 ${isMobile ? "" : "flex-1 min-w-0"}`}>
          {/* Info */}
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Место работ</label>
                  <select className="ds-input w-full text-sm" value={editData.building_id} onChange={e => setEditData(d => ({ ...d, building_id: e.target.value }))}>
                    <option value="">—</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Вид работ</label>
                  <select className="ds-input w-full text-sm" value={editData.work_type_id} onChange={e => setEditData(d => ({ ...d, work_type_id: e.target.value }))}>
                    <option value="">—</option>
                    {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Уровень</label>
                  <select className="ds-input w-full text-sm" value={editData.floor_id} onChange={e => setEditData(d => ({ ...d, floor_id: e.target.value }))}>
                    <option value="">—</option>
                    {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Конструкция</label>
                  <select className="ds-input w-full text-sm" value={editData.construction_id} onChange={e => setEditData(d => ({ ...d, construction_id: e.target.value }))}>
                    <option value="">—</option>
                    {constructions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Плановая дата</label>
                <input type="date" className="ds-input text-sm" value={editData.planned_date} onChange={e => setEditData(d => ({ ...d, planned_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Примечание</label>
                <textarea className="ds-input w-full text-sm" rows={2} value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={actionLoading} className="ds-btn text-xs px-4 py-1.5">{actionLoading ? "..." : "Сохранить"}</button>
                <button onClick={() => setEditing(false)} className="ds-btn-secondary text-xs px-4 py-1.5">Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Место</span><p style={{ color: "var(--ds-text)" }}>{location}</p></div>
                <div>
                  <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Плановая дата</span>
                  <p style={{ color: "var(--ds-text)" }}>{work.planned_date ? new Date(work.planned_date).toLocaleDateString("ru") : "—"}</p>
                  {isPlanned && (
                    <button onClick={handleStart} disabled={actionLoading} className="ds-btn text-xs px-3 py-1.5 mt-2">{actionLoading ? "..." : "Начать процесс"}</button>
                  )}
                  {isInProgress && !showComplete && (
                    <button onClick={prepareComplete} disabled={actionLoading} className="ds-btn-secondary text-xs px-3 py-1.5 mt-2" style={{ color: "#22c55e", borderColor: "#22c55e" }}>Завершить монтаж</button>
                  )}
                </div>
                {work.started_at && <div><span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Начато</span><p style={{ color: "var(--ds-text)" }}>{new Date(work.started_at).toLocaleString("ru")}</p></div>}
                {work.completed_at && <div><span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Завершено</span><p style={{ color: "var(--ds-text)" }}>{new Date(work.completed_at).toLocaleString("ru")}</p></div>}
              </div>
              {work.notes && <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{work.notes}</p>}
            </>
          )}

          {/* Materials */}
          {work.materials.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ds-text-faint)" }}>Материалы</h4>
              <div className="space-y-2">
                {work.materials.map(mat => {
                  const remaining = mat.available_qty - mat.used_qty;
                  return (
                    <div key={mat.id} className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{mat.material_name}</span>
                        <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{mat.used_qty}/{mat.available_qty}/{mat.required_qty} {mat.unit_short}</span>
                      </div>
                      <div className="space-y-0.5 mb-2">
                        <Bar label="Нужно" val={mat.required_qty} max={mat.required_qty} color="#9ca3af" />
                        <Bar label="В наличии" val={mat.available_qty} max={mat.required_qty} color="#22c55e" />
                        <Bar label="Использовано" val={mat.used_qty} max={mat.required_qty} color="#f59e0b" />
                      </div>
                      {isInProgress && (
                        <>
                          {/* Фиксация использования */}
                          <div className="flex items-center gap-3 pt-2 mb-2" style={{ borderTop: "1px solid var(--ds-border)" }}>
                            <input className="ds-input flex-1 text-sm text-center" type="number" min="0" max={remaining} step="0.01" placeholder="Укажите количество"
                              value={usageAmounts[mat.id] || ""} onChange={e => setUsageAmounts(p => ({ ...p, [mat.id]: e.target.value }))} />
                          </div>
                          <button onClick={() => handleUseMaterial(mat.id)} disabled={actionLoading || !usageAmounts[mat.id]}
                            className="ds-btn w-full text-sm py-2 mb-2">Зафиксировать процесс</button>

                          {/* Фиксация поступления */}
                          {(
                            showDelivery === mat.id ? (
                              <div className="flex items-center gap-2">
                                <input className="ds-input flex-1 text-sm text-center" type="number" min="0" placeholder="Количество поступления"
                                  value={deliveryAmounts[mat.order_item_id || mat.id] || ""} onChange={e => setDeliveryAmounts(p => ({ ...p, [mat.order_item_id || mat.id]: e.target.value }))} />
                                <button onClick={() => handleDelivery(mat.order_item_id || mat.id)} disabled={actionLoading} className="ds-btn text-xs px-3 py-1.5">OK</button>
                                <button onClick={() => setShowDelivery(null)} className="ds-icon-btn">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setShowDelivery(mat.id)} className="ds-btn-secondary w-full text-xs py-1.5">
                                Зафиксировать поступление материалов
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {showComplete && (
            <div className="p-4 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>Неиспользованные материалы</h4>
              {dispositions.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Все материалы использованы</p>
              ) : dispositions.map((d, i) => (
                <div key={d.id} className="flex items-center gap-2 mb-2">
                  <span className="text-sm flex-1">{d.name} ({d.unused} {d.unit})</span>
                  <select className="ds-input w-28 text-xs" value={d.action}
                    onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, action: e.target.value as "returned" | "scrap" } : x))}>
                    <option value="returned">В остатки</option><option value="scrap">В утиль</option>
                  </select>
                  <input className="ds-input w-16 text-xs text-center" type="number" value={d.qty}
                    onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <button onClick={handleComplete} disabled={actionLoading} className="ds-btn text-sm">{actionLoading ? "..." : "Подтвердить"}</button>
                <button onClick={() => setShowComplete(false)} className="ds-btn-secondary text-sm">Отмена</button>
              </div>
            </div>
          )}

          {/* Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ds-text-faint)" }}>Файлы ({work.files.length})</h4>
              {!isCompleted && <button onClick={handleFileUpload} className="ds-btn-secondary text-xs px-3 py-1.5">+ Добавить файл</button>}
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
          </div>
          {/* Right column — overlay preview */}
          {!isMobile && (
            <div className="min-w-0" style={{ flex: "1 1 0%", maxWidth: 320 }}>
              <WorkMaskPreview workId={workId} />
            </div>
          )}
          </div>
          {/* Mobile — preview below */}
          {isMobile && (
            <div className="mt-4">
              <WorkMaskPreview workId={workId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 text-right" style={{ color: "var(--ds-text-faint)" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ds-border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] w-12" style={{ color: "var(--ds-text-faint)" }}>{val}/{max}</span>
    </div>
  );
}
