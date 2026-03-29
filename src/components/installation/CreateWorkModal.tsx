import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, compositeKey, hasLinkedChildren, isChildLocked } from "@/hooks/useDictLinks";
import { useMobile } from "@/lib/MobileContext";

interface AvailableMaterial {
  id: string;
  material_name: string;
  unit_name: string;
  order_id: string;
  order_number: string;
  available_qty: number;
}

interface SelectedMaterial {
  id: string;
  material_name: string;
  unit_name: string;
  order_id: string;
  order_number: string;
  available_qty: number;
  required_qty: string;
  checked: boolean;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateWorkModal({ onClose, onCreated }: Props) {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const { buildings, floors, workTypes, constructions } = useDictionaries();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors } = useDictLinks();

  // Location
  const [selBuilding, setSelBuilding] = useState("");
  const [selWorkType, setSelWorkType] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selConstruction, setSelConstruction] = useState("");

  // Date & notes
  const [plannedDate, setPlannedDate] = useState("");
  const [notes, setNotes] = useState("");

  // Materials
  const [materials, setMaterials] = useState<SelectedMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // State
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

  // Fetch available materials when location changes
  const fetchMaterials = useCallback(async () => {
    if (!project || !selBuilding || !selWorkType) {
      setMaterials([]);
      return;
    }
    setLoadingMaterials(true);
    const params: Record<string, string> = {
      project_id: project.id,
      building_id: selBuilding,
      work_type_id: selWorkType,
    };
    if (selFloor) params.floor_id = selFloor;
    if (selConstruction) params.construction_id = selConstruction;

    const res = await api.get<AvailableMaterial[]>("/api/installation/available-materials", params);
    if (res.data) {
      setMaterials(res.data.map((m) => ({
        ...m,
        required_qty: "",
        checked: false,
      })));
    }
    setLoadingMaterials(false);
  }, [project, selBuilding, selWorkType, selFloor, selConstruction]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const toggleMaterial = (id: string) => {
    setMaterials((prev) =>
      prev.map((m) => m.id === id ? { ...m, checked: !m.checked } : m)
    );
  };

  const updateRequiredQty = (id: string, val: string) => {
    setMaterials((prev) =>
      prev.map((m) => m.id === id ? { ...m, required_qty: val } : m)
    );
  };

  const handleSubmit = async () => {
    if (!project) return;
    if (!selBuilding || !selWorkType) {
      setError("Выберите место и вид работ");
      return;
    }
    if (!plannedDate) {
      setError("Укажите плановую дату");
      return;
    }

    const selectedMaterials = materials.filter((m) => m.checked && Number(m.required_qty) > 0);

    setLoading(true);
    setError(null);

    const body = {
      project_id: project.id,
      building_id: selBuilding,
      work_type_id: selWorkType,
      floor_id: selFloor || null,
      construction_id: selConstruction || null,
      planned_date: plannedDate,
      notes: notes || null,
      materials: selectedMaterials.map((m) => ({
        material_id: m.id,
        order_id: m.order_id,
        required_qty: Number(m.required_qty),
      })),
    };

    const res = await api.post("/api/installation/works", body);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    onCreated();
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
            Новые работы по монтажу
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
            <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>
              Место
            </label>
            <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              <select
                className="ds-input text-sm"
                value={selBuilding}
                onChange={(e) => {
                  setSelBuilding(e.target.value);
                  setSelWorkType("");
                  setSelFloor("");
                  setSelConstruction("");
                }}
              >
                <option value="">Место работ...</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select
                className="ds-input text-sm"
                value={selWorkType}
                onChange={(e) => {
                  setSelWorkType(e.target.value);
                  setSelFloor("");
                  setSelConstruction("");
                }}
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

          {/* Planned date */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
              Плановая дата <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="date"
              className="ds-input text-sm"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>

          {/* Available materials */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
              Доступные материалы
            </label>
            {loadingMaterials ? (
              <div className="py-4 text-center">
                <div
                  className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  style={{ color: "var(--ds-accent)" }}
                />
              </div>
            ) : materials.length === 0 ? (
              <div className="py-4 text-center text-sm rounded-lg" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-faint)" }}>
                {selBuilding && selWorkType
                  ? "Нет доступных материалов для выбранного места"
                  : "Выберите место и вид работ для загрузки материалов"}
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: "var(--ds-surface-sunken)" }}
                  >
                    <input
                      type="checkbox"
                      checked={mat.checked}
                      onChange={() => toggleMaterial(mat.id)}
                      className="w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>
                        {mat.material_name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                        Заявка #{mat.order_number} -- доступно: {mat.available_qty} {mat.unit_name}
                      </p>
                    </div>
                    {mat.checked && (
                      <input
                        type="number"
                        className="ds-input text-sm"
                        style={{ width: "90px" }}
                        min="0"
                        max={mat.available_qty}
                        step="0.01"
                        placeholder="Кол-во"
                        value={mat.required_qty}
                        onChange={(e) => updateRequiredQty(mat.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
              Примечание
            </label>
            <textarea
              className="ds-input text-sm w-full"
              rows={3}
              placeholder="Комментарий к работам..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--ds-border)" }}>
          <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button
            className="ds-btn text-sm px-4 py-2"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
