import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, compositeKey, hasLinkedChildren, isChildLocked } from "@/hooks/useDictLinks";
import { useMobile } from "@/lib/MobileContext";
import { useOverlays } from "@/hooks/useOverlays";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import CreateOrderModal from "@/components/materials/CreateOrderModal";
import PolygonDrawer from "@/components/plan/PolygonDrawer";
import type { Point } from "@/components/plan/SnapEngine";
import { useCellMasks } from "@/hooks/useCellMasks";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useAxisCalibration } from "@/hooks/useAxisCalibration";
import { detectAxesForPolygons } from "@/lib/axisDetection";

interface NomenclatureItem { id: string; name: string; unit_id?: string }
interface UnitItem { id: string; short_name: string; name: string }
interface MaterialRow {
  key: number; material_name: string; material_id: string | null;
  unit_id: string; unit_name: string; required_qty: string;
}
interface AvailableOrder {
  order_item_id: string; material_name: string; unit_short: string;
  order_id: string; order_number: string; available_qty: number;
}
interface SelectedOrder { order_item_id: string; qty: string }
interface Props { onClose: () => void; onCreated: () => void }

let rowKey = 0;
function emptyRow(): MaterialRow {
  return { key: ++rowKey, material_name: "", material_id: null, unit_id: "", unit_name: "", required_qty: "" };
}

export default function CreateWorkModal({ onClose, onCreated }: Props) {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const { buildings, floors, workTypes, constructions } = useDictionaries();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors } = useDictLinks();
  const { overlays, workTypeOverlays, overlayBuildings } = useOverlays();
  const { getColorKey } = useProjectStatuses();

  // Location
  const [selBuilding, setSelBuilding] = useState("");
  const [selWorkType, setSelWorkType] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selConstruction, setSelConstruction] = useState("");
  const [plannedDate, setPlannedDate] = useState("");

  // Overlay & mask
  const [overlayIdForMasks, setOverlayIdForMasks] = useState<string | null>(null);
  const { masks: existingCellMasks } = useCellMasks(overlayIdForMasks);
  const { calibratedAxes, axisOrder } = useAxisCalibration(overlayIdForMasks);
  const [linkedOverlay, setLinkedOverlay] = useState<{ id: string; name: string; width: number; height: number; storage_path: string } | null>(null);
  const [overlayUrl, setOverlayUrl] = useState("");
  const [showOverlayEditor, setShowOverlayEditor] = useState(false);
  const [drawnPolygons, setDrawnPolygons] = useState<Point[][]>([]);

  // Автоопределение осей при отрисовке полигонов
  const detectedAxisLabel = useMemo(() => {
    if (drawnPolygons.length === 0 || calibratedAxes.length === 0) return null;
    return detectAxesForPolygons(drawnPolygons, calibratedAxes, axisOrder);
  }, [drawnPolygons, calibratedAxes, axisOrder]);

  // Автозаполнение примечания при изменении осей
  useEffect(() => {
    setNotes((prev) => {
      const cleaned = prev
        .replace(/,?\s*в осях\s+[^\n]*/g, '')
        .replace(/,?\s*возле оси\s+[^\n]*/g, '')
        .replace(/,?\s*область находится за пределами строительных осей/g, '')
        .trim();
      if (!detectedAxisLabel) return cleaned;
      return cleaned ? `${cleaned}, ${detectedAxisLabel}` : detectedAxisLabel;
    });
  }, [detectedAxisLabel]);

  // Materials
  const [items, setItems] = useState<MaterialRow[]>([emptyRow()]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [nResults, setNResults] = useState<Record<number, NomenclatureItem[]>>({});
  const [nOpen, setNOpen] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Orders selection
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, SelectedOrder>>({});
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Files, notes, submit
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cascade filters
  const filteredWorkTypes = filterChildren(workTypes, buildingWorkTypes, selBuilding || null);
  const floorKey = compositeKey(selBuilding, selWorkType);
  const filteredFloors = filterChildren(floors, buildingWorkTypeFloors, floorKey);
  const filteredConstructions = filterChildren(constructions, workTypeConstructions, selWorkType || null);
  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showConstructions = !isChildLocked(workTypeConstructions, selWorkType || null);

  // Load units
  useEffect(() => {
    if (!project) return;
    api.get<UnitItem[]>("/api/materials/units", { project_id: project.id }).then((r) => {
      if (r.data) setUnits(r.data);
    });
  }, [project]);

  // Load overlay when location changes
  useEffect(() => {
    if (!selWorkType) { setLinkedOverlay(null); setOverlayUrl(""); setDrawnPolygons([]); return; }
    const linkedIds = workTypeOverlays[selWorkType] || [];
    const match = overlays.find((o) => {
      if (!linkedIds.includes(o.id)) return false;
      if (selBuilding) {
        const bldIds = overlayBuildings[o.id] || [];
        if (bldIds.length > 0 && !bldIds.includes(selBuilding)) return false;
      }
      return true;
    });
    if (match) {
      setLinkedOverlay({ id: match.id, name: match.name, width: match.width || 1000, height: match.height || 750, storage_path: match.storage_path });
      setOverlayIdForMasks(match.id);
      getOverlayUrl(match.storage_path).then(setOverlayUrl);
    } else {
      setLinkedOverlay(null);
      setOverlayIdForMasks(null);
      setOverlayUrl("");
    }
    setDrawnPolygons([]);
  }, [selBuilding, selWorkType, overlays, workTypeOverlays, overlayBuildings]);

  // Load available orders when items change
  useEffect(() => {
    if (!project) return;
    const validNames = items.filter(it => it.material_name).map(it => it.material_name.toLowerCase());
    if (validNames.length === 0) { setAvailableOrders([]); return; }
    api.get<AvailableOrder[]>("/api/installation/available-materials", { project_id: project.id })
      .then((r) => { if (r.data) setAvailableOrders(r.data); });
  }, [project, items]);

  // Nomenclature search
  const searchNomenclature = useCallback((key: number, q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q || q.length < 2 || !project) { setNResults(p => ({ ...p, [key]: [] })); return; }
    searchTimer.current = setTimeout(async () => {
      const r = await api.get<NomenclatureItem[]>("/api/materials/nomenclature", { project_id: project.id, q });
      if (r.data) setNResults(p => ({ ...p, [key]: r.data! }));
    }, 300);
  }, [project]);

  const updateItem = (key: number, field: keyof MaterialRow, value: string) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, [field]: value } : it));
  };

  const selectNomenclature = (key: number, item: NomenclatureItem) => {
    setItems(prev => prev.map(it => it.key === key
      ? { ...it, material_name: item.name, material_id: item.id, unit_id: item.unit_id || it.unit_id }
      : it));
    setNOpen(null);
    setNResults(p => ({ ...p, [key]: [] }));
  };

  const removeItem = (key: number) => {
    setItems(prev => { const n = prev.filter(it => it.key !== key); return n.length === 0 ? [emptyRow()] : n; });
  };

  const validItems = items.filter(it => it.material_name && it.required_qty && Number(it.required_qty) > 0);

  const getOrdersForMaterial = (name: string) =>
    availableOrders.filter(ao => ao.material_name.toLowerCase() === name.toLowerCase());

  const toggleOrder = (orderItemId: string, availQty: number) => {
    setSelectedOrders(prev => {
      if (prev[orderItemId]) { const n = { ...prev }; delete n[orderItemId]; return n; }
      return { ...prev, [orderItemId]: { order_item_id: orderItemId, qty: String(availQty) } };
    });
  };

  const updateOrderQty = (id: string, qty: string) => {
    setSelectedOrders(prev => ({ ...prev, [id]: { ...prev[id], qty } }));
  };

  // Validation: total selected per material must equal required
  const getMaterialBalance = (mat: MaterialRow) => {
    const required = Number(mat.required_qty) || 0;
    const orders = getOrdersForMaterial(mat.material_name);
    let selected = 0;
    for (const o of orders) {
      if (selectedOrders[o.order_item_id]) selected += Number(selectedOrders[o.order_item_id].qty) || 0;
    }
    return { required, selected, balanced: selected === required };
  };

  const allBalanced = validItems.length > 0 && validItems.every(it => getMaterialBalance(it).balanced);

  const canSubmit = allBalanced && drawnPolygons.length > 0 && linkedOverlay;

  const handleSubmit = async () => {
    if (!project) return;
    if (drawnPolygons.length === 0) { setError("Необходимо отметить область на подложке"); return; }
    if (validItems.length === 0) { setError("Добавьте материалы"); return; }
    if (!allBalanced) { setError("Количество выбранных материалов должно совпадать с необходимым"); return; }

    setLoading(true);
    setError(null);

    const materials = Object.values(selectedOrders)
      .filter(so => Number(so.qty) > 0)
      .map(so => ({ order_item_id: so.order_item_id, required_qty: Number(so.qty) }));

    const res = await api.post("/api/installation/works", {
      project_id: project.id,
      building_id: selBuilding || null,
      work_type_id: selWorkType || null,
      floor_id: selFloor || null,
      construction_id: selConstruction || null,
      planned_date: plannedDate || null,
      notes: notes || null,
      materials,
    });

    if (res.error) { setError(res.error); setLoading(false); return; }

    // Save masks
    if (drawnPolygons.length > 0 && linkedOverlay && res.data) {
      const workId = (res.data as { id: string }).id;
      for (const poly of drawnPolygons) {
        await api.post("/api/installation/masks", {
          work_id: workId, overlay_id: linkedOverlay.id, polygon_points: poly,
        });
      }
    }

    // Upload files
    if (files.length > 0 && res.data) {
      const workId = (res.data as { id: string }).id;
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("work_id", workId);
        await api.upload("/api/installation/files", fd);
      }
    }

    setLoading(false);
    onCreated();
  };

  // Fullscreen PolygonDrawer
  if (showOverlayEditor && linkedOverlay && overlayUrl) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--ds-surface)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Отметить области на подложке</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
              {linkedOverlay.name}
              {drawnPolygons.length > 0 && (
                <span className="ml-2 font-medium" style={{ color: "var(--ds-accent)" }}>
                  Нарисовано областей: {drawnPolygons.length}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowOverlayEditor(false)} className="ds-btn px-3 py-1.5 text-sm">Готово</button>
            <button onClick={() => setShowOverlayEditor(false)} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <PolygonDrawer
            imageUrl={overlayUrl}
            imageWidth={linkedOverlay.width}
            imageHeight={linkedOverlay.height}
            existingMasks={existingCellMasks}
            newPolygons={drawnPolygons}
            onRemovePolygon={(index) => setDrawnPolygons(p => p.filter((_, i) => i !== index))}
            getColorKey={getColorKey}
            onComplete={(points) => setDrawnPolygons(p => [...p, points])}
            onCancel={() => setShowOverlayEditor(false)}
            fullscreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ maxWidth: isMobile ? "100%" : "700px", maxHeight: "90vh", background: "var(--ds-surface)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <h3 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Новая работа</h3>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* === Место === */}
          <Section title="Место и дата">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Здание" value={selBuilding} onChange={(v) => { setSelBuilding(v); setSelWorkType(""); setSelFloor(""); setSelConstruction(""); }}
                options={buildings} />
              <Select label="Вид работ" value={selWorkType} onChange={(v) => { setSelWorkType(v); setSelFloor(""); setSelConstruction(""); }}
                options={filteredWorkTypes} disabled={!selBuilding} />
              {showFloors && <Select label="Уровень" value={selFloor} onChange={setSelFloor} options={filteredFloors} />}
              {showConstructions && <Select label="Конструкция" value={selConstruction} onChange={setSelConstruction} options={filteredConstructions} />}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Плановая дата</label>
              <input type="date" className="ds-input" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} />
            </div>
          </Section>

          {/* === Подложка и область === */}
          {linkedOverlay && overlayUrl && (
            <div className="border rounded-lg p-3" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">{linkedOverlay.name}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {drawnPolygons.length > 0
                        ? `Отмечено областей: ${drawnPolygons.length}`
                        : <>Необходимо отметить области на плане <span style={{ color: "#ef4444" }}>*</span></>}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowOverlayEditor(true)} className="ds-btn px-3 py-1.5 text-xs whitespace-nowrap">
                  {drawnPolygons.length > 0 ? "Изменить области" : "Отметить области"}
                </button>
              </div>
              {drawnPolygons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {drawnPolygons.map((poly, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                      Область {i + 1} ({poly.length} т.)
                      <button type="button" onClick={() => setDrawnPolygons(p => p.filter((_, j) => j !== i))} style={{ color: "var(--ds-text-faint)" }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === Материалы === */}
          <Section title="Необходимые материалы">
            {items.map((it) => (
              <div key={it.key} className="flex items-center gap-2 mb-2">
                <div className="flex-1 relative">
                  <input className="ds-input text-sm" placeholder="Номенклатура..."
                    value={it.material_name}
                    onChange={e => { updateItem(it.key, "material_name", e.target.value); searchNomenclature(it.key, e.target.value); setNOpen(it.key); }}
                    onFocus={() => setNOpen(it.key)} />
                  {nOpen === it.key && (nResults[it.key] || []).length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg shadow-lg border max-h-40 overflow-y-auto"
                      style={{ background: "var(--ds-surface)", borderColor: "var(--ds-border)" }}>
                      {nResults[it.key].map(n => (
                        <button key={n.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--ds-surface-sunken)]"
                          onClick={() => selectNomenclature(it.key, n)}>{n.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <select className="ds-input w-24 text-sm" value={it.unit_id}
                  onChange={e => { const u = units.find(u => u.id === e.target.value); updateItem(it.key, "unit_id", e.target.value); if (u) updateItem(it.key, "unit_name", u.short_name); }}>
                  <option value="">Ед.</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.short_name}</option>)}
                </select>
                <input className="ds-input w-20 text-sm text-center" type="number" min="0" step="0.01" placeholder="Кол-во"
                  value={it.required_qty} onChange={e => updateItem(it.key, "required_qty", e.target.value)} />
                <button onClick={() => removeItem(it.key)} className="ds-icon-btn shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button onClick={() => setItems(p => [...p, emptyRow()])} className="ds-btn-secondary text-xs px-3 py-1.5">+ Добавить материал</button>
          </Section>

          {/* === Выбор заявок === */}
          {validItems.length > 0 && (
            <Section title="Выбор заявок">
              {validItems.map(mat => {
                const orders = getOrdersForMaterial(mat.material_name);
                const { required, selected, balanced } = getMaterialBalance(mat);
                return (
                  <div key={mat.key} className="mb-4 p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{mat.material_name}</span>
                      <span className="text-xs" style={{ color: balanced ? "#22c55e" : "#ef4444" }}>
                        {selected}/{required} {mat.unit_name} {balanced ? "✓" : "✗"}
                      </span>
                    </div>
                    {orders.length > 0 ? orders.map(o => (
                      <div key={o.order_item_id} className="flex items-center gap-2 mb-1">
                        <input type="checkbox" checked={!!selectedOrders[o.order_item_id]}
                          onChange={() => toggleOrder(o.order_item_id, Math.min(o.available_qty, required - selected + (Number(selectedOrders[o.order_item_id]?.qty) || 0)))} />
                        <span className="text-xs flex-1" style={{ color: "var(--ds-text-muted)" }}>
                          Заявка №{o.order_number} (доступно: {o.available_qty} {o.unit_short})
                        </span>
                        {selectedOrders[o.order_item_id] && (
                          <input className="ds-input w-16 text-xs text-center" type="number" min="0"
                            max={o.available_qty}
                            value={selectedOrders[o.order_item_id].qty}
                            onChange={e => updateOrderQty(o.order_item_id, e.target.value)} />
                        )}
                      </div>
                    )) : (
                      <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Нет заявок с этим материалом</p>
                    )}
                    <button onClick={() => setShowOrderModal(true)} className="ds-btn-secondary text-xs px-2 py-1 mt-1">Заказать ещё</button>
                  </div>
                );
              })}
            </Section>
          )}

          {/* === Файлы === */}
          <Section title="Файлы">
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: "var(--ds-surface-sunken)" }}>
                  {f.name}
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
              <button type="button" className="ds-btn-secondary text-xs px-3 py-1.5" onClick={() => {
                const input = document.createElement("input"); input.type = "file"; input.multiple = true;
                input.onchange = (e) => { const t = e.target as HTMLInputElement; if (t.files) setFiles(p => [...p, ...Array.from(t.files!)]); };
                input.click();
              }}>+ Добавить файл</button>
            </div>
          </Section>

          {/* === Примечание === */}
          <Section title="Примечание">
            <textarea className="ds-input w-full text-sm" rows={3} placeholder="Комментарий к работе..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </Section>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--ds-border)" }}>
          <button onClick={onClose} className="ds-btn-secondary text-sm">Отмена</button>
          <button onClick={handleSubmit} disabled={loading || !canSubmit} className="ds-btn text-sm">
            {loading ? "Создание..." : "Создать работу"}
          </button>
        </div>
      </div>

      {/* Nested order modal */}
      {showOrderModal && (
        <CreateOrderModal
          onClose={() => setShowOrderModal(false)}
          prefill={{
            building_id: selBuilding || undefined,
            work_type_id: selWorkType || undefined,
            floor_id: selFloor || undefined,
            construction_id: selConstruction || undefined,
            items: validItems.map(it => ({
              material_name: it.material_name,
              unit_id: it.unit_id,
              unit_name: it.unit_name,
              quantity: it.required_qty,
            })),
          }}
          onCreated={() => {
            setShowOrderModal(false);
            if (project) {
              api.get<AvailableOrder[]>("/api/installation/available-materials", { project_id: project.id })
                .then(r => { if (r.data) setAvailableOrders(r.data); });
            }
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ds-text-faint)" }}>{title}</h4>
      {children}
    </div>
  );
}

function Select({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; name: string }[]; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>{label}</label>
      <select className="ds-input w-full text-sm" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
        <option value="">—</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
