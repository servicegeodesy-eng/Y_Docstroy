import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { formatSize, downloadStorage } from "@/lib/utils";
import type { WorkMaterial } from "./WorkCard";
import WorkMaskPreview from "./WorkMaskPreview";

interface WorkFile { id: string; file_name: string; storage_path: string; file_size: number; category: string; created_at: string }
interface WorkDocument { id: string; file_name: string; storage_path: string; file_size: number; manual_tag: string | null; notes: string | null; created_at: string; last_name?: string; first_name?: string }
interface WorkData {
  id: string; status: string;
  building_id: string | null; work_type_id: string | null;
  floor_id: string | null; construction_id: string | null;
  building_name: string; work_type_name: string;
  floor_name: string | null; construction_name: string | null;
  planned_date: string; started_at: string | null; completed_at: string | null;
  notes: string | null; manual_tag: string | null; progress: number;
  materials: WorkMaterial[]; files: WorkFile[]; documents: WorkDocument[];
}
interface Props { workId: string; onClose: () => void; onUpdated: () => void }

export default function WorkDetailModal({ workId, onClose, onUpdated }: Props) {
  const { isProjectAdmin, isPortalAdmin } = useProject();
  const { isMobile } = useMobile();
  const { buildings, workTypes, floors, constructions } = useDictionaries();
  const [work, setWork] = useState<WorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = isProjectAdmin || isPortalAdmin;
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ building_id: "", work_type_id: "", floor_id: "", construction_id: "", planned_date: "", notes: "", manual_tag: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Фиксация поступления
  const [deliveryMat, setDeliveryMat] = useState<string | null>(null);
  const [deliveryQty, setDeliveryQty] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);

  // Фиксация процесса
  const [usageMat, setUsageMat] = useState<string | null>(null);
  const [usageQty, setUsageQty] = useState("");
  const [usageFiles, setUsageFiles] = useState<File[]>([]);

  // Завершение
  const [showComplete, setShowComplete] = useState(false);
  const [completionComment, setCompletionComment] = useState("");
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [dispositions, setDispositions] = useState<{ id: string; name: string; unit: string; surplus: number; action: "returned" | "scrap"; qty: string; notes: string }[]>([]);
  const [deficits, setDeficits] = useState<{ id: string; name: string; unit: string; deficit: number; adjustQty: string; comment: string }[]>([]);

  // Документы (после завершения)
  const [docTag, setDocTag] = useState("");
  const [docNotes, setDocNotes] = useState("");

  const loadWork = useCallback(async () => {
    setLoading(true);
    const res = await api.get<WorkData>(`/api/installation/works/${workId}`);
    if (res.data) {
      const d = res.data;
      setWork({
        ...d,
        progress: Number(d.progress) || 0,
        materials: ((d.materials || []) as unknown as Record<string, unknown>[]).map(m => ({
          id: (m.id || "") as string,
          order_item_id: (m.order_item_id || "") as string,
          material_name: (m.material_name || "") as string,
          unit_short: (m.unit_short || "") as string,
          required_qty: Number(m.required_qty) || 0,
          available_qty: Number(m.effective_available ?? m.available_qty) || 0,
          used_qty: Number(m.used_qty) || 0,
        })),
        files: d.files || [],
        documents: d.documents || [],
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
    loadWork(); onUpdated();
  }

  function startEditing() {
    if (!work) return;
    setEditData({
      building_id: work.building_id || "", work_type_id: work.work_type_id || "",
      floor_id: work.floor_id || "", construction_id: work.construction_id || "",
      planned_date: work.planned_date || "", notes: work.notes || "", manual_tag: work.manual_tag || "",
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

  // Фиксация поступления
  async function handleDelivery(matId: string) {
    const qty = Number(deliveryQty) || 0;
    if (qty <= 0) return;
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/deliver-material`, { installation_material_id: matId, quantity: qty });
    // Загрузка файлов поступления
    for (const file of deliveryFiles) {
      const fd = new FormData(); fd.append("file", file); fd.append("work_id", workId); fd.append("category", "delivery");
      await api.upload("/api/installation/files", fd);
    }
    setDeliveryQty(""); setDeliveryFiles([]); setDeliveryMat(null);
    setActionLoading(false);
    loadWork(); onUpdated();
  }

  // Фиксация процесса (использование)
  async function handleUseMaterial(matId: string) {
    const qty = Number(usageQty) || 0;
    if (qty <= 0) return;
    const mat = work!.materials.find(m => m.id === matId);
    if (mat && Number(mat.used_qty) + qty > mat.available_qty) {
      alert(`Использовано не может превысить поступление (${mat.available_qty})`);
      return;
    }
    setActionLoading(true);
    await api.post(`/api/installation/works/${workId}/use-material`, { installation_material_id: matId, quantity: qty });
    for (const file of usageFiles) {
      const fd = new FormData(); fd.append("file", file); fd.append("work_id", workId); fd.append("category", "usage");
      await api.upload("/api/installation/files", fd);
    }
    setUsageQty(""); setUsageFiles([]); setUsageMat(null);
    setActionLoading(false);
    loadWork(); onUpdated();
  }

  // Подготовка завершения
  function prepareComplete() {
    setCompletionComment(""); setCompletionFiles([]);
    // Излишки: поступивших больше необходимого
    setDispositions(work!.materials
      .filter(m => m.available_qty > m.required_qty)
      .map(m => ({
        id: m.order_item_id || m.id, name: m.material_name, unit: m.unit_short,
        surplus: m.available_qty - m.required_qty,
        action: "returned" as const, qty: String(m.available_qty - m.required_qty), notes: "",
      })));
    // Дефициты: поступивших меньше необходимого
    setDeficits(work!.materials
      .filter(m => m.available_qty < m.required_qty)
      .map(m => ({
        id: m.id, name: m.material_name, unit: m.unit_short,
        deficit: m.required_qty - m.available_qty,
        adjustQty: String(m.available_qty), comment: "",
      })));
    setShowComplete(true);
  }

  async function handleComplete() {
    setActionLoading(true);
    // Корректировка необходимого для дефицитных материалов
    for (const d of deficits) {
      if (d.adjustQty && Number(d.adjustQty) !== (work!.materials.find(m => m.id === d.id)?.required_qty || 0)) {
        await api.post(`/api/installation/works/${workId}/adjust-required`, {
          installation_material_id: d.id, new_required_qty: Number(d.adjustQty),
        });
      }
    }
    await api.post(`/api/installation/works/${workId}/complete`, {
      completion_comment: completionComment || null,
      dispositions: dispositions.map(d => ({ order_item_id: d.id, quantity: Number(d.qty) || 0, disposition: d.action, notes: d.notes || null })),
    });
    for (const file of completionFiles) {
      const fd = new FormData(); fd.append("file", file); fd.append("work_id", workId); fd.append("category", "completion");
      await api.upload("/api/installation/files", fd);
    }
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

  // Документ завершения
  async function handleDocumentUpload() {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true;
    input.onchange = async (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.files) return;
      for (const file of Array.from(t.files)) {
        const fd = new FormData();
        fd.append("file", file); fd.append("work_id", workId);
        if (docTag) fd.append("manual_tag", docTag);
        if (docNotes) fd.append("notes", docNotes);
        await api.upload("/api/installation/documents", fd);
      }
      setDocTag(""); setDocNotes("");
      loadWork();
    };
    input.click();
  }

  async function handleDeleteDoc(docId: string) {
    await api.delete(`/api/installation/documents/${docId}`);
    loadWork();
  }

  function pickFiles(setter: React.Dispatch<React.SetStateAction<File[]>>) {
    const input = document.createElement("input"); input.type = "file"; input.multiple = true;
    input.onchange = (e) => { const t = e.target as HTMLInputElement; if (t.files) setter(p => [...p, ...Array.from(t.files!)]); };
    input.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ maxWidth: isMobile ? "100%" : "900px", maxHeight: "90vh", background: "var(--ds-surface)" }}>

        {/* Header — как в реестре */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-lg font-semibold truncate" style={{ color: "var(--ds-text)" }}>Работа</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
              style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor }}>
              {statusLabel}
            </span>
            {work.manual_tag && (
              <span className="px-2 py-0.5 rounded text-xs shrink-0" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                {work.manual_tag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isPlanned && isAdmin && !editing && (
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`${isMobile ? "" : "flex gap-6"}`}>
          {/* Левая колонка — информация + материалы + файлы */}
          <div className={`space-y-5 ${isMobile ? "" : "flex-1 min-w-0"}`}>

          {/* === Информация / Редактирование === */}
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Место</label>
                  <select className="ds-input w-full text-sm" value={editData.building_id} onChange={e => setEditData(d => ({ ...d, building_id: e.target.value }))}>
                    <option value="">—</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Вид работ</label>
                  <select className="ds-input w-full text-sm" value={editData.work_type_id} onChange={e => setEditData(d => ({ ...d, work_type_id: e.target.value }))}>
                    <option value="">—</option>{workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Уровень</label>
                  <select className="ds-input w-full text-sm" value={editData.floor_id} onChange={e => setEditData(d => ({ ...d, floor_id: e.target.value }))}>
                    <option value="">—</option>{floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Конструкция</label>
                  <select className="ds-input w-full text-sm" value={editData.construction_id} onChange={e => setEditData(d => ({ ...d, construction_id: e.target.value }))}>
                    <option value="">—</option>{constructions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Плановая дата</label>
                  <input type="date" className="ds-input text-sm" value={editData.planned_date} min={new Date().toISOString().slice(0, 10)} onChange={e => setEditData(d => ({ ...d, planned_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Метка</label>
                  <input className="ds-input text-sm" value={editData.manual_tag} onChange={e => setEditData(d => ({ ...d, manual_tag: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-faint)" }}>Описание</label>
                <textarea className="ds-input w-full text-sm" rows={2} value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={actionLoading} className="ds-btn text-xs px-4 py-1.5">{actionLoading ? "..." : "Сохранить"}</button>
                <button onClick={() => setEditing(false)} className="ds-btn-secondary text-xs px-4 py-1.5">Отмена</button>
              </div>
            </div>
          ) : (
            <>
              {/* Инфо-блок как в реестре */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Место</span><p style={{ color: "var(--ds-text)" }}>{location}</p></div>
                <div>
                  <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Плановая дата</span>
                  <p style={{ color: "var(--ds-text)" }}>{work.planned_date ? new Date(work.planned_date).toLocaleDateString("ru") : "—"}</p>
                </div>
                {work.started_at && <div><span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Начато</span><p style={{ color: "var(--ds-text)" }}>{new Date(work.started_at).toLocaleString("ru")}</p></div>}
                {work.completed_at && <div><span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Завершено</span><p style={{ color: "var(--ds-text)" }}>{new Date(work.completed_at).toLocaleString("ru")}</p></div>}
              </div>
              {work.notes && <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{work.notes}</p>}

              {/* Кнопка начать процесс */}
              {isPlanned && (
                <button onClick={handleStart} disabled={actionLoading} className="ds-btn text-sm w-full py-2.5">
                  {actionLoading ? "..." : "Начать процесс"}
                </button>
              )}
            </>
          )}

          {/* === Материалы === */}
          {work.materials.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ds-text-faint)" }}>Материалы</h4>
              <div className="space-y-2">
                {work.materials.map(mat => (
                  <div key={mat.id} className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{mat.material_name}</span>
                      <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
                        {mat.used_qty}/{mat.available_qty}/{mat.required_qty} {mat.unit_short}
                      </span>
                    </div>
                    <div className="space-y-0.5 mb-2">
                      <Bar label="Нужно" val={mat.required_qty} max={mat.required_qty} color="#9ca3af" />
                      <Bar label="Поступило" val={mat.available_qty} max={Math.max(mat.required_qty, mat.available_qty)} color="#22c55e" />
                      <Bar label="Использовано" val={mat.used_qty} max={Math.max(mat.required_qty, mat.available_qty)} color="#f59e0b" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Кнопки действий (только в процессе) === */}
          {isInProgress && !showComplete && (
            <div className="space-y-3">
              {/* Зафиксировать поступление */}
              {deliveryMat ? (
                <div className="p-4 rounded-lg" style={{ background: "color-mix(in srgb, #22c55e 8%, var(--ds-surface))", border: "1px solid color-mix(in srgb, #22c55e 30%, var(--ds-border))" }}>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: "#16a34a" }}>Зафиксировать поступление</h4>
                  <select className="ds-input w-full text-sm mb-2" value={deliveryMat} onChange={e => setDeliveryMat(e.target.value)}>
                    {work.materials.map(m => <option key={m.id} value={m.id}>{m.material_name} ({m.unit_short})</option>)}
                  </select>
                  <input className="ds-input w-full text-sm mb-2" type="number" min="0" step="0.01" placeholder="Количество поступления"
                    value={deliveryQty} onChange={e => setDeliveryQty(e.target.value)} />
                  <FileChips files={deliveryFiles} onRemove={i => setDeliveryFiles(p => p.filter((_, j) => j !== i))} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => pickFiles(setDeliveryFiles)} className="ds-btn-secondary text-xs px-3 py-1.5">+ Файл</button>
                    <div className="flex-1" />
                    <button onClick={() => handleDelivery(deliveryMat!)} disabled={actionLoading || !deliveryQty} className="ds-btn text-xs px-4 py-1.5">
                      {actionLoading ? "..." : "Зафиксировать"}
                    </button>
                    <button onClick={() => { setDeliveryMat(null); setDeliveryQty(""); setDeliveryFiles([]); }} className="ds-btn-secondary text-xs px-3 py-1.5">Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDeliveryMat(work.materials[0]?.id || "")} className="ds-btn w-full text-sm py-2.5"
                  style={{ background: "#22c55e", color: "#fff" }}>
                  Зафиксировать поступление
                </button>
              )}

              {/* Зафиксировать процесс */}
              {usageMat ? (
                <div className="p-4 rounded-lg" style={{ background: "color-mix(in srgb, #f59e0b 8%, var(--ds-surface))", border: "1px solid color-mix(in srgb, #f59e0b 30%, var(--ds-border))" }}>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: "#d97706" }}>Зафиксировать процесс</h4>
                  <select className="ds-input w-full text-sm mb-2" value={usageMat} onChange={e => setUsageMat(e.target.value)}>
                    {work.materials.map(m => <option key={m.id} value={m.id}>{m.material_name} (осталось: {m.available_qty - m.used_qty} {m.unit_short})</option>)}
                  </select>
                  <input className="ds-input w-full text-sm mb-2" type="number" min="0" step="0.01" placeholder="Количество использовано"
                    value={usageQty} onChange={e => setUsageQty(e.target.value)} />
                  <FileChips files={usageFiles} onRemove={i => setUsageFiles(p => p.filter((_, j) => j !== i))} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => pickFiles(setUsageFiles)} className="ds-btn-secondary text-xs px-3 py-1.5">+ Файл</button>
                    <div className="flex-1" />
                    <button onClick={() => handleUseMaterial(usageMat!)} disabled={actionLoading || !usageQty} className="ds-btn text-xs px-4 py-1.5">
                      {actionLoading ? "..." : "Зафиксировать"}
                    </button>
                    <button onClick={() => { setUsageMat(null); setUsageQty(""); setUsageFiles([]); }} className="ds-btn-secondary text-xs px-3 py-1.5">Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setUsageMat(work.materials[0]?.id || "")} className="ds-btn w-full text-sm py-2.5"
                  style={{ background: "#f59e0b", color: "#fff" }}>
                  Зафиксировать процесс
                </button>
              )}

              {/* Завершить */}
              <button onClick={prepareComplete} disabled={actionLoading}
                className="ds-btn-secondary w-full text-sm py-2.5" style={{ color: "#22c55e", borderColor: "#22c55e" }}>
                Завершить работу
              </button>
            </div>
          )}

          {/* === Завершение === */}
          {showComplete && (
            <div className="p-4 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>Завершение работы</h4>

              {/* Излишки: поступивших больше необходимого */}
              {dispositions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-2" style={{ color: "#16a34a" }}>Излишки материалов (поступивших больше необходимого)</p>
                  {dispositions.map((d, i) => (
                    <div key={d.id} className="mb-2 p-2 rounded" style={{ background: "var(--ds-surface)" }}>
                      <span className="text-sm">{d.name} (излишек: {d.surplus} {d.unit})</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <select className="ds-input flex-1 text-xs" value={d.action}
                          onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, action: e.target.value as "returned" | "scrap" } : x))}>
                          <option value="returned">В остатки</option><option value="scrap">В утиль</option>
                        </select>
                        <input className="ds-input w-16 text-xs text-center" type="number" value={d.qty}
                          onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                      </div>
                      <input className="ds-input w-full text-xs mt-1.5" placeholder="Комментарий..."
                        value={d.notes} onChange={e => setDispositions(p => p.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
              )}

              {/* Дефициты: поступивших меньше необходимого */}
              {deficits.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-2" style={{ color: "#dc2626" }}>Недостаток материалов (поступивших меньше необходимого)</p>
                  {deficits.map((d, i) => (
                    <div key={d.id} className="mb-2 p-2 rounded" style={{ background: "var(--ds-surface)" }}>
                      <span className="text-sm">{d.name} (недостаток: {d.deficit} {d.unit})</span>
                      <div className="mt-1.5">
                        <label className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>Скорректировать необходимое количество:</label>
                        <input className="ds-input w-full text-xs mt-0.5" type="number" value={d.adjustQty}
                          onChange={e => setDeficits(p => p.map((x, j) => j === i ? { ...x, adjustQty: e.target.value } : x))} />
                      </div>
                      <input className="ds-input w-full text-xs mt-1.5" placeholder="Комментарий..."
                        value={d.comment} onChange={e => setDeficits(p => p.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
              )}

              {/* Комментарий */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Комментарий к завершению</label>
                <textarea className="ds-input w-full text-sm" rows={2} value={completionComment} onChange={e => setCompletionComment(e.target.value)} />
              </div>

              {/* Файлы завершения */}
              <FileChips files={completionFiles} onRemove={i => setCompletionFiles(p => p.filter((_, j) => j !== i))} />
              <button onClick={() => pickFiles(setCompletionFiles)} className="ds-btn-secondary text-xs px-3 py-1.5 mt-1">+ Файл</button>

              <div className="flex gap-2 mt-3">
                <button onClick={handleComplete} disabled={actionLoading} className="ds-btn text-sm">{actionLoading ? "..." : "Завершить работу"}</button>
                <button onClick={() => setShowComplete(false)} className="ds-btn-secondary text-sm">Отмена</button>
              </div>
            </div>
          )}

          {/* === Файлы работы (до начала процесса - можно загружать) === */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ds-text-faint)" }}>Файлы ({work.files.length})</h4>
              {isPlanned && <button onClick={handleFileUpload} className="ds-btn-secondary text-xs px-3 py-1.5">+ Добавить файл</button>}
            </div>
            {work.files.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет файлов</p>
            ) : (
              <ul className="space-y-1">
                {work.files.map(f => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className="text-sm flex-1 truncate" style={{ color: "var(--ds-text)" }}>{f.file_name}</span>
                    {f.category && f.category !== "during" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--ds-surface)", color: "var(--ds-text-faint)" }}>
                        {f.category === "delivery" ? "поступление" : f.category === "usage" ? "процесс" : f.category === "completion" ? "завершение" : f.category}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>
                    <button onClick={() => downloadStorage(f.storage_path, f.file_name)} className="ds-icon-btn" title="Скачать">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* === Документы завершения (после завершения) === */}
          {isCompleted && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ds-text-faint)" }}>
                  Документы ({work.documents.length})
                </h4>
              </div>

              {/* Форма добавления документа */}
              <div className="p-3 rounded-lg mb-3" style={{ background: "var(--ds-surface-sunken)" }}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input className="ds-input text-sm" placeholder="Метка документа..." value={docTag} onChange={e => setDocTag(e.target.value)} />
                  <input className="ds-input text-sm" placeholder="Примечание..." value={docNotes} onChange={e => setDocNotes(e.target.value)} />
                </div>
                <button onClick={handleDocumentUpload} className="ds-btn text-xs px-3 py-1.5">+ Прикрепить документ</button>
              </div>

              {work.documents.length > 0 && (
                <ul className="space-y-1">
                  {work.documents.map(doc => (
                    <li key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "var(--ds-surface-sunken)" }}>
                      <span className="text-sm flex-1 truncate" style={{ color: "var(--ds-text)" }}>{doc.file_name}</span>
                      {doc.manual_tag && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                          {doc.manual_tag}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(doc.file_size)}</span>
                      <button onClick={() => downloadStorage(doc.storage_path, doc.file_name)} className="ds-icon-btn" title="Скачать">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                      <button onClick={() => handleDeleteDoc(doc.id)} className="ds-icon-btn hover:!text-red-500" title="Удалить">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          </div>
          {/* Правая колонка — превью подложки */}
          {!isMobile && (
            <div className="min-w-0" style={{ flex: "1 1 0%", maxWidth: 320 }}>
              <WorkMaskPreview workId={workId} />
            </div>
          )}
          </div>
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

function FileChips({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {files.map((f, i) => (
        <span key={i} className="text-xs px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: "var(--ds-surface-sunken)" }}>
          {f.name}
          <button onClick={() => onRemove(i)}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </span>
      ))}
    </div>
  );
}
