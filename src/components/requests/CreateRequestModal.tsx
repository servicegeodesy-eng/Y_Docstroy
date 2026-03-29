import { FormEvent, memo, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize } from "@/lib/utils";
import { useDictLinks, filterChildren, isChildLocked, hasLinkedChildren, compositeKey } from "@/hooks/useDictLinks";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useOverlays } from "@/hooks/useOverlays";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import DictSelect from "@/components/registry/DictSelect";
import PolygonDrawer from "@/components/plan/PolygonDrawer";
import type { Point } from "@/components/plan/SnapEngine";
import { useAxisCalibration } from "@/hooks/useAxisCalibration";
import { detectAxesForPolygons } from "@/lib/axisDetection";
import type { Overlay } from "@/types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function CreateRequestModal({ onClose, onCreated }: Props) {
  const { project } = useProject();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { buildings, floors, workTypes, constructions, works, loadDicts } = useDictionaries();
  const [files, setFiles] = useState<File[]>([]);
  const [cellDescription, setCellDescription] = useState("");

  const [selBuilding, setSelBuilding] = useState("");
  const [selWorkType, setSelWorkType] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selConstruction, setSelConstruction] = useState("");
  const [selRequestWorkType, setSelRequestWorkType] = useState("");

  // Подложка и маска
  const {
    overlays: allOverlays,
    overlayBuildings, overlayFloors: overlayFloorLinks,
    overlayConstructions: overlayConstructionLinks,
    workTypeOverlays,
  } = useOverlays();
  const [polygons, setPolygons] = useState<Point[][]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);

  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors } = useDictLinks();

  const filteredWorkTypes = filterChildren(workTypes, buildingWorkTypes, selBuilding || null);
  const floorKey = compositeKey(selBuilding, selWorkType);
  const filteredFloors = filterChildren(floors, buildingWorkTypeFloors, floorKey);
  const filteredConstructions = filterChildren(constructions, workTypeConstructions, selWorkType || null);

  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showConstructions = !isChildLocked(workTypeConstructions, selWorkType || null);

  const workTypeDisabled = !selBuilding || isChildLocked(buildingWorkTypes, selBuilding || null);

  // Обратная карта: overlay_id → work_type_ids
  const overlayWorkTypeMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [wtId, oIds] of Object.entries(workTypeOverlays)) {
      for (const oId of oIds) {
        if (!map[oId]) map[oId] = [];
        map[oId].push(wtId);
      }
    }
    return map;
  }, [workTypeOverlays]);

  // Подбор подложки по выбранным справочникам
  const matchedOverlay = useMemo((): Overlay | null => {
    const buildingId = selBuilding || null;
    const workTypeId = selWorkType || null;
    const floorId = selFloor || null;
    const constructionId = selConstruction || null;

    for (const overlay of allOverlays) {
      const hasWt = (overlayWorkTypeMap[overlay.id]?.length || 0) > 0;
      const hasBld = (overlayBuildings[overlay.id]?.length || 0) > 0;
      const hasFlr = (overlayFloorLinks[overlay.id]?.length || 0) > 0;
      const hasCon = (overlayConstructionLinks[overlay.id]?.length || 0) > 0;
      if (!hasWt && !hasBld && !hasFlr && !hasCon) continue;
      if (hasWt && (!workTypeId || !overlayWorkTypeMap[overlay.id].includes(workTypeId))) continue;
      if (hasBld && (!buildingId || !overlayBuildings[overlay.id].includes(buildingId))) continue;
      if (hasFlr && (!floorId || !overlayFloorLinks[overlay.id].includes(floorId))) continue;
      if (hasCon && (!constructionId || !overlayConstructionLinks[overlay.id].includes(constructionId))) continue;
      return overlay;
    }
    return null;
  }, [selBuilding, selWorkType, selFloor, selConstruction,
    allOverlays, overlayWorkTypeMap, overlayBuildings, overlayFloorLinks, overlayConstructionLinks]);

  const { calibratedAxes, axisOrder } = useAxisCalibration(matchedOverlay?.id || null);

  // Автоопределение осей сразу при отрисовке полигонов
  const detectedAxisLabel = useMemo(() => {
    if (polygons.length === 0 || calibratedAxes.length === 0) return null;
    return detectAxesForPolygons(polygons, calibratedAxes, axisOrder);
  }, [polygons, calibratedAxes]);

  // Автозаполнение описания при изменении осей
  useEffect(() => {
    setCellDescription((prev) => {
      const cleaned = prev
        .replace(/,?\s*в осях\s+[^\n]*/g, '')
        .replace(/,?\s*возле оси\s+[^\n]*/g, '')
        .replace(/,?\s*область находится за пределами строительных осей/g, '')
        .trim();
      if (!detectedAxisLabel) return cleaned;
      return cleaned ? `${cleaned}, ${detectedAxisLabel}` : detectedAxisLabel;
    });
  }, [detectedAxisLabel]);

  // Загрузка URL подложки
  useEffect(() => {
    if (!matchedOverlay) {
      setOverlayImageUrl(null);
      return;
    }
    let cancelled = false;
    getOverlayUrl(matchedOverlay.storage_path).then((url) => {
      if (!cancelled && url) setOverlayImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [matchedOverlay]);

  // Сброс полигонов при смене подложки
  useEffect(() => {
    setPolygons([]);
  }, [matchedOverlay?.id]);

  function handleBuildingChange(v: string) {
    setSelBuilding(v);
    if (selWorkType) {
      const valid = filterChildren(workTypes, buildingWorkTypes, v || null);
      if (!valid.find((wt) => wt.id === selWorkType)) {
        setSelWorkType("");
        setSelFloor("");
        setSelConstruction("");
      }
    }
    if (!v) {
      setSelWorkType("");
      setSelFloor("");
      setSelConstruction("");
    }
  }

  function handleWorkTypeChange(v: string) {
    setSelWorkType(v);
    setSelFloor("");
    setSelConstruction("");
  }

  useEffect(() => {
    loadDicts();
  }, [loadDicts]);

  const hasOverlay = !!matchedOverlay && !!overlayImageUrl;
  const hasMask = polygons.length > 0;

  const validationHints = useMemo(() => {
    const hints: string[] = [];
    if (!selRequestWorkType) hints.push("работу");
    if (!selBuilding) hints.push("место работ");
    if (!selWorkType) hints.push("вид работ");
    if (hasOverlay && !hasMask) hints.push("область на подложке");
    return hints;
  }, [selRequestWorkType, selBuilding, selWorkType, hasOverlay, hasMask]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validationHints.length > 0) return;
    if (!project || !user) return;

    setLoading(true);
    setError(null);

    const buildingId = selBuilding || null;
    const workTypeId = selWorkType || null;
    const floorId = (showFloors ? selFloor : "") || null;
    const constructionId = selConstruction || null;
    const description = cellDescription.trim() || null;
    const workId = selRequestWorkType || null;
    const workName = works.find((w) => w.id === workId)?.name || "";
    const requestWorkType = workName || null;

    // Авто-наименование
    const bName = buildings.find((b) => b.id === buildingId)?.name || "";
    const wtName = workTypes.find((w) => w.id === workTypeId)?.name || "";
    const name = [workName, bName, wtName].filter(Boolean).join(" — ") || "Заявка";

    const cellId = crypto.randomUUID();

    const { error: cellError } = await supabase.from("cells").insert({
      id: cellId,
      project_id: project.id,
      name,
      building_id: buildingId,
      work_type_id: workTypeId,
      floor_id: floorId,
      construction_id: constructionId,
      set_id: null,
      tag: null,
      manual_tag: null,
      description,
      progress_percent: null,
      request_work_type: requestWorkType,
      work_id: workId,
      cell_type: "request",
      status: "В работе",
      created_by: user.id,
      assigned_to: null,
      assigned_by: null,
      original_sender_id: null,
      send_type: null,
    });

    if (cellError) {
      setError(cellError.message);
      setLoading(false);
      return;
    }

    // Сохраняем маски на подложке
    if (matchedOverlay && polygons.length > 0) {
      const rows = polygons.map((polygon) => ({
        cell_id: cellId,
        overlay_id: matchedOverlay.id,
        polygon_points: polygon,
      }));
      const { error: maskErr } = await supabase.from("cell_overlay_masks").insert(rows);
      if (maskErr) console.error("Ошибка сохранения маски заявки:", maskErr.message);
    }

    const uploadResults = await Promise.allSettled(
      files.map(async (file) => {
        const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
        const safeFileName = crypto.randomUUID() + ext;
        const storagePath = `${project.id}/${cellId}/${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from("cell-files")
          .upload(storagePath, file);
        if (uploadError) throw uploadError;
        await supabase.from("cell_files").insert({
          cell_id: cellId,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          storage_path: storagePath,
          uploaded_by: user.id,
        });
        return storagePath;
      })
    );
    for (const r of uploadResults) {
      if (r.status === "rejected") console.error("Upload error:", r.reason);
    }

    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "created",
      details: { name, cell_type: "request" },
    });

    setLoading(false);
    onCreated();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div className="ds-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Создать заявку</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const form = document.getElementById("create-request-form") as HTMLFormElement; form?.requestSubmit(); }}
              disabled={loading || validationHints.length > 0}
              className="ds-btn px-4 py-1.5 text-sm"
            >
              {loading ? "Создание..." : "Создать"}
            </button>
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {validationHints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 py-2" style={{ borderBottom: "1px solid var(--ds-border)", background: "color-mix(in srgb, #ef4444 5%, var(--ds-surface))" }}>
            <span className="text-xs" style={{ color: "#ef4444" }}>Укажите:</span>
            {validationHints.map((hint) => (
              <span key={hint} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 25%, var(--ds-border))" }}>
                {hint}
              </span>
            ))}
          </div>
        )}

        <form id="create-request-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="ds-alert-error">{error}</div>}

          <DictSelect label="Работа" name="work_id" items={works} required value={selRequestWorkType} onChange={setSelRequestWorkType} />

          <div className="grid grid-cols-2 gap-4">
            <DictSelect label="Место работ" name="building_id" items={buildings} required value={selBuilding} onChange={handleBuildingChange} />
            <DictSelect label="Вид работ" name="work_type_id" items={filteredWorkTypes} required value={selWorkType} onChange={handleWorkTypeChange} disabled={workTypeDisabled} />
            {selWorkType && showFloors && (
              <DictSelect label="Уровни/срезы" name="floor_id" items={filteredFloors} value={selFloor} onChange={setSelFloor} />
            )}
            {selWorkType && showConstructions && (
              <DictSelect label="Конструкция" name="construction_id" items={filteredConstructions} value={selConstruction} onChange={setSelConstruction} />
            )}
          </div>

          {/* Подложка — появляется когда есть совпадения */}
          {selWorkType && hasOverlay && (
            <div className="border rounded-lg p-3" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">{matchedOverlay!.name}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {hasMask
                        ? `Отмечено областей: ${polygons.length}`
                        : <>Необходимо отметить область на плане <span style={{ color: "#ef4444" }}>*</span></>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditor(true)}
                  className="ds-btn px-3 py-1.5 text-xs whitespace-nowrap"
                >
                  {hasMask ? "Изменить области" : "Отметить область"}
                </button>
              </div>
              {hasMask && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {polygons.map((poly, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                      Область {i + 1} ({poly.length} т.)
                      <button
                        type="button"
                        onClick={() => setPolygons((prev) => prev.filter((_, idx) => idx !== i))}
                        style={{ color: "var(--ds-text-faint)" }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPolygons([])}
                    className="text-xs"
                    style={{ color: "#ef4444" }}
                  >
                    Удалить все
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="ds-label">Описание</label>
            <textarea
              value={cellDescription}
              onChange={(e) => setCellDescription(e.target.value)}
              rows={3}
              className="ds-input w-full resize-none"
              placeholder="Укажите телефон для связи и другую полезную информацию по заявке"
            />
          </div>

          <div>
            <label className="ds-label">Файлы</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors w-full" style={{ borderColor: "var(--ds-border)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Выбрать файлы</span>
              <input type="file" multiple onChange={handleFileSelect} className="hidden" />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className="flex-1 truncate" style={{ color: "var(--ds-text)" }}>{file.name}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-faint)" }}>{formatSize(file.size)}</span>
                    <button type="button" onClick={() => removeFile(i)} className="ds-icon-btn p-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </form>
      </div>

      {/* Редактор маски — fullscreen */}
      {showEditor && matchedOverlay && overlayImageUrl && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--ds-surface)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Отметить область на подложке</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
                {matchedOverlay.name}
                {polygons.length > 0 && (
                  <span className="ml-2 font-medium" style={{ color: "var(--ds-accent)" }}>
                    Областей: {polygons.length}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEditor(false)} className="ds-btn px-3 py-1.5 text-sm">Готово</button>
              <button onClick={() => setShowEditor(false)} className="ds-icon-btn">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PolygonDrawer
              imageUrl={overlayImageUrl}
              imageWidth={matchedOverlay.width || 1000}
              imageHeight={matchedOverlay.height || 750}
              existingMasks={[]}
              newPolygons={polygons}
              onRemovePolygon={(index) => setPolygons((prev) => prev.filter((_, i) => i !== index))}
              getColorKey={() => "blue"}
              onComplete={(points) => setPolygons((prev) => [...prev, points])}
              onCancel={() => setShowEditor(false)}
              fullscreen
            />
          </div>
        </div>
      )}
    </div>
  );
}


export default memo(CreateRequestModal);
