import { useMemo } from "react";
import { useMobile } from "@/lib/MobileContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, isChildLocked, hasLinkedChildren, compositeKey } from "@/hooks/useDictLinks";
import { InfoRow, EditSelect } from "@/components/registry/CellDetailHelpers";
import CellStatusPanel from "@/components/registry/CellStatusPanel";
import CellMaskSection from "@/components/registry/CellMaskSection";
import type { CellWithDicts, SignatureRow } from "@/hooks/useCellDetail";
import type { CellFile } from "@/types";

interface CellInfoTabProps {
  cell: CellWithDicts;
  cellId: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  limitedEditing: boolean;
  setLimitedEditing: (v: boolean) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  editTag: string;
  setEditTag: (v: string) => void;
  editBuilding: string;
  setEditBuilding: (v: string) => void;
  editWorkType: string;
  setEditWorkType: (v: string) => void;
  editFloor: string;
  setEditFloor: (v: string) => void;
  editConstruction: string;
  setEditConstruction: (v: string) => void;
  editSet: string;
  setEditSet: (v: string) => void;
  editProgress: string;
  setEditProgress: (v: string) => void;
  signatures: SignatureRow[];
  supervisionFile: CellFile | null;
  commentCount: number;
  isLocked: boolean;
  canModifyFiles: boolean;
  canEditMask: boolean;
  onSetActiveTab: (tab: "comments") => void;
  onSaveChanges: () => void;
  onSaveLimitedChanges: () => void;
  onUpdated: () => void;
}

export default function CellInfoTab({
  cell, cellId, editing, setEditing, limitedEditing, setLimitedEditing,
  saving, editName, setEditName, editDesc, setEditDesc, editTag, setEditTag,
  editBuilding, setEditBuilding, editWorkType, setEditWorkType,
  editFloor, setEditFloor, editConstruction, setEditConstruction,
  editSet, setEditSet, editProgress, setEditProgress,
  signatures, supervisionFile, commentCount,
  isLocked, canModifyFiles, canEditMask,
  onSetActiveTab, onSaveChanges, onSaveLimitedChanges, onUpdated,
}: CellInfoTabProps) {
  const { isMobile } = useMobile();
  const { buildings, floors, workTypes, constructions, sets } = useDictionaries();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors, workTypeSets } = useDictLinks();

  const filteredWorkTypes = useMemo(
    () => filterChildren(workTypes, buildingWorkTypes, editBuilding || null),
    [workTypes, buildingWorkTypes, editBuilding],
  );
  const floorKey = compositeKey(editBuilding, editWorkType);
  const filteredFloors = useMemo(
    () => filterChildren(floors, buildingWorkTypeFloors, floorKey),
    [floors, buildingWorkTypeFloors, floorKey],
  );
  const filteredConstructions = useMemo(
    () => filterChildren(constructions, workTypeConstructions, editWorkType || null),
    [constructions, workTypeConstructions, editWorkType],
  );
  const filteredSets = useMemo(
    () => filterChildren(sets, workTypeSets, editWorkType || null),
    [sets, workTypeSets, editWorkType],
  );

  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showSets = hasLinkedChildren(workTypeSets, editWorkType || null);
  const workTypeDisabled = !editBuilding || isChildLocked(buildingWorkTypes, editBuilding || null);
  const showConstructions = !isChildLocked(workTypeConstructions, editWorkType || null);

  function handleEditBuildingChange(v: string) {
    setEditBuilding(v);
    if (editWorkType) {
      const valid = filterChildren(workTypes, buildingWorkTypes, v || null);
      if (!valid.some((wt) => wt.id === editWorkType)) {
        setEditWorkType("");
        setEditFloor("");
        setEditConstruction("");
        setEditSet("");
      }
    }
    if (!v) {
      setEditWorkType("");
      setEditFloor("");
      setEditConstruction("");
      setEditSet("");
    }
  }

  function handleEditWorkTypeChange(v: string) {
    setEditWorkType(v);
    setEditFloor("");
    setEditConstruction("");
    setEditSet("");
  }

  return (
    <div className="space-y-4">
      {limitedEditing ? (
        <>
          <div><label className="ds-label">Описание</label><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="ds-input resize-none" /></div>
          <div><label className="ds-label">Пользовательская метка</label><input value={editTag} onChange={(e) => setEditTag(e.target.value)} className="ds-input" /></div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setLimitedEditing(false)} className="ds-btn-secondary">Отмена</button>
            <button onClick={onSaveLimitedChanges} disabled={saving} className="ds-btn">{saving ? "Сохранение..." : "Сохранить"}</button>
          </div>
        </>
      ) : editing ? (
        <>
          <div><label className="ds-label">Наименование</label><input value={editName} onChange={(e) => setEditName(e.target.value)} className="ds-input" /></div>
          <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <EditSelect label="Место работ" value={editBuilding} onChange={handleEditBuildingChange} items={buildings} />
            <EditSelect label="Вид работ" value={editWorkType} onChange={handleEditWorkTypeChange} items={filteredWorkTypes} disabled={workTypeDisabled} />
            {showFloors && <EditSelect label="Уровни и виды" value={editFloor} onChange={setEditFloor} items={filteredFloors} />}
            {showConstructions && <EditSelect label="Конструкции и зоны" value={editConstruction} onChange={setEditConstruction} items={filteredConstructions} />}
            {showSets && <EditSelect label="Комплект" value={editSet} onChange={setEditSet} items={filteredSets} />}
            <div>
              <label className="ds-label">Выполнено (%)</label>
              <input type="number" min="0" max="100" value={editProgress} onChange={(e) => setEditProgress(e.target.value)} placeholder="0–100" className="ds-input" />
            </div>
          </div>
          <div><label className="ds-label">Метка</label><input value={editTag} onChange={(e) => setEditTag(e.target.value)} className="ds-input" /></div>
          <div><label className="ds-label">Описание</label><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="ds-input resize-none" /></div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(false)} className="ds-btn-secondary">Отмена</button>
            <button onClick={onSaveChanges} disabled={saving} className="ds-btn">{saving ? "Сохранение..." : "Сохранить"}</button>
          </div>
        </>
      ) : (
        <>
          <div className={`flex gap-6 ${isMobile ? "flex-col" : ""}`} style={{ minWidth: 0 }}>
            {/* Левая колонка — информация + процесс (2/5) */}
            <div className={`min-w-0 flex flex-col flex-1 ${isMobile ? "" : ""}`}>
              <div className="space-y-3 text-sm relative">
                {/* Значок комментариев */}
                <button
                  onClick={() => onSetActiveTab("comments")}
                  className="absolute top-0 right-0 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ color: "var(--ds-text-muted)" }}
                  title="Комментарии"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {commentCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white" style={{ background: "var(--ds-accent)" }}>
                      {commentCount}
                    </span>
                  )}
                </button>
                <InfoRow label="Место работ" value={cell.dict_buildings?.name} />
                <InfoRow label="Вид работ" value={cell.dict_work_types?.name} />
                {cell.dict_floors?.name && <InfoRow label="Уровни и виды" value={cell.dict_floors?.name} />}
                <InfoRow label="Конструкции и зоны" value={cell.dict_constructions?.name} />
                {cell.dict_sets?.name && <InfoRow label="Комплект" value={cell.dict_sets.name} />}
                <div>
                  <span style={{ color: "var(--ds-text-muted)" }}>Выполнено:</span>{" "}
                  {cell.progress_percent != null ? (
                    <span style={{ color: "var(--ds-text)" }}>
                      {cell.progress_percent}%
                      <span className="inline-block w-12 h-1.5 ml-2 rounded-full overflow-hidden align-middle" style={{ background: "var(--ds-border)" }}>
                        <span className="block h-full rounded-full" style={{ width: `${cell.progress_percent}%`, background: cell.progress_percent <= 30 ? "#ef4444" : cell.progress_percent <= 70 ? "#eab308" : "#22c55e" }} />
                      </span>
                    </span>
                  ) : <span style={{ color: "var(--ds-text)" }}>{"\u2014"}</span>}
                </div>
                {cell.manual_tag && <InfoRow label="Пользовательская метка" value={cell.manual_tag} />}
                {cell.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Описание</h4>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ds-text-muted)" }}>{cell.description}</p>
                  </div>
                )}
                {cell.tag && (
                  <div>
                    <h4 className="text-sm font-medium mb-1.5" style={{ color: "var(--ds-text-muted)" }}>Все метки</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {cell.tag.split(", ").map((t, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                  Создана: {new Date(cell.created_at).toLocaleString("ru-RU")}
                  {cell.updated_at !== cell.created_at && (<> | Обновлена: {new Date(cell.updated_at).toLocaleString("ru-RU")}</>)}
                </div>
              </div>
              {/* Разделитель + блок процесса */}
              <div className="my-4" style={{ borderTop: "1px solid var(--ds-border)" }} />
              <CellStatusPanel cellId={cellId} cell={{ status: cell.status, assigned_to: cell.assigned_to, assigned_by: cell.assigned_by, assignee: cell.assignee, assigner: cell.assigner, creator: cell.creator_profile }} signatures={signatures} hasSupervisionApproval={!!supervisionFile} />
            </div>
            {/* Правая колонка — подложка с маской */}
            {!isMobile && (
              <div className="min-w-0 empty:hidden" style={{ flex: "1.5 1 0%" }}>
                <CellMaskSection cellId={cellId} cellStatus={cell.status} buildingId={cell.building_id} workTypeId={cell.work_type_id} floorId={cell.floor_id} constructionId={cell.construction_id} signatures={signatures} isLocked={isLocked} canModifyFiles={canModifyFiles} canEditMaskProp={canEditMask} miniature onUpdated={onUpdated} />
              </div>
            )}
          </div>
          {/* На мобильном — маска под информацией */}
          {isMobile && (
            <CellMaskSection cellId={cellId} cellStatus={cell.status} buildingId={cell.building_id} workTypeId={cell.work_type_id} floorId={cell.floor_id} constructionId={cell.construction_id} signatures={signatures} isLocked={isLocked} canModifyFiles={canModifyFiles} canEditMaskProp={canEditMask} miniature onUpdated={onUpdated} />
          )}
        </>
      )}
    </div>
  );
}
