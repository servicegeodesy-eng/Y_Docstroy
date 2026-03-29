import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, compositeKey, hasLinkedChildren, isChildLocked } from "@/hooks/useDictLinks";
import { useMobile } from "@/lib/MobileContext";
import type { MaterialOrder } from "./OrderCard";

interface NomenclatureItem {
  id: string;
  name: string;
}

interface UnitItem {
  id: string;
  name: string;
}

interface OrderItemRow {
  key: number;
  material_name: string;
  material_id: string | null;
  unit_id: string;
  unit_name: string;
  quantity: string;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
  editOrder?: MaterialOrder | null;
}

let rowCounter = 0;

function emptyRow(): OrderItemRow {
  return { key: ++rowCounter, material_name: "", material_id: null, unit_id: "", unit_name: "", quantity: "" };
}

export default function CreateOrderModal({ onClose, onCreated, editOrder }: Props) {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const { buildings, floors, workTypes, constructions } = useDictionaries();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors } = useDictLinks();

  const [selBuilding, setSelBuilding] = useState(editOrder?.building_name ? "" : "");
  const [selWorkType, setSelWorkType] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selConstruction, setSelConstruction] = useState("");

  const [items, setItems] = useState<OrderItemRow[]>([emptyRow()]);
  const [notes, setNotes] = useState(editOrder?.notes || "");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nomenclature autocomplete
  const [nSearches, setNSearches] = useState<Record<number, string>>({});
  const [nResults, setNResults] = useState<Record<number, NomenclatureItem[]>>({});
  const [nOpen, setNOpen] = useState<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Units
  const [units, setUnits] = useState<UnitItem[]>([]);

  useEffect(() => {
    if (!project) return;
    api.get<UnitItem[]>("/api/materials/units", { project_id: project.id }).then((r) => {
      if (r.data) setUnits(r.data);
    });
  }, [project]);

  const filteredWorkTypes = filterChildren(workTypes, buildingWorkTypes, selBuilding || null);
  const floorKey = compositeKey(selBuilding, selWorkType);
  const filteredFloors = filterChildren(floors, buildingWorkTypeFloors, floorKey);
  const filteredConstructions = filterChildren(constructions, workTypeConstructions, selWorkType || null);
  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showConstructions = !isChildLocked(workTypeConstructions, selWorkType || null);
  const workTypeDisabled = !selBuilding || isChildLocked(buildingWorkTypes, selBuilding || null);

  const searchNomenclature = useCallback((key: number, q: string) => {
    setNSearches((prev) => ({ ...prev, [key]: q }));
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q || q.length < 2 || !project) {
      setNResults((prev) => ({ ...prev, [key]: [] }));
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const r = await api.get<NomenclatureItem[]>("/api/materials/nomenclature", {
        project_id: project.id,
        q,
      });
      if (r.data) setNResults((prev) => ({ ...prev, [key]: r.data! }));
    }, 300);
  }, [project]);

  const updateItem = (key: number, field: keyof OrderItemRow, value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [field]: value } : it))
    );
  };

  const selectNomenclature = (key: number, item: NomenclatureItem) => {
    setItems((prev) =>
      prev.map((it) =>
        it.key === key ? { ...it, material_name: item.name, material_id: item.id } : it
      )
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

  const handleSubmit = async (status: "ordered" | "draft") => {
    if (!project) return;
    if (!selBuilding || !selWorkType) {
      setError("Выберите здание и вид работ");
      return;
    }
    const validItems = items.filter((it) => it.material_name && it.quantity && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      setError("Добавьте хотя бы одну позицию");
      return;
    }

    setLoading(true);
    setError(null);

    const body = {
      project_id: project.id,
      building_id: selBuilding,
      work_type_id: selWorkType,
      floor_id: selFloor || null,
      construction_id: selConstruction || null,
      items: validItems.map((it) => ({
        material_name: it.material_name,
        material_id: it.material_id,
        unit_id: it.unit_id || null,
        quantity: Number(it.quantity),
      })),
      notes: notes || null,
      status,
    };

    const res = await api.post("/api/materials/orders", body);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // Upload files if any
    if (files.length > 0 && res.data) {
      const orderId = (res.data as { id: string }).id;
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("order_id", orderId);
        await api.upload("/api/materials/orders/files", fd);
      }
    }

    setLoading(false);
    onCreated();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: isMobile ? "100%" : "680px",
          maxHeight: "90vh",
          background: "var(--ds-surface)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--ds-border)" }}>
          <h3 className="font-semibold text-base" style={{ color: "var(--ds-text)" }}>
            {editOrder ? "Редактировать заказ" : "Новый заказ материалов"}
          </h3>
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

          {/* Location selectors */}
          <div className="space-y-3">
            <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Место</label>
            <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              <select
                className="ds-input text-sm"
                value={selBuilding}
                onChange={(e) => { setSelBuilding(e.target.value); setSelWorkType(""); setSelFloor(""); setSelConstruction(""); }}
              >
                <option value="">Здание...</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select
                className="ds-input text-sm"
                value={selWorkType}
                onChange={(e) => { setSelWorkType(e.target.value); setSelFloor(""); setSelConstruction(""); }}
                disabled={workTypeDisabled}
              >
                <option value="">Вид работ...</option>
                {filteredWorkTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>

              {showFloors && (
                <select
                  className="ds-input text-sm"
                  value={selFloor}
                  onChange={(e) => setSelFloor(e.target.value)}
                >
                  <option value="">Уровень...</option>
                  {filteredFloors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}

              {showConstructions && (
                <select
                  className="ds-input text-sm"
                  value={selConstruction}
                  onChange={(e) => setSelConstruction(e.target.value)}
                >
                  <option value="">Конструкция...</option>
                  {filteredConstructions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Material items */}
          <div className="space-y-3">
            <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Материалы</label>
            {items.map((item) => (
              <div key={item.key} className="flex gap-2 items-start">
                {/* Material name with autocomplete */}
                <div className="flex-1 relative">
                  <input
                    className="ds-input text-sm w-full"
                    placeholder="Наименование материала"
                    value={nSearches[item.key] ?? item.material_name}
                    onChange={(e) => {
                      updateItem(item.key, "material_name", e.target.value);
                      updateItem(item.key, "material_id", "");
                      searchNomenclature(item.key, e.target.value);
                      setNOpen(item.key);
                    }}
                    onFocus={() => setNOpen(item.key)}
                    onBlur={() => setTimeout(() => setNOpen(null), 200)}
                  />
                  {nOpen === item.key && (nResults[item.key] || []).length > 0 && (
                    <div
                      className="absolute z-10 left-0 right-0 mt-1 rounded-lg shadow-lg border max-h-40 overflow-y-auto"
                      style={{ background: "var(--ds-surface)", borderColor: "var(--ds-border)" }}
                    >
                      {nResults[item.key].map((n) => (
                        <button
                          key={n.id}
                          className="block w-full text-left text-sm px-3 py-2 hover:opacity-80 transition-opacity"
                          style={{ color: "var(--ds-text)" }}
                          onMouseDown={() => selectNomenclature(item.key, n)}
                        >
                          {n.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unit */}
                <select
                  className="ds-input text-sm"
                  style={{ width: isMobile ? "80px" : "120px" }}
                  value={item.unit_id}
                  onChange={(e) => {
                    updateItem(item.key, "unit_id", e.target.value);
                    const u = units.find((u) => u.id === e.target.value);
                    if (u) updateItem(item.key, "unit_name", u.name);
                  }}
                >
                  <option value="">Ед.</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>

                {/* Quantity */}
                <input
                  className="ds-input text-sm"
                  style={{ width: isMobile ? "70px" : "100px" }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                />

                {/* Remove */}
                {items.length > 1 && (
                  <button
                    className="ds-icon-btn flex-shrink-0 mt-1"
                    onClick={() => removeItem(item.key)}
                    title="Удалить"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              className="ds-btn-secondary text-xs px-3 py-1.5"
              onClick={addItem}
            >
              + Номенклатура
            </button>
          </div>

          {/* Files */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Файлы</label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text)" }}
                >
                  {f.name}
                  <button className="ml-1" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="ds-btn-secondary text-xs px-3 py-1.5"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files) setFiles((prev) => [...prev, ...Array.from(target.files!)]);
                  };
                  input.click();
                }}
              >
                + Добавить файл
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Примечание</label>
            <textarea
              className="ds-input text-sm w-full"
              rows={3}
              placeholder="Комментарий к заказу..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: "var(--ds-border)" }}
        >
          <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button
            className="ds-btn-secondary text-sm px-4 py-2"
            onClick={() => handleSubmit("draft")}
            disabled={loading}
          >
            В черновик
          </button>
          <button
            className="ds-btn text-sm px-4 py-2"
            onClick={() => handleSubmit("ordered")}
            disabled={loading}
          >
            {loading ? "Сохранение..." : "Заказать"}
          </button>
        </div>
      </div>
    </div>
  );
}
