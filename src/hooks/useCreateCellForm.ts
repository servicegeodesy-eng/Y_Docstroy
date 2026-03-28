import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadCellFile, removeFiles } from "@/lib/fileStorage";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { MONTHS_RU } from "@/lib/utils";
import { useDictLinks, filterChildren, isChildLocked, hasLinkedChildren, compositeKey } from "@/hooks/useDictLinks";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useOverlays } from "@/hooks/useOverlays";
import { useCellMasks } from "@/hooks/useCellMasks";
import { useAxisCalibration } from "@/hooks/useAxisCalibration";
import { detectAxesForPolygons } from "@/lib/axisDetection";
import type { Point } from "@/components/plan/SnapEngine";

export function useCreateCellForm(onCreated: () => void) {
  const { project } = useProject();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileWarning, setShowFileWarning] = useState(false);

  const { buildings, floors, workTypes, constructions, sets, loadDicts } = useDictionaries();

  const [files, setFiles] = useState<File[]>([]);

  // Контролируемые значения полей формы
  const [cellName, setCellName] = useState("");
  const [cellTag, setCellTag] = useState("");
  const [cellDescription, setCellDescription] = useState("");
  const [cellProgress, setCellProgress] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  // Контролируемые значения для каскадной фильтрации
  const [selBuilding, setSelBuilding] = useState("");
  const [selWorkType, setSelWorkType] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selConstruction, setSelConstruction] = useState("");
  const [selSet, setSelSet] = useState("");

  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors, workTypeSets, workTypeOverlays } = useDictLinks();
  const {
    overlays: allOverlays,
    overlayBuildings, overlayFloors: overlayFloorLinks, overlayConstructions: overlayConstructionLinks,
  } = useOverlays();

  // Подложка и маски (несколько полигонов на одну ячейку)
  const [showOverlayStep, setShowOverlayStep] = useState(false);
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);
  const [drawnPolygons, setDrawnPolygons] = useState<Point[][]>([]);

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

  const matchedOverlays = useMemo(() => {
    const result: typeof allOverlays = [];
    for (const overlay of allOverlays) {
      const hasWorkTypeLink = (overlayWorkTypeMap[overlay.id]?.length || 0) > 0;
      const hasBuildingLink = (overlayBuildings[overlay.id]?.length || 0) > 0;
      const hasFloorLink = (overlayFloorLinks[overlay.id]?.length || 0) > 0;
      const hasConstructionLink = (overlayConstructionLinks[overlay.id]?.length || 0) > 0;

      if (!hasWorkTypeLink && !hasBuildingLink && !hasFloorLink && !hasConstructionLink) continue;

      if (hasWorkTypeLink && (!selWorkType || !overlayWorkTypeMap[overlay.id].includes(selWorkType))) continue;
      if (hasBuildingLink && (!selBuilding || !overlayBuildings[overlay.id].includes(selBuilding))) continue;
      if (hasFloorLink && (!selFloor || !overlayFloorLinks[overlay.id].includes(selFloor))) continue;
      if (hasConstructionLink && (!selConstruction || !overlayConstructionLinks[overlay.id].includes(selConstruction))) continue;

      result.push(overlay);
    }
    return result;
  }, [allOverlays, selBuilding, selWorkType, selFloor, selConstruction, overlayWorkTypeMap, overlayBuildings, overlayFloorLinks, overlayConstructionLinks]);

  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  useEffect(() => {
    if (matchedOverlays.length === 1) {
      setSelectedOverlayId(matchedOverlays[0].id);
    } else if (matchedOverlays.length === 0) {
      setSelectedOverlayId(null);
    } else if (selectedOverlayId && !matchedOverlays.find((o) => o.id === selectedOverlayId)) {
      setSelectedOverlayId(null);
    }
  }, [matchedOverlays]);

  const linkedOverlayId = selectedOverlayId;
  const linkedOverlay = useMemo(() => {
    if (!linkedOverlayId) return null;
    return matchedOverlays.find((o) => o.id === linkedOverlayId) || null;
  }, [linkedOverlayId, matchedOverlays]);

  // Тип подложки: tab_type (приоритет) или автоопределение по связям
  const overlayType = useMemo((): { label: string; color: string; style: { background: string; color: string; borderColor: string } } | null => {
    if (!linkedOverlay) return null;
    const TAB_LABELS: Record<string, { label: string; color: string; style: { background: string; color: string; borderColor: string } }> = {
      plan: { label: "План", color: "", style: { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-border)" } },
      facades: { label: "Фасады", color: "", style: { background: "color-mix(in srgb, #f97316 10%, var(--ds-surface))", color: "#f97316", borderColor: "var(--ds-border)" } },
      landscaping: { label: "Благоустройство", color: "", style: { background: "color-mix(in srgb, #22c55e 10%, var(--ds-surface))", color: "#22c55e", borderColor: "var(--ds-border)" } },
    };
    if (linkedOverlay.tab_type) return TAB_LABELS[linkedOverlay.tab_type] || null;
    // Автоопределение
    const hasFloor = (overlayFloorLinks[linkedOverlay.id]?.length || 0) > 0;
    const hasConstruction = (overlayConstructionLinks[linkedOverlay.id]?.length || 0) > 0;
    if (hasFloor && hasConstruction) return TAB_LABELS.facades;
    if (hasConstruction) return TAB_LABELS.landscaping;
    return TAB_LABELS.plan;
  }, [linkedOverlay, overlayFloorLinks, overlayConstructionLinks]);

  // Калиброванные оси для подложки
  const { calibratedAxes, axisOrder } = useAxisCalibration(linkedOverlayId);

  // Автоопределение осей сразу при отрисовке полигонов
  const detectedAxisLabel = useMemo(() => {
    if (drawnPolygons.length === 0 || calibratedAxes.length === 0) return null;
    return detectAxesForPolygons(drawnPolygons, calibratedAxes, axisOrder);
  }, [drawnPolygons, calibratedAxes]);

  // Автозаполнение описания при изменении осей
  useEffect(() => {
    setCellDescription((prev) => {
      // Убираем старую запись осей
      const cleaned = prev
        .replace(/,?\s*в осях\s+[^\n]*/g, '')
        .replace(/,?\s*возле оси\s+[^\n]*/g, '')
        .replace(/,?\s*область находится за пределами строительных осей/g, '')
        .trim();
      if (!detectedAxisLabel) return cleaned;
      return cleaned ? `${cleaned}, ${detectedAxisLabel}` : detectedAxisLabel;
    });
    if (detectedAxisLabel && !showDescription) setShowDescription(true);
  }, [detectedAxisLabel]);

  // Загрузка существующих масок для подложки
  const { masks: existingMasks } = useCellMasks(linkedOverlayId);

  // Фильтрация масок по всем критериям выбора ячейки
  const filteredExistingMasks = useMemo(() => {
    return existingMasks.filter((m) => {
      if (selBuilding && m.cell_building_id !== selBuilding) return false;
      if (selWorkType && m.cell_work_type_id !== selWorkType) return false;
      if (selFloor && m.cell_floor_id !== selFloor) return false;
      if (selConstruction && m.cell_construction_id !== selConstruction) return false;
      if (selSet && m.cell_set_id !== selSet) return false;
      return true;
    });
  }, [existingMasks, selBuilding, selWorkType, selFloor, selConstruction, selSet]);

  // Загрузка URL изображения подложки (из кеша)
  useEffect(() => {
    if (!linkedOverlay) {
      setOverlayImageUrl(null);
      return;
    }
    let cancelled = false;
    getOverlayUrl(linkedOverlay.storage_path).then((url) => {
      if (!cancelled && url) setOverlayImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [linkedOverlay]);

  // Фильтрация: Место работ → Вид работ
  const filteredWorkTypes = filterChildren(workTypes, buildingWorkTypes, selBuilding || null);
  // Фильтрация: (Место работ + Вид работ) → Уровень
  const floorKey = compositeKey(selBuilding, selWorkType);
  const filteredFloors = filterChildren(floors, buildingWorkTypeFloors, floorKey);
  // Фильтрация: Вид работ → Конструкция
  const filteredConstructions = filterChildren(constructions, workTypeConstructions, selWorkType || null);
  // Фильтрация: Вид работ → Комплект
  const filteredSets = filterChildren(sets, workTypeSets, selWorkType || null);

  // Показывать поля только если есть связанные элементы
  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showConstructions = !isChildLocked(workTypeConstructions, selWorkType || null);
  const showSets = hasLinkedChildren(workTypeSets, selWorkType || null);

  // Последовательный доступ
  const workTypeDisabled = !selBuilding || isChildLocked(buildingWorkTypes, selBuilding || null);

  function handleBuildingChange(v: string) {
    setSelBuilding(v);
    if (selWorkType) {
      const valid = filterChildren(workTypes, buildingWorkTypes, v || null);
      if (!valid.find((wt) => wt.id === selWorkType)) {
        setSelWorkType("");
        setSelFloor("");
        setSelConstruction("");
        setSelSet("");
        setDrawnPolygons([]);
      }
    }
    if (!v) {
      setSelWorkType("");
      setSelFloor("");
      setSelConstruction("");
      setSelSet("");
      setDrawnPolygons([]);
    }
  }

  function handleWorkTypeChange(v: string) {
    setSelWorkType(v);
    setSelFloor("");
    setSelConstruction("");
    setSelSet("");
    setDrawnPolygons([]);
    setShowOverlayStep(false);
  }

  useEffect(() => {
    loadDicts();
  }, [loadDicts]);

  const needsOverlay = !!(linkedOverlay && overlayImageUrl);
  const validationHints = useMemo(() => {
    const hints: string[] = [];
    if (!cellName.trim()) hints.push("наименование");
    if (!selBuilding) hints.push("место работ");
    if (!selWorkType) hints.push("вид работ");
    if (needsOverlay && drawnPolygons.length === 0) hints.push("область на подложке");
    return hints;
  }, [cellName, selBuilding, selWorkType, needsOverlay, drawnPolygons.length]);

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (validationHints.length > 0) return;
    if (files.length === 0 && !showFileWarning) {
      setShowFileWarning(true);
      return;
    }
    doCreate();
  }

  function handleSkipFiles() {
    setShowFileWarning(false);
    doCreate();
  }

  async function doCreate() {
    if (!project || !user) return;
    setLoading(true);
    setError(null);
    setShowFileWarning(false);

    const name = cellName;
    const buildingId = selBuilding || null;
    const workTypeId = selWorkType || null;
    const floorId = (showFloors ? selFloor : "") || null;
    const constructionId = selConstruction || null;
    const setId = (showSets ? selSet : "") || null;
    const manualTag = cellTag.trim() || null;
    const description = cellDescription.trim() || null;
    const progressRaw = cellProgress.trim();
    const progressPercent = progressRaw === "" ? 100 : Math.max(0, Math.min(100, parseInt(progressRaw, 10)));

    // Автометки из справочников + месяц/год
    const autoTags: string[] = [];
    const bName = buildings.find((b) => b.id === buildingId)?.name;
    const wtName = workTypes.find((w) => w.id === workTypeId)?.name;
    const fName = floors.find((f) => f.id === floorId)?.name;
    const cName = constructions.find((c) => c.id === constructionId)?.name;
    const sName = sets.find((s) => s.id === setId)?.name;
    if (bName) autoTags.push(bName);
    if (wtName) autoTags.push(wtName);
    if (fName) autoTags.push(fName);
    if (cName) autoTags.push(cName);
    if (sName) autoTags.push(sName);
    const now = new Date();
    autoTags.push(MONTHS_RU[now.getMonth()]);
    autoTags.push(String(now.getFullYear()));
    if (manualTag) autoTags.push(manualTag);

    const tag = autoTags.join(", ");

    const cellId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      // Фаза 1: создаём ячейку со статусом draft
      const { error: cellError } = await supabase.from("cells").insert({
        id: cellId,
        project_id: project.id,
        name,
        building_id: buildingId,
        work_type_id: workTypeId,
        floor_id: floorId,
        construction_id: constructionId,
        set_id: setId,
        tag,
        manual_tag: manualTag,
        description,
        status: "__draft__",
        progress_percent: isNaN(progressPercent as number) ? null : progressPercent,
        created_by: user.id,
        assigned_to: user.id,
      });

      if (cellError) {
        setError(cellError.message);
        setLoading(false);
        return;
      }

      // Сохранить маски подложки
      if (drawnPolygons.length > 0 && linkedOverlayId) {
        const maskRows = drawnPolygons.map((polygon) => ({
          cell_id: cellId,
          overlay_id: linkedOverlayId,
          polygon_points: polygon,
        }));
        const { error: maskError } = await supabase.from("cell_overlay_masks").insert(maskRows);
        if (maskError) throw new Error("Ошибка сохранения масок: " + maskError.message);
      }

      // Фаза 2: параллельная загрузка файлов
      if (files.length > 0) {
        const results = await Promise.allSettled(
          files.map((file) => uploadCellFile(project.id, cellId, file, user.id))
        );
        for (const r of results) {
          if (r.status === "fulfilled") uploadedPaths.push(r.value);
        }
      }

      // Фаза 3: активируем ячейку — меняем статус с draft на Новый
      await supabase.from("cells").update({ status: "Новый" }).eq("id", cellId);

      // Запись в историю
      await supabase.from("cell_history").insert({
        cell_id: cellId,
        user_id: user.id,
        action: "created",
        details: { name },
      });

      setLoading(false);
      onCreated();
    } catch (err) {
      // Ячейка осталась в статусе __draft__ — пользователь может повторить
      // Удаляем загруженные файлы, маски и саму ячейку
      try { await removeFiles(uploadedPaths); } catch { /* ignore */ }
      try { await supabase.from("cell_overlay_masks").delete().eq("cell_id", cellId); } catch { /* ignore */ }
      try { await supabase.from("cell_files").delete().eq("cell_id", cellId); } catch { /* ignore */ }
      try { await supabase.from("cells").delete().eq("id", cellId); } catch { /* ignore */ }
      setError(err instanceof Error ? err.message : "Ошибка создания ячейки");
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setShowFileWarning(false);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Удалить одну из нарисованных масок
  function removeDrawnPolygon(index: number) {
    setDrawnPolygons((prev) => prev.filter((_, i) => i !== index));
  }

  return {
    // Form field state
    cellName, setCellName,
    cellTag, setCellTag,
    cellDescription, setCellDescription,
    cellProgress, setCellProgress,
    showProgress, setShowProgress,
    showTag, setShowTag,
    showDescription, setShowDescription,
    // Dictionary selections
    selBuilding, selWorkType, selFloor, setSelFloor,
    selConstruction, setSelConstruction, selSet, setSelSet,
    handleBuildingChange, handleWorkTypeChange,
    // Filtered dictionaries
    buildings, filteredWorkTypes, filteredFloors, filteredConstructions, filteredSets,
    showFloors, showConstructions, showSets,
    workTypeDisabled,
    // Overlay
    showOverlayStep, setShowOverlayStep,
    overlayImageUrl,
    drawnPolygons, setDrawnPolygons,
    matchedOverlays,
    selectedOverlayId, setSelectedOverlayId,
    linkedOverlay, linkedOverlayId,
    overlayType,
    filteredExistingMasks,
    removeDrawnPolygon,
    // Files
    files, handleFileSelect, removeFile,
    showFileWarning, handleSkipFiles,
    // Form state
    loading, error,
    validationHints,
    handleFormSubmit,
  };
}
