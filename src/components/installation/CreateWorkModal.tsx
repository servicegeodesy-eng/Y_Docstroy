import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, compositeKey, hasLinkedChildren, isChildLocked } from "@/hooks/useDictLinks";
import { useMobile } from "@/lib/MobileContext";
import OverlayMaskStep from "@/components/installation/OverlayMaskStep";
import type { Point } from "@/components/plan/SnapEngine";
import CreateOrderModal from "@/components/materials/CreateOrderModal";

interface NomenclatureItem { id: string; name: string }
interface UnitItem { id: string; name: string }
interface RequiredMaterialRow {
  key: number; material_name: string; material_id: string | null;
  unit_id: string; unit_name: string; required_qty: string;
}
interface AvailableMaterial {
  order_item_id: string; material_name: string; unit_short: string;
  order_id: string; order_number: string; available_qty: number;
}
interface SelectedOrder { order_item_id: string; required_qty: string }
interface Props { onClose: () => void; onCreated: () => void }

let rowCounter = 0;

function emptyRow(): RequiredMaterialRow {
  return { key: ++rowCounter, material_name: "", material_id: null, unit_id: "", unit_name: "", required_qty: "" };
}

export default function CreateWorkModal({ onClose, onCreated }: Props) {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const { buildings, floors, workTypes, constructions } = useDictionaries();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors } = useDictLinks();

  const [step, setStep] = useState(1);

  // Step 1: Location
  const [selBuilding, setSelBuilding] = useState("");
  const [selWorkType, setSelWorkType] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selConstruction, setSelConstruction] = useState("");
  const [plannedDate, setPlannedDate] = useState("");

  // Step 2: Overlay mask
  const [selOverlayId, setSelOverlayId] = useState("");
  const [drawnPolygons, setDrawnPolygons] = useState<Point[][]>([]);

  // Step 3: Required materials
  const [items, setItems] = useState<RequiredMaterialRow[]>([emptyRow()]);
  const [nSearches, setNSearches] = useState<Record<number, string>>({});
  const [nResults, setNResults] = useState<Record<number, NomenclatureItem[]>>({});
  const [nOpen, setNOpen] = useState<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);

  // Step 4: Available orders
  const [availableMaterials, setAvailableMaterials] = useState<AvailableMaterial[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, SelectedOrder>>({});
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Step 5: Notes & submit
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cascaded dictionaries
  const filteredWorkTypes = filterChildren(workTypes, buildingWorkTypes, selBuilding || null);
  const floorKey = compositeKey(selBuilding, selWorkType);
  const filteredFloors = filterChildren(floors, buildingWorkTypeFloors, floorKey);
  const filteredConstructions = filterChildren(constructions, workTypeConstructions, selWorkType || null);
  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showConstructions = !isChildLocked(workTypeConstructions, selWorkType || null);
  const workTypeDisabled = !selBuilding || isChildLocked(buildingWorkTypes, selBuilding || null);

  useEffect(() => {
    if (!project) return;
    api.get<UnitItem[]>("/api/materials/units", { project_id: project.id }).then((r) => {
      if (r.data) setUnits(r.data);
    });
  }, [project]);

  const searchNomenclature = useCallback((key: number, q: string) => {
    setNSearches((prev) => ({ ...prev, [key]: q }));
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q || q.length < 2 || !project) {
      setNResults((prev) => ({ ...prev, [key]: [] }));
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const r = await api.get<NomenclatureItem[]>("/api/materials/nomenclature", {
        project_id: project.id, q,
      });
      if (r.data) setNResults((prev) => ({ ...prev, [key]: r.data! }));
    }, 300);
  }, [project]);

  const updateItem = (key: number, field: keyof RequiredMaterialRow, value: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  };

  const selectNomenclature = (key: number, item: NomenclatureItem) => {
    setItems((prev) =>
      prev.map((it) => it.key === key ? { ...it, material_name: item.name, material_id: item.id } : it)
    );
    setNOpen(null);
    setNResults((prev) => ({ ...prev, [key]: [] }));
  };

  const removeItem = (key: number) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.key !== key);
      return next.length === 0 ? [emptyRow()] : next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, emptyRow()]);

  const fetchAvailableMaterials = useCallback(async () => {
    if (!project) return;
    setLoadingAvailable(true);
    const r = await api.get<AvailableMaterial[]>("/api/installation/available-materials", { project_id: project.id });
    if (r.data) setAvailableMaterials(r.data);
    setLoadingAvailable(false);
  }, [project]);

  const validItems = items.filter((it) => it.material_name && it.required_qty && Number(it.required_qty) > 0);

  const getOrdersForMaterial = (materialName: string): AvailableMaterial[] => {
    const lower = materialName.toLowerCase();
    return availableMaterials.filter((am) => am.material_name.toLowerCase() === lower);
  };

  const toggleOrderSelection = (orderItemId: string, availableQty: number) => {
    setSelectedOrders((prev) => {
      if (prev[orderItemId]) { const next = { ...prev }; delete next[orderItemId]; return next; }
      return { ...prev, [orderItemId]: { order_item_id: orderItemId, required_qty: String(availableQty) } };
    });
  };

  const updateOrderQty = (orderItemId: string, qty: string) => {
    setSelectedOrders((prev) => ({ ...prev, [orderItemId]: { ...prev[orderItemId], required_qty: qty } }));
  };

  const goToStep2 = () => {
    setError(null);
    if (!plannedDate) { setError("Укажите плановую дату"); return; }
    setStep(2);
  };
  const goToStep3 = () => { setError(null); setStep(3); };
  const goToStep4 = () => {
    setError(null);
    if (validItems.length === 0) { setError("Добавьте хотя бы один материал с количеством"); return; }
    fetchAvailableMaterials();
    setStep(4);
  };
  const goToStep5 = () => { setError(null); setStep(5); };

  const handleSubmit = async () => {
    if (!project) return;
    setLoading(true);
    setError(null);

    const materials = Object.values(selectedOrders)
      .filter((so) => Number(so.required_qty) > 0)
      .map((so) => ({ order_item_id: so.order_item_id, required_qty: Number(so.required_qty) }));

    const body = {
      project_id: project.id,
      building_id: selBuilding || null,
      work_type_id: selWorkType || null,
      floor_id: selFloor || null,
      construction_id: selConstruction || null,
      planned_date: plannedDate,
      notes: notes || null,
      materials,
    };

    const res = await api.post<{ id: string }>("/api/installation/works", body);
    if (res.error) { setError(res.error); setLoading(false); return; }

    if (res.data && drawnPolygons.length > 0 && selOverlayId) {
      await api.post("/api/installation/masks", {
        work_id: res.data.id, overlay_id: selOverlayId, polygon_points: drawnPolygons,
      });
    }

    setLoading(false);
    onCreated();
  };

  const handleOrderCreated = () => { setShowOrderModal(false); fetchAvailableMaterials(); };

  const stepTitle = ["",
    "Шаг 1: Место и дата",
    "Шаг 2: Область на подложке",
    "Шаг 3: Необходимые материалы",
    "Шаг 4: Выбор заявок",
    "Шаг 5: Создание работы",
  ][step];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div
          className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
          style={{ maxWidth: isMobile ? "100%" : "720px", maxHeight: "90vh", background: "var(--ds-surface)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--ds-border)" }}>
            <div>
              <h3 className="font-semibold text-base" style={{ color: "var(--ds-text)" }}>Новые работы по монтажу</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{stepTitle}</p>
            </div>
            <button className="ds-icon-btn" onClick={onClose}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", color: "#ef4444" }}>
                {error}
              </div>
            )}

            {/* STEP 1: Location */}
            {step === 1 && (
              <Step1Location
                selBuilding={selBuilding} setSelBuilding={setSelBuilding}
                selWorkType={selWorkType} setSelWorkType={setSelWorkType}
                selFloor={selFloor} setSelFloor={setSelFloor}
                selConstruction={selConstruction} setSelConstruction={setSelConstruction}
                plannedDate={plannedDate} setPlannedDate={setPlannedDate}
                buildings={buildings} filteredWorkTypes={filteredWorkTypes}
                filteredFloors={filteredFloors} filteredConstructions={filteredConstructions}
                showFloors={showFloors} showConstructions={showConstructions}
                workTypeDisabled={workTypeDisabled} isMobile={isMobile}
              />
            )}

            {/* STEP 2: Overlay mask */}
            {step === 2 && (
              <OverlayMaskStep
                selBuilding={selBuilding} selFloor={selFloor} selConstruction={selConstruction}
                drawnPolygons={drawnPolygons} onPolygonsChange={setDrawnPolygons}
                selOverlayId={selOverlayId} onOverlayChange={setSelOverlayId}
              />
            )}

            {/* STEP 3: Materials */}
            {step === 3 && (
              <Step3Materials
                items={items} nSearches={nSearches} nResults={nResults} nOpen={nOpen}
                units={units} isMobile={isMobile}
                updateItem={updateItem} searchNomenclature={searchNomenclature}
                selectNomenclature={selectNomenclature} removeItem={removeItem}
                addItem={addItem} setNOpen={setNOpen}
              />
            )}

            {/* STEP 4: Orders */}
            {step === 4 && (
              <Step4Orders
                validItems={validItems} loadingAvailable={loadingAvailable}
                getOrdersForMaterial={getOrdersForMaterial}
                selectedOrders={selectedOrders}
                toggleOrderSelection={toggleOrderSelection}
                updateOrderQty={updateOrderQty}
                setShowOrderModal={setShowOrderModal}
              />
            )}

            {/* STEP 5: Notes */}
            {step === 5 && (
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Примечание</label>
                <textarea className="ds-input text-sm w-full" rows={3} placeholder="Комментарий к работам..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "var(--ds-border)" }}>
            <div>
              {step > 1 && (
                <button className="ds-btn-secondary text-sm px-4 py-2" onClick={() => { setError(null); setStep(step - 1); }} disabled={loading}>
                  Назад
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose} disabled={loading}>Отмена</button>
              {step === 1 && <button className="ds-btn text-sm px-4 py-2" onClick={goToStep2}>Далее</button>}
              {step === 2 && (
                <>
                  <button className="ds-btn-secondary text-sm px-4 py-2" onClick={goToStep3}>Пропустить</button>
                  <button className="ds-btn text-sm px-4 py-2" onClick={goToStep3}>Далее</button>
                </>
              )}
              {step === 3 && <button className="ds-btn text-sm px-4 py-2" onClick={goToStep4}>Далее</button>}
              {step === 4 && <button className="ds-btn text-sm px-4 py-2" onClick={goToStep5}>Далее</button>}
              {step === 5 && (
                <button className="ds-btn text-sm px-4 py-2" onClick={handleSubmit} disabled={loading}>
                  {loading ? "Создание..." : "Создать работу"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showOrderModal && <CreateOrderModal onClose={() => setShowOrderModal(false)} onCreated={handleOrderCreated} />}
    </>
  );
}

/* ============================================================================
   Sub-components for steps (keep modal file lean)
   ============================================================================ */

function Step1Location({
  selBuilding, setSelBuilding, selWorkType, setSelWorkType,
  selFloor, setSelFloor, selConstruction, setSelConstruction,
  plannedDate, setPlannedDate,
  buildings, filteredWorkTypes, filteredFloors, filteredConstructions,
  showFloors, showConstructions, workTypeDisabled, isMobile,
}: {
  selBuilding: string; setSelBuilding: (v: string) => void;
  selWorkType: string; setSelWorkType: (v: string) => void;
  selFloor: string; setSelFloor: (v: string) => void;
  selConstruction: string; setSelConstruction: (v: string) => void;
  plannedDate: string; setPlannedDate: (v: string) => void;
  buildings: { id: string; name: string }[];
  filteredWorkTypes: { id: string; name: string }[];
  filteredFloors: { id: string; name: string }[];
  filteredConstructions: { id: string; name: string }[];
  showFloors: boolean; showConstructions: boolean;
  workTypeDisabled: boolean; isMobile: boolean;
}) {
  return (
    <>
      <div className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Место</label>
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <select className="ds-input text-sm" value={selBuilding}
            onChange={(e) => { setSelBuilding(e.target.value); setSelWorkType(""); setSelFloor(""); setSelConstruction(""); }}>
            <option value="">Место работ...</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="ds-input text-sm" value={selWorkType} disabled={workTypeDisabled}
            onChange={(e) => { setSelWorkType(e.target.value); setSelFloor(""); setSelConstruction(""); }}>
            <option value="">Вид работ...</option>
            {filteredWorkTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {showFloors && (
            <select className="ds-input text-sm" value={selFloor} onChange={(e) => setSelFloor(e.target.value)}>
              <option value="">Уровень...</option>
              {filteredFloors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {showConstructions && (
            <select className="ds-input text-sm" value={selConstruction} onChange={(e) => setSelConstruction(e.target.value)}>
              <option value="">Конструкция...</option>
              {filteredConstructions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
          Плановая дата <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input type="date" className="ds-input text-sm" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
      </div>
    </>
  );
}

function Step3Materials({
  items, nSearches, nResults, nOpen, units, isMobile,
  updateItem, searchNomenclature, selectNomenclature, removeItem, addItem, setNOpen,
}: {
  items: RequiredMaterialRow[];
  nSearches: Record<number, string>;
  nResults: Record<number, NomenclatureItem[]>;
  nOpen: number | null;
  units: UnitItem[];
  isMobile: boolean;
  updateItem: (key: number, field: keyof RequiredMaterialRow, value: string) => void;
  searchNomenclature: (key: number, q: string) => void;
  selectNomenclature: (key: number, item: NomenclatureItem) => void;
  removeItem: (key: number) => void;
  addItem: () => void;
  setNOpen: (v: number | null) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Укажите необходимые материалы</label>
      {items.map((item) => (
        <div key={item.key} className="flex gap-2 items-start">
          <div className="flex-1 relative">
            <input className="ds-input text-sm w-full" placeholder="Наименование материала"
              value={nSearches[item.key] ?? item.material_name}
              onChange={(e) => { updateItem(item.key, "material_name", e.target.value); updateItem(item.key, "material_id", ""); searchNomenclature(item.key, e.target.value); setNOpen(item.key); }}
              onFocus={() => setNOpen(item.key)} onBlur={() => setTimeout(() => setNOpen(null), 200)} />
            {nOpen === item.key && (nResults[item.key] || []).length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg shadow-lg border max-h-40 overflow-y-auto" style={{ background: "var(--ds-surface)", borderColor: "var(--ds-border)" }}>
                {nResults[item.key].map((n) => (
                  <button key={n.id} className="block w-full text-left text-sm px-3 py-2 hover:opacity-80 transition-opacity" style={{ color: "var(--ds-text)" }}
                    onMouseDown={() => selectNomenclature(item.key, n)}>{n.name}</button>
                ))}
              </div>
            )}
          </div>
          <select className="ds-input text-sm" style={{ width: isMobile ? "80px" : "120px" }} value={item.unit_id}
            onChange={(e) => { updateItem(item.key, "unit_id", e.target.value); const u = units.find((u) => u.id === e.target.value); if (u) updateItem(item.key, "unit_name", u.name); }}>
            <option value="">Ед.</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="ds-input text-sm" style={{ width: isMobile ? "70px" : "100px" }} type="number" min="0" step="0.01" placeholder="Кол-во"
            value={item.required_qty} onChange={(e) => updateItem(item.key, "required_qty", e.target.value)} />
          {items.length > 1 && (
            <button className="ds-icon-btn flex-shrink-0 mt-1" onClick={() => removeItem(item.key)} title="Удалить">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button className="ds-btn-secondary text-xs px-3 py-1.5" onClick={addItem}>+ Добавить материал</button>
    </div>
  );
}

function Step4Orders({
  validItems, loadingAvailable, getOrdersForMaterial,
  selectedOrders, toggleOrderSelection, updateOrderQty, setShowOrderModal,
}: {
  validItems: RequiredMaterialRow[];
  loadingAvailable: boolean;
  getOrdersForMaterial: (name: string) => AvailableMaterial[];
  selectedOrders: Record<string, SelectedOrder>;
  toggleOrderSelection: (id: string, qty: number) => void;
  updateOrderQty: (id: string, qty: string) => void;
  setShowOrderModal: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Выберите заявки для каждого материала</label>
      {loadingAvailable ? (
        <div className="py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "var(--ds-accent)" }} />
        </div>
      ) : (
        validItems.map((item) => {
          const orders = getOrdersForMaterial(item.material_name);
          const totalSelected = orders.filter((o) => selectedOrders[o.order_item_id]).reduce((sum, o) => sum + Number(selectedOrders[o.order_item_id]?.required_qty || 0), 0);
          const needed = Number(item.required_qty);
          const shortage = needed - totalSelected;
          return (
            <div key={item.key} className="rounded-lg p-3" style={{ background: "var(--ds-surface-sunken)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{item.material_name}</p>
                <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                  Нужно: {needed} {item.unit_name}{totalSelected > 0 && <> | Выбрано: {totalSelected}</>}
                </span>
              </div>
              {orders.length === 0 ? (
                <p className="text-xs py-2" style={{ color: "var(--ds-text-faint)" }}>Нет доступных заявок с этим материалом</p>
              ) : (
                <div className="space-y-1.5">
                  {orders.map((order) => {
                    const isChecked = !!selectedOrders[order.order_item_id];
                    return (
                      <div key={order.order_item_id} className="flex items-center gap-3">
                        <input type="checkbox" checked={isChecked}
                          onChange={() => toggleOrderSelection(order.order_item_id, Math.min(order.available_qty, needed))}
                          className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm flex-1" style={{ color: "var(--ds-text)" }}>
                          Заявка №{order.order_number}
                          <span className="text-xs ml-2" style={{ color: "var(--ds-text-faint)" }}>(доступно: {order.available_qty} {order.unit_short})</span>
                        </span>
                        {isChecked && (
                          <input type="number" className="ds-input text-sm" style={{ width: "90px" }}
                            min="0" max={order.available_qty} step="0.01" placeholder="Кол-во"
                            value={selectedOrders[order.order_item_id]?.required_qty || ""}
                            onChange={(e) => updateOrderQty(order.order_item_id, e.target.value)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {shortage > 0 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "var(--ds-border)" }}>
                  <span className="text-xs" style={{ color: "#f59e0b" }}>Не хватает: {shortage.toFixed(2)} {item.unit_name}</span>
                  <button className="ds-btn-secondary text-xs px-3 py-1" onClick={() => setShowOrderModal(true)}>Заказать</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
