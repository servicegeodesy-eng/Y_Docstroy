import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, compositeKey, hasLinkedChildren, isChildLocked } from "@/hooks/useDictLinks";
import { useMobile } from "@/lib/MobileContext";
import { useOverlays } from "@/hooks/useOverlays";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
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
  const [workMasksForOverlay, setWorkMasksForOverlay] = useState<import("@/hooks/useCellMasks").MaskWithCell[]>([]);
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
  const [uOpen, setUOpen] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Files, notes, tag, submit
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [manualTag, setManualTag] = useState("");
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
      getOverlayUrl(match.storage_path).then(url => { if (url) setOverlayUrl(url); });
      // Загружаем маски работ для этой подложки
      api.get<Record<string, unknown>[]>("/api/installation/masks", { overlay_id: match.id }).then(r => {
        if (r.data) {
          setWorkMasksForOverlay(r.data.map(m => ({
            id: m.id as string, cell_id: "", overlay_id: m.overlay_id as string,
            polygon_points: typeof m.polygon_points === "string" ? JSON.parse(m.polygon_points as string) : m.polygon_points as { x: number; y: number }[],
            created_at: "", updated_at: "",
            cell_name: `Работа (${m.work_status === "in_progress" ? "в процессе" : m.work_status === "completed" ? "завершено" : "план"})`,
            cell_status: m.work_status === "in_progress" ? "На проверке" : m.work_status === "completed" ? "Подписано" : "Новый",
            cell_updated_at: "", cell_progress_percent: Number(m.progress) || 0,
            cell_building_id: null, cell_work_type_id: null, cell_floor_id: null, cell_construction_id: null, cell_set_id: null,
          })));
        }
      });
    } else {
      setLinkedOverlay(null);
      setOverlayIdForMasks(null);
      setOverlayUrl("");
    }
    setDrawnPolygons([]);
  }, [selBuilding, selWorkType, overlays, workTypeOverlays, overlayBuildings]);

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
    const unitMatch = item.unit_id ? units.find(u => u.id === item.unit_id) : null;
    setItems(prev => prev.map(it => it.key === key
      ? { ...it, material_name: item.name, material_id: item.id, unit_id: item.unit_id || it.unit_id, unit_name: unitMatch ? unitMatch.short_name : it.unit_name }
      : it));
    setNOpen(null);
    setNResults(p => ({ ...p, [key]: [] }));
  };

  // Unit filtering & creation
  const getFilteredUnits = (query: string) => {
    if (!query) return units;
    const q = query.toLowerCase();
    return units.filter(u => u.short_name.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  };

  const selectUnit = (key: number, unit: UnitItem) => {
    setItems(prev => prev.map(it => it.key === key
      ? { ...it, unit_id: unit.id, unit_name: unit.short_name }
      : it));
    setUOpen(null);
  };

  const createAndSelectUnit = async (key: number, shortName: string) => {
    if (!project || !shortName.trim()) return;
    const res = await api.post<UnitItem>("/api/materials/units", {
      project_id: project.id, short_name: shortName.trim(), name: shortName.trim(),
    });
    if (res.data) {
      const newUnit = res.data;
      if (!units.find(u => u.id === newUnit.id)) {
        setUnits(prev => [...prev, newUnit]);
      }
      selectUnit(key, newUnit);
    }
  };

  const removeItem = (key: number) => {
    setItems(prev => { const n = prev.filter(it => it.key !== key); return n.length === 0 ? [emptyRow()] : n; });
  };

  const validItems = items.filter(it => it.material_name && it.required_qty && Number(it.required_qty) > 0);

  const canSubmit = validItems.length > 0 && (!linkedOverlay || drawnPolygons.length > 0);

  const handleSubmit = async () => {
    if (!project) return;
    if (linkedOverlay && drawnPolygons.length === 0) { setError("Необходимо отметить область на подложке"); return; }
    if (validItems.length === 0) { setError("Добавьте материалы"); return; }

    setLoading(true);
    setError(null);

    const materials = validItems.map(it => ({
      material_name: it.material_name,
      material_id: it.material_id,
      unit_id: it.unit_id || null,
      unit_name: it.unit_name,
      required_qty: Number(it.required_qty),
    }));

    const res = await api.post("/api/installation/works", {
      project_id: project.id,
      building_id: selBuilding || null,
      work_type_id: selWorkType || null,
      floor_id: selFloor || null,
      construction_id: selConstruction || null,
      planned_date: plannedDate || null,
      notes: notes || null,
      manual_tag: manualTag || null,
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
            existingMasks={[...existingCellMasks, ...workMasksForOverlay]}
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

        {/* Уведомления о недостающих данных */}
        {(() => {
          const warnings: string[] = [];
          if (!selBuilding) warnings.push("Выберите место работ");
          if (!selWorkType) warnings.push("Выберите вид работ");
          if (linkedOverlay && drawnPolygons.length === 0) warnings.push("Отметьте область на подложке");
          if (validItems.length === 0) warnings.push("Укажите необходимые материалы");
          if (warnings.length === 0) return null;
          return (
            <div className="px-6 py-2 text-xs space-y-0.5" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))", borderBottom: "1px solid var(--ds-border)" }}>
              {warnings.map((w, i) => (
                <p key={i} style={{ color: "#b45309" }}>{w} <span style={{ color: "#ef4444" }}>*</span></p>
              ))}
            </div>
          );
        })()}

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
              <input type="date" className="ds-input" value={plannedDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setPlannedDate(e.target.value)} />
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
                <div className="relative w-24">
                  <input className="ds-input w-full text-sm" placeholder="Ед."
                    value={it.unit_name}
                    onChange={e => { updateItem(it.key, "unit_name", e.target.value); updateItem(it.key, "unit_id", ""); setUOpen(it.key); }}
                    onFocus={() => setUOpen(it.key)}
                    onBlur={() => setTimeout(() => { if (uOpen === it.key) setUOpen(null); }, 200)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && it.unit_name && !it.unit_id) {
                        e.preventDefault();
                        const match = units.find(u => u.short_name.toLowerCase() === it.unit_name.toLowerCase());
                        if (match) selectUnit(it.key, match);
                        else createAndSelectUnit(it.key, it.unit_name);
                      }
                    }}
                  />
                  {uOpen === it.key && it.unit_name && (() => {
                    const filtered = getFilteredUnits(it.unit_name);
                    const exactMatch = units.some(u => u.short_name.toLowerCase() === it.unit_name.toLowerCase());
                    if (filtered.length === 0 && !it.unit_name) return null;
                    return (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg shadow-lg border max-h-40 overflow-y-auto"
                        style={{ background: "var(--ds-surface)", borderColor: "var(--ds-border)", minWidth: "120px" }}>
                        {filtered.map(u => (
                          <button key={u.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--ds-surface-sunken)]"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => selectUnit(it.key, u)}>{u.short_name}</button>
                        ))}
                        {!exactMatch && it.unit_name.trim() && (
                          <button className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-[var(--ds-surface-sunken)]"
                            style={{ color: "var(--ds-accent)" }}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => createAndSelectUnit(it.key, it.unit_name)}>
                            + Создать «{it.unit_name.trim()}»
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <input className="ds-input w-20 text-sm text-center" type="number" min="0" step="0.01" placeholder="Кол-во"
                  value={it.required_qty} onChange={e => updateItem(it.key, "required_qty", e.target.value)} />
                <button onClick={() => removeItem(it.key)} className="ds-icon-btn shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button onClick={() => setItems(p => [...p, emptyRow()])} className="ds-btn-secondary text-xs px-3 py-1.5">+ Добавить материал</button>
          </Section>


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

          {/* === Метка === */}
          <Section title="Метка">
            <input className="ds-input w-full text-sm" placeholder="Метка (например: этап 1, срочное...)"
              value={manualTag} onChange={e => setManualTag(e.target.value)} />
          </Section>

          {/* === Описание === */}
          <Section title="Описание">
            <textarea className="ds-input w-full text-sm" rows={3} placeholder="Описание работы..."
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
