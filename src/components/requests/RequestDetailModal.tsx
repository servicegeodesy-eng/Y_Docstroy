import { memo, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { shortName } from "@/lib/utils";
import { useDictLinks, filterChildren, isChildLocked, hasLinkedChildren, compositeKey } from "@/hooks/useDictLinks";
import { useDictionaries } from "@/hooks/useDictionaries";
import DictSelect from "@/components/registry/DictSelect";
import CellFileSection from "@/components/registry/CellFileSection";
import CellMaskSection from "@/components/registry/CellMaskSection";
import PublicCommentsSection from "@/components/registry/PublicCommentsSection";
import ProcessFlowModal from "@/components/registry/ProcessFlowModal";
import DropdownPortal from "@/components/ui/DropdownPortal";
import type { CellFile } from "@/types";

interface Props {
  cellId: string;
  onClose: () => void;
  onUpdated: () => void;
  onAcknowledged?: () => void;
}

interface ProfileShort {
  last_name: string;
  first_name: string;
  middle_name: string | null;
}

interface RequestCell {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to: string | null;
  assigned_by: string | null;
  original_sender_id: string | null;
  request_work_type: string | null;
  project_id: string;
  building_id: string | null;
  work_type_id: string | null;
  floor_id: string | null;
  construction_id: string | null;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_constructions: { name: string } | null;
  creator_profile: ProfileShort | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
}

const REQUEST_STATUSES = ["В работе", "Выполнено", "Отклонено"];

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  "В работе": { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" },
  "Выполнено": { background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" },
  "Отклонено": { background: "color-mix(in srgb, #ef4444 15%, var(--ds-surface))", color: "#ef4444" },
};

function RequestDetailModal({ cellId, onClose, onUpdated, onAcknowledged }: Props) {
  const { isPortalAdmin, isAdmin, isProjectAdmin, hasPermission } = useProject();
  const canExecuteRequests = hasPermission("can_execute_requests");
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const [cell, setCell] = useState<RequestCell | null>(null);
  const [files, setFiles] = useState<CellFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProcess, setShowProcess] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);

  // Edit state
  const [editDesc, setEditDesc] = useState("");
  const [editRequestWorkType, setEditRequestWorkType] = useState("");
  const [editBuilding, setEditBuilding] = useState("");
  const [editWorkType, setEditWorkType] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editConstruction, setEditConstruction] = useState("");

  const { buildings, floors, workTypes, constructions, loadDicts } = useDictionaries();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors } = useDictLinks();

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

  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const showConstructions = !isChildLocked(workTypeConstructions, editWorkType || null);
  const workTypeDisabled = !editBuilding || isChildLocked(buildingWorkTypes, editBuilding || null);

  function handleEditBuildingChange(v: string) {
    setEditBuilding(v);
    if (editWorkType) {
      const valid = filterChildren(workTypes, buildingWorkTypes, v || null);
      if (!valid.some((wt) => wt.id === editWorkType)) {
        setEditWorkType("");
        setEditFloor("");
        setEditConstruction("");
      }
    }
    if (!v) {
      setEditWorkType("");
      setEditFloor("");
      setEditConstruction("");
    }
  }

  function handleEditWorkTypeChange(v: string) {
    setEditWorkType(v);
    setEditFloor("");
    setEditConstruction("");
  }

  useEffect(() => {
    loadCell();
    loadFiles();
    loadAcknowledged();
  }, [cellId]);

  async function loadAcknowledged() {
    const { count } = await supabase
      .from("cell_history")
      .select("id", { count: "exact", head: true })
      .eq("cell_id", cellId)
      .eq("action", "request_acknowledged");
    setIsAcknowledged((count || 0) > 0);
  }

  async function handleAcknowledge() {
    if (!user) return;
    setAcknowledging(true);
    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "request_acknowledged",
      details: { status: "Ознакомлен" },
    });
    setIsAcknowledged(true);
    setAcknowledging(false);
    onUpdated();
    if (onAcknowledged) onAcknowledged();
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    if (showStatusDropdown) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showStatusDropdown]);

  async function loadCell() {
    const { data } = await supabase
      .from("cells")
      .select(`id, name, description, status, created_at, updated_at, created_by, assigned_to, assigned_by, original_sender_id, request_work_type, project_id, building_id, work_type_id, floor_id, construction_id,
        dict_buildings(name), dict_floors(name), dict_work_types(name), dict_constructions(name),
        creator_profile:profiles!created_by(last_name, first_name, middle_name),
        assignee:profiles!assigned_to(last_name, first_name, middle_name),
        assigner:profiles!assigned_by(last_name, first_name, middle_name)`)
      .eq("id", cellId)
      .single();
    if (data) {
      const c = data as unknown as RequestCell;
      setCell(c);
      setEditDesc(c.description || "");
      setEditRequestWorkType(c.request_work_type || "");
      setEditBuilding(c.building_id || "");
      setEditWorkType(c.work_type_id || "");
      setEditFloor(c.floor_id || "");
      setEditConstruction(c.construction_id || "");
    }
    setLoading(false);
  }

  async function loadFiles() {
    const { data } = await supabase.from("cell_files").select("*").eq("cell_id", cellId).order("uploaded_at", { ascending: false });
    if (data) setFiles(data as CellFile[]);
  }

  const isCreator = cell?.created_by === user?.id;
  const isSent = !!cell?.assigned_by;
  const isNew = cell?.status === "Новый";
  const isCompleted = cell?.status === "Выполнено";
  const isRejected = cell?.status === "Отклонено";
  const isFinal = isCompleted || isRejected;

  // Может редактировать: портальный администратор ИЛИ создатель до завершения
  const canEdit = isPortalAdmin || isAdmin || (isCreator && !isSent && isNew);
  const canDelete = isPortalAdmin || isAdmin || (isCreator && !isSent && isNew);
  const canChangeStatus = isPortalAdmin || isAdmin;

  function startEditing() {
    loadDicts();
    setEditing(true);
  }

  async function saveChanges() {
    if (!user || !cell) return;
    setSaving(true);

    const bName = buildings.find((b) => b.id === editBuilding)?.name || "";
    const wtName = workTypes.find((w) => w.id === editWorkType)?.name || "";
    const name = [editRequestWorkType, bName, wtName].filter(Boolean).join(" — ") || "Заявка";
    const floorId = showFloors ? editFloor : "";

    await supabase.from("cells").update({
      name,
      description: editDesc.trim() || null,
      request_work_type: editRequestWorkType || null,
      building_id: editBuilding || null,
      work_type_id: editWorkType || null,
      floor_id: floorId || null,
      construction_id: editConstruction || null,
    }).eq("id", cellId);

    await supabase.from("cell_history").insert({ cell_id: cellId, user_id: user.id, action: "edited" });
    setSaving(false);
    setEditing(false);
    loadCell();
    onUpdated();
  }

  async function deleteCell() {
    if (!confirm("Удалить заявку? Это действие необратимо.")) return;
    await supabase.from("cells").delete().eq("id", cellId);
    onUpdated();
    onClose();
  }

  async function handleStatusChange(newStatus: string) {
    if (!user || !cell || newStatus === cell.status) return;
    await supabase.from("cells").update({ status: newStatus }).eq("id", cellId);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "status_changed",
      details: { from: cell.status, to: newStatus },
    });
    setShowStatusDropdown(false);
    loadCell();
    onUpdated();
  }

  if (loading) {
    return (
      <div className="ds-overlay">
        <div className="ds-modal p-8" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      </div>
    );
  }
  if (!cell) return null;

  return (
    <div className={`ds-overlay ${isMobile ? "" : "p-4"}`} onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div className={`ds-modal w-full flex flex-col ${isMobile ? "h-full max-h-full rounded-none mx-0" : "max-w-3xl max-h-[90vh]"}`} style={isMobile ? { borderRadius: 0 } : undefined} onClick={(e) => e.stopPropagation()}>
        {/* Шапка */}
        <div className={`ds-modal-header ${isMobile ? "px-3 py-2" : ""}`} style={isMobile ? { borderRadius: 0 } : undefined}>
          <div className="flex items-center gap-3">
            <h2 className="ds-modal-title">{editing ? "Редактирование" : cell.name}</h2>
            <div className="relative">
              <button
                ref={statusBtnRef}
                onClick={() => { if (canChangeStatus && !editing) setShowStatusDropdown(!showStatusDropdown); }}
                className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${canChangeStatus && !editing ? "cursor-pointer hover:opacity-80" : ""}`}
                style={STATUS_STYLES[cell.status] || { background: "color-mix(in srgb, #6b7280 15%, var(--ds-surface))", color: "var(--ds-text-muted)" }}
                disabled={!canChangeStatus || editing}
              >
                {cell.status}
                {canChangeStatus && !editing && (
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              <DropdownPortal anchorRef={statusBtnRef} open={showStatusDropdown} className="w-44">
                <div ref={statusDropdownRef}>
                  {REQUEST_STATUSES
                    .filter((s) => s !== cell.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors" style={{ color: "var(--ds-text)" }}
                      >
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={STATUS_STYLES[s]}>{s}</span>
                      </button>
                    ))}
                </div>
              </DropdownPortal>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && isFinal && isCreator && !isAcknowledged && (
              <button
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}
              >
                {acknowledging ? "..." : "Ознакомлен"}
              </button>
            )}
            {!editing && canEdit && !isFinal && (
              isMobile ? (
                <button onClick={startEditing} className="ds-icon-btn" title="Редактировать">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              ) : (
                <button onClick={startEditing} className="px-3 py-1.5 text-sm rounded-lg transition-colors" style={{ color: "var(--ds-accent)" }}>Редактировать</button>
              )
            )}
            {!editing && canDelete && !isFinal && (
              isMobile ? (
                <button onClick={deleteCell} className="ds-icon-btn" title="Удалить" style={{ color: "#ef4444" }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              ) : (
                <button onClick={deleteCell} className="px-3 py-1.5 text-sm rounded-lg transition-colors" style={{ color: "#ef4444" }}>Удалить</button>
              )
            )}
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className={`flex-1 ${isMobile ? "p-3" : "p-6"} space-y-5 overflow-y-auto`}>
          {/* Файлы — вверху, видны создателю, выполняющим и админам */}
          {!editing && (isCreator || canExecuteRequests || isAdmin || isPortalAdmin || isProjectAdmin) && (
            <CellFileSection cellId={cellId} files={files} isLocked={isFinal ?? false} isSent={isSent} onFilesChanged={loadFiles} />
          )}

          {editing ? (
            <>
              <div>
                <label className="ds-label">
                  Работа <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  required
                  value={editRequestWorkType}
                  onChange={(e) => setEditRequestWorkType(e.target.value)}
                  className="ds-input w-full"
                >
                  <option value="" disabled>Выберите вид работы</option>
                  <option value="Съемка">Съемка</option>
                  <option value="Разбивка">Разбивка</option>
                  <option value="Проверка">Проверка</option>
                  <option value="Повторная съемка">Повторная съемка</option>
                  <option value="Вынос репера">Вынос репера</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DictSelect label="Место работ" name="building_id" items={buildings} required value={editBuilding} onChange={handleEditBuildingChange} />
                <DictSelect label="Вид работ" name="work_type_id" items={filteredWorkTypes} required value={editWorkType} onChange={handleEditWorkTypeChange} disabled={workTypeDisabled} />
                {showFloors && (
                  <DictSelect label="Уровни и виды" name="floor_id" items={filteredFloors} value={editFloor} onChange={setEditFloor} />
                )}
                {showConstructions && <DictSelect label="Конструкции и зоны" name="construction_id" items={filteredConstructions} value={editConstruction} onChange={setEditConstruction} />}
              </div>
              <div>
                <label className="ds-label">Описание</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="ds-input w-full resize-none" placeholder="Укажите телефон для связи и другую полезную информацию по заявке" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditing(false)} className="ds-btn-secondary">Отмена</button>
                <button onClick={saveChanges} disabled={saving} className="ds-btn">
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Информация */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span style={{ color: "var(--ds-text-muted)" }}>Работа:</span>{" "}
                  {cell.request_work_type ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in srgb, #6366f1 15%, var(--ds-surface))", color: "#6366f1" }}>{cell.request_work_type}</span>
                  ) : <span style={{ color: "var(--ds-text)" }}>{"\u2014"}</span>}
                </div>
                <div>
                  <span style={{ color: "var(--ds-text-muted)" }}>Место работ:</span>{" "}
                  <span style={{ color: "var(--ds-text)" }}>{cell.dict_buildings?.name || "\u2014"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--ds-text-muted)" }}>Вид работ:</span>{" "}
                  <span style={{ color: "var(--ds-text)" }}>{cell.dict_work_types?.name || "\u2014"}</span>
                </div>
                {cell.dict_floors?.name && (
                  <div>
                    <span style={{ color: "var(--ds-text-muted)" }}>Уровни и виды:</span>{" "}
                    <span style={{ color: "var(--ds-text)" }}>{cell.dict_floors.name}</span>
                  </div>
                )}
                <div>
                  <span style={{ color: "var(--ds-text-muted)" }}>Конструкции и зоны:</span>{" "}
                  <span style={{ color: "var(--ds-text)" }}>{cell.dict_constructions?.name || "\u2014"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--ds-text-muted)" }}>Создатель:</span>{" "}
                  <span style={{ color: "var(--ds-text)" }}>{shortName(cell.creator_profile)}</span>
                </div>
                {cell.assignee && (
                  <div>
                    <span style={{ color: "var(--ds-text-muted)" }}>Назначена:</span>{" "}
                    <span style={{ color: "var(--ds-text)" }}>{shortName(cell.assignee)}</span>
                  </div>
                )}
              </div>

              {cell.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1" style={{ color: "var(--ds-text)" }}>Описание</h4>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ds-text-muted)" }}>{cell.description}</p>
                </div>
              )}

              <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                Создана: {new Date(cell.created_at).toLocaleString("ru-RU")}
                {cell.updated_at !== cell.created_at && (<> | Обновлена: {new Date(cell.updated_at).toLocaleString("ru-RU")}</>)}
              </div>

              {/* Миниатюра подложки с маской */}
              <CellMaskSection
                cellId={cellId}
                cellStatus={cell.status}
                buildingId={cell.building_id}
                workTypeId={cell.work_type_id}
                floorId={cell.floor_id}
                constructionId={cell.construction_id}
                signatures={[]}
                isLocked
                canModifyFiles={false}
                canEditMaskProp={false}
                miniature
                colorKeyOverride={cell.status === "Выполнено" ? "green" : cell.status === "Отклонено" ? "red" : "orange"}
                onUpdated={loadCell}
              />
            </>
          )}

          {/* Процесс */}
          {!editing && (
            <div>
              <button
                onClick={() => setShowProcess(true)}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--ds-accent)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Процесс
              </button>
            </div>
          )}

          {/* Комментарии */}
          <PublicCommentsSection cellId={cellId} />
        </div>

        {/* Модалка процесса */}
        {showProcess && (
          <ProcessFlowModal cellId={cellId} onClose={() => setShowProcess(false)} />
        )}
      </div>
    </div>
  );
}


export default memo(RequestDetailModal);
