import { memo, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { MONTHS_RU } from "@/lib/utils";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import { getStatusStyle } from "@/constants/statusColors";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useDictionaries } from "@/hooks/useDictionaries";
import ProcessFlowModal from "./ProcessFlowModal";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { useCellActionPermissions } from "@/hooks/useCellActionPermissions";
import { useCellDetail } from "@/hooks/useCellDetail";
import CellInfoTab from "./tabs/CellInfoTab";
import CellFilesTab from "./tabs/CellFilesTab";
import CellRemarksTab from "./tabs/CellRemarksTab";
import CellSignaturesTab from "./tabs/CellSignaturesTab";
import CellProcessTab from "./tabs/CellProcessTab";
import CellCommentsTab from "./tabs/CellCommentsTab";
import SupervisionFileSection from "./SupervisionFileSection";

interface Props {
  cellId: string;
  onClose: () => void;
  onUpdated: () => void;
  onSend?: (cell: { id: string; name: string; createdBy: string }) => void;
  onAcknowledge?: (cell: { id: string; name: string }) => void;
  onSupervision?: (cell: { id: string; name: string; createdBy: string }) => void;
  onDownloadAll?: (cellId: string) => void;
  onRemarks?: (cell: { id: string; name: string; sendBackTo: string }) => void;
  onSignCell?: (cell: { id: string; name: string; createdBy: string }) => void;
  onSignWithRemarks?: (cell: { id: string; name: string; sendBackTo: string }) => void;
  onForward?: (cell: { id: string; name: string; originalSenderId: string }) => void;
  onDelegate?: (cell: { id: string; name: string; originalSenderId: string }) => void;
}

function CellDetailModal({ cellId, onClose, onUpdated, onSend, onAcknowledge, onSupervision, onDownloadAll, onRemarks, onSignCell, onSignWithRemarks, onForward, onDelegate }: Props) {
  const { hasPermission, isPortalAdmin, isProjectAdmin } = useProject();
  const { user } = useAuth();
  const { canDo, loading: permsLoading } = useCellActionPermissions();
  const { isMobile } = useMobile();
  const { statuses, getColorKey, canAssignStatus, userRole } = useProjectStatuses();

  const {
    cell, files, remarks, signatures, loading,
    supervisionFile, archiveScans, commentCount, supervisionCount,
    loadCell, loadFiles, loadCounters,
  } = useCellDetail(cellId);

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [limitedEditing, setLimitedEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "files" | "remarks" | "supervision" | "signed" | "process" | "comments">("info");
  const [showProcess, setShowProcess] = useState(false);
  const [attachPreview, setAttachPreview] = useState<{ fileName: string; storagePath: string } | null>(null);

  const { buildings, floors, workTypes, constructions, sets, loadDicts } = useDictionaries();

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editBuilding, setEditBuilding] = useState("");
  const [editWorkType, setEditWorkType] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editConstruction, setEditConstruction] = useState("");
  const [editSet, setEditSet] = useState("");
  const [editProgress, setEditProgress] = useState<string>("");

  // Sync edit fields when cell data loads
  useEffect(() => {
    if (cell) {
      setEditName(cell.name);
      setEditDesc(cell.description || "");
      setEditTag(cell.manual_tag || "");
      setEditBuilding(cell.building_id || "");
      setEditWorkType(cell.work_type_id || "");
      setEditFloor(cell.floor_id || "");
      setEditConstruction(cell.construction_id || "");
      setEditSet(cell.set_id || "");
      setEditProgress(cell.progress_percent != null ? String(cell.progress_percent) : "");
    }
  }, [cell]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    if (showStatusDropdown) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showStatusDropdown]);

  function startEditing() {
    if (isFinalApproved && !confirm("Ячейка окончательно утверждена. Вы уверены, что хотите её редактировать?")) return;
    loadDicts();
    setEditing(true);
  }

  function startLimitedEditing() {
    setLimitedEditing(true);
  }

  async function saveLimitedChanges() {
    if (!user || !cell) return;
    setSaving(true);
    const manualTag = editTag.trim() || null;
    const oldTag = cell.tag || "";
    const oldManualTag = cell.manual_tag || "";
    let newTag = oldTag;
    if (manualTag !== oldManualTag) {
      const parts = oldTag.split(", ").filter((p) => p !== oldManualTag);
      if (manualTag) parts.push(manualTag);
      newTag = parts.join(", ");
    }
    const { error } = await supabase.from("cells").update({
      description: editDesc || null, manual_tag: manualTag, tag: newTag,
    }).eq("id", cellId);
    if (error) {
      setSaving(false);
      alert("Не удалось сохранить изменения: " + error.message);
      return;
    }
    await supabase.from("cell_history").insert({ cell_id: cellId, user_id: user.id, action: "edited" });
    setSaving(false);
    setLimitedEditing(false);
    loadCell();
    onUpdated();
  }

  async function saveChanges() {
    if (!user || !cell) return;
    setSaving(true);
    const manualTag = editTag.trim() || null;
    const autoTags: string[] = [];
    const bName = buildings.find((b) => b.id === editBuilding)?.name;
    const wtName = workTypes.find((w) => w.id === editWorkType)?.name;
    const floorId = editFloor;
    const fName = floors.find((f) => f.id === floorId)?.name;
    const cName = constructions.find((c) => c.id === editConstruction)?.name;
    const sName = sets.find((s) => s.id === editSet)?.name;
    if (bName) autoTags.push(bName);
    if (wtName) autoTags.push(wtName);
    if (fName) autoTags.push(fName);
    if (cName) autoTags.push(cName);
    if (sName) autoTags.push(sName);
    const createdAt = new Date(cell.created_at);
    autoTags.push(MONTHS_RU[createdAt.getMonth()]);
    autoTags.push(String(createdAt.getFullYear()));
    if (manualTag) autoTags.push(manualTag);
    const tag = autoTags.join(", ");

    const progressVal = editProgress.trim() === "" ? null : Math.max(0, Math.min(100, parseInt(editProgress, 10)));

    const { error } = await supabase.from("cells").update({
      name: editName, description: editDesc || null, tag, manual_tag: manualTag,
      building_id: editBuilding || null,
      work_type_id: editWorkType || null,
      floor_id: floorId || null,
      construction_id: editConstruction || null,
      set_id: editSet || null,
      progress_percent: isNaN(progressVal as number) ? null : progressVal,
    }).eq("id", cellId);

    if (error) {
      setSaving(false);
      alert("Не удалось сохранить изменения: " + error.message);
      return;
    }

    await supabase.from("cell_history").insert({ cell_id: cellId, user_id: user.id, action: "edited" });
    setSaving(false);
    setEditing(false);
    loadCell();
    onUpdated();
  }

  async function deleteCell() {
    const msg = isFinalApproved
      ? "Ячейка окончательно утверждена. Удалить её? Это действие необратимо."
      : "Удалить ячейку? Это действие необратимо.";
    if (!confirm(msg)) return;
    await supabase.from("cells").delete().eq("id", cellId);
    onUpdated(); onClose();
  }

  async function handleStatusChange(newStatus: string) {
    if (!user || !cell || newStatus === cell.status) return;
    if (cell.status === "Окончательно утверждён" && !isPortalAdmin) return;
    const isReceiver = cell.assigned_to === user.id && !!cell.assigned_by;
    const returnTo = cell.created_by;
    const update: Record<string, unknown> = { status: newStatus };

    if (isReceiver) {
      update.assigned_to = returnTo;
      update.assigned_by = user.id;
    }

    const { error: statusError } = await supabase.from("cells").update(update).eq("id", cellId);

    if (statusError) {
      alert("Не удалось изменить статус: " + statusError.message);
      return;
    }

    if (isReceiver) {
      await supabase.from("cell_shares").insert({
        cell_id: cellId,
        from_user_id: user.id,
        to_user_id: returnTo,
        message: `Статус изменён на «${newStatus}»`,
      });
    }

    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "status_changed",
      details: { from: cell.status, to: newStatus, returned: isReceiver, to_user_id: returnTo },
    });

    setShowStatusDropdown(false);
    loadCell();
    onUpdated();
  }

  const isFinalApproved = cell?.status === "Окончательно утверждён";
  const isLocked = isFinalApproved && !isPortalAdmin;
  const isSent = !!cell?.assigned_by;
  const canChangeStatus = isPortalAdmin;

  const cellCtx = { created_by: cell?.created_by ?? null, assigned_to: cell?.assigned_to ?? null };
  const cellStatus = cell?.status ?? "";

  const canEditInfo = hasPermission("can_edit_cell") && canDo("edit_info", cellStatus, cellCtx);
  const canEditMask = hasPermission("can_edit_mask") && canDo("edit_mask", cellStatus, cellCtx);
  const canEditDescription = hasPermission("can_edit_cell") && canDo("edit_description", cellStatus, cellCtx);
  const canAddUpdateFiles = hasPermission("can_add_update_files") && canDo("add_update_files", cellStatus, cellCtx);
  const canDeleteFiles = hasPermission("can_add_update_files") && canDo("delete_files", cellStatus, cellCtx);
  const canAttachSupervision = hasPermission("can_add_update_supervision") && canDo("attach_supervision", cellStatus, cellCtx);
  const canAttachScanArchive = hasPermission("can_add_update_scan") && canDo("attach_scan_archive", cellStatus, cellCtx);
  const canDeleteCell = hasPermission("can_delete_cell") && canDo("delete_cell", cellStatus, cellCtx);
  const canAddComments = hasPermission("can_add_comments");
  const canModifyFiles = canAddUpdateFiles;

  if (loading || permsLoading) {
    return (
      <div className="ds-overlay">
        <div className="ds-overlay-bg" />
        <div className="ds-modal p-8" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      </div>
    );
  }
  if (!cell) return null;

  return (
    <div className={`ds-overlay ${isMobile ? "" : "p-4"}`} onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div className={`ds-modal w-full flex flex-col ${isMobile ? "h-full max-h-full rounded-none mx-0" : "max-w-6xl aspect-square max-h-[95vh]"}`} style={isMobile ? { borderRadius: 0 } : undefined} onClick={(e) => e.stopPropagation()}>
        {/* Шапка */}
        <div className={`${isMobile ? "px-3 py-2" : "px-6 py-4"}`} style={{ borderBottom: "1px solid var(--ds-border)", ...(isMobile ? { borderRadius: 0 } : {}) }}>
          <div className="flex items-center justify-between">
            <div className={`${isMobile ? "flex flex-col gap-1 min-w-0 flex-1" : "flex items-center gap-3"}`}>
              <h2 className={`font-semibold ${isMobile ? "text-base truncate" : "text-lg"}`} style={{ color: "var(--ds-text)" }}>{editing ? "Редактирование" : cell.name}</h2>
              <div className="relative">
                <button
                  ref={statusBtnRef}
                  onClick={() => { if (!isLocked && !editing && canChangeStatus) setShowStatusDropdown(!showStatusDropdown); }}
                  className={`inline-flex items-center gap-1 w-[154px] justify-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${!isLocked && !editing && canChangeStatus ? "cursor-pointer hover:opacity-80" : ""}`}
                  style={getStatusStyle(getColorKey(cell.status), cell.progress_percent)}
                  disabled={isLocked || editing || !canChangeStatus}
                >
                  {cell.status}
                  {!isLocked && !editing && canChangeStatus && (
                    <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                <DropdownPortal anchorRef={statusBtnRef} open={showStatusDropdown} className="w-56 max-h-60 overflow-y-auto">
                  <div ref={statusDropdownRef}>
                    {statuses
                      .filter((s) => s.name !== cell.status && canAssignStatus(s.name, userRole))
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleStatusChange(s.name)}
                          className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2"
                          style={{ color: "var(--ds-text)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ds-surface-sunken)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ background: getStatusStyle(getColorKey(s.name), null).background as string }}
                          />
                          {s.name}
                        </button>
                      ))}
                  </div>
                </DropdownPortal>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {!editing && !limitedEditing && canEditInfo && (
                isMobile ? (
                  <button onClick={startEditing} className="ds-icon-btn" title="Редактировать">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                ) : (
                  <button onClick={startEditing} className="ds-btn-secondary px-3 py-1.5 text-sm">Редактировать</button>
                )
              )}
              {!editing && !limitedEditing && canDeleteCell && (
                isMobile ? (
                  <button onClick={deleteCell} className="ds-icon-btn" title="Удалить" style={{ color: "#ef4444" }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                ) : (
                  <button onClick={deleteCell} className="ds-btn-danger px-3 py-1.5 text-sm">Удалить</button>
                )
              )}
              {!editing && !limitedEditing && !canEditInfo && canEditDescription && (
                isMobile ? (
                  <button onClick={startLimitedEditing} className="ds-icon-btn" title="Описание и метки">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                ) : (
                  <button onClick={startLimitedEditing} className="ds-btn-secondary px-3 py-1.5 text-sm">Описание и метки</button>
                )
              )}
              <button onClick={onClose} className="ds-icon-btn">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : ""}`}>
        {/* Вкладки — слева вертикально */}
        <div
          className={`flex shrink-0 gap-0.5 ${isMobile ? "flex-row overflow-x-auto px-2 py-1.5" : "flex-col py-2 w-44"}`}
          style={{ background: "var(--ds-surface-sunken)", borderRight: isMobile ? undefined : "1px solid var(--ds-border)", borderBottom: isMobile ? "1px solid var(--ds-border)" : undefined }}
        >
          {([
            { key: "info" as const, label: "Информация", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, badge: "" },
            { key: "files" as const, label: "Файлы", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>, badge: files.length ? `${files.length}` : "" },
            { key: "remarks" as const, label: "Замечания", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>, badge: remarks.length ? `${remarks.length}` : "" },
            { key: "supervision" as const, label: "АН", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>, badge: supervisionCount ? `${supervisionCount}` : "" },
            { key: "signed" as const, label: "Скан", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, badge: archiveScans.length ? `${archiveScans.length}` : "" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-left text-xs font-medium transition-all whitespace-nowrap ${
                isMobile ? "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg relative" : "px-4 py-2"
              } ${activeTab === tab.key
                ? isMobile ? "ds-btn shadow-sm" : ""
                : "hover:bg-white/30"
              }`}
              style={activeTab === tab.key
                ? isMobile ? undefined : { background: "var(--ds-surface)", color: "var(--ds-text)", borderRight: "3px solid var(--ds-accent)" }
                : { color: "var(--ds-text-muted)" }
              }
              title={tab.label}
            >
              {isMobile ? (
                <>
                  {tab.icon}
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1" style={{ background: "var(--ds-accent)", color: "#fff" }}>{tab.badge}</span>
                  )}
                </>
              ) : (
                `${tab.label}${tab.badge ? ` (${tab.badge})` : ""}`
              )}
            </button>
          ))}
        </div>

        {/* Контент вкладки */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? "p-3" : "p-5"}`}>
          {isLocked && (
            <div className="ds-alert-success flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Ячейка заблокирована (окончательно утверждена)
            </div>
          )}

          {activeTab === "info" && (
            <CellInfoTab
              cell={cell} cellId={cellId}
              editing={editing} setEditing={setEditing}
              limitedEditing={limitedEditing} setLimitedEditing={setLimitedEditing}
              saving={saving} setSaving={setSaving}
              editName={editName} setEditName={setEditName}
              editDesc={editDesc} setEditDesc={setEditDesc}
              editTag={editTag} setEditTag={setEditTag}
              editBuilding={editBuilding} setEditBuilding={setEditBuilding}
              editWorkType={editWorkType} setEditWorkType={setEditWorkType}
              editFloor={editFloor} setEditFloor={setEditFloor}
              editConstruction={editConstruction} setEditConstruction={setEditConstruction}
              editSet={editSet} setEditSet={setEditSet}
              editProgress={editProgress} setEditProgress={setEditProgress}
              signatures={signatures} supervisionFile={supervisionFile} commentCount={commentCount}
              isLocked={isLocked} canModifyFiles={canModifyFiles} canEditMask={canEditMask}
              onSetActiveTab={setActiveTab} onSaveChanges={saveChanges} onSaveLimitedChanges={saveLimitedChanges} onUpdated={onUpdated}
            />
          )}

          {activeTab === "files" && (
            <CellFilesTab cellId={cellId} files={files} isLocked={isLocked} isSent={isSent} canModifyFiles={canModifyFiles} canAddFiles={canAddUpdateFiles} canDeleteFiles={canDeleteFiles} canUpdateFiles={canAddUpdateFiles} isAdmin={isPortalAdmin} onFilesChanged={loadFiles} />
          )}

          {activeTab === "remarks" && (
            <CellRemarksTab remarks={remarks} onPreview={(fileName, storagePath) => setAttachPreview({ fileName, storagePath })} />
          )}

          {activeTab === "supervision" && (
            <SupervisionFileSection cellId={cellId} projectId={cell.project_id} supervisionFile={supervisionFile} isLocked={isLocked} canAttach={canAttachSupervision} canUpdate={canAttachSupervision} cellSendType={cell.send_type} cellStatus={cell.status} cellCreatedBy={cell.created_by} onFilesChanged={() => { loadFiles(); loadCell(); loadCounters(); onUpdated(); }} />
          )}

          {activeTab === "signed" && (
            <CellSignaturesTab cellId={cellId} projectId={cell.project_id} archiveScans={archiveScans} canAttachScan={canAttachScanArchive} isFinalApproved={isFinalApproved} canArchive={hasPermission("can_archive")} isAdmin={isPortalAdmin} onFilesChanged={loadFiles} onArchived={() => { loadCell(); onUpdated(); }} onPreview={(fileName, storagePath) => setAttachPreview({ fileName, storagePath })} />
          )}

          {activeTab === "process" && (
            <CellProcessTab cellId={cellId} cell={cell} signatures={signatures} supervisionFile={supervisionFile} />
          )}

          {activeTab === "comments" && (
            <CellCommentsTab cellId={cellId} canAddComments={canAddComments} onBackToInfo={() => setActiveTab("info")} />
          )}
        </div>

        </div>

        {/* Панель действий внизу окна */}
        {(() => {
          const canSend = onSend && hasPermission("can_send_cells") && !isFinalApproved && (isProjectAdmin || cell.created_by === user?.id);
          const canAcknowledge = onAcknowledge && hasPermission("can_send_cells") && !isFinalApproved && (isProjectAdmin || cell.created_by === user?.id);
          const canSupervise = onSupervision && hasPermission("can_send_cells") && !isFinalApproved && (isProjectAdmin || cell.created_by === user?.id);
          const canDownload = onDownloadAll && files.length > 0 && hasPermission("can_download_files");
          const canViewProcess = hasPermission("can_view_process_block");
          const isAcknowledged = signatures.some((s) => s.status === "Ознакомлен");
          const isApprovedByAN = signatures.some((s) => s.status === "Согласовано");
          const isReviewer = !isFinalApproved && cell.assigned_to === user?.id && cell.send_type === "review";
          const canReviewRemark = isReviewer && onRemarks && hasPermission("can_remark");
          const canReviewSign = isReviewer && onSignCell && hasPermission("can_sign");
          const canReviewSignRemarks = isReviewer && onSignWithRemarks && hasPermission("can_sign");
          const canReviewForward = isReviewer && onForward && hasPermission("can_sign");
          const canReviewDelegate = isReviewer && onDelegate;

          if (!canViewProcess && !canSend && !canAcknowledge && !canSupervise && !canDownload && !isReviewer) return null;

          return (
            <div className={`shrink-0 ${isMobile ? "px-3 py-2" : "px-5 py-3"}`} style={{ borderTop: "1px solid var(--ds-border)" }}>
              <div className={`flex items-center gap-2 ${isMobile ? "flex-wrap" : ""}`}>
                {canViewProcess && (
                  <button onClick={() => setShowProcess(true)} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium shrink-0" title="Маршрут">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="8" width="5" height="6" rx="0.5" />
                      <path d="M1 11h5" />
                      <circle cx="2.5" cy="15.5" r="0.8" fill="currentColor" />
                      <circle cx="4.5" cy="15.5" r="0.8" fill="currentColor" />
                      <rect x="7" y="9" width="4" height="5" rx="0.5" />
                      <circle cx="8.2" cy="15.5" r="0.8" fill="currentColor" />
                      <circle cx="9.8" cy="15.5" r="0.8" fill="currentColor" />
                      <path d="M6 12h1" />
                      <rect x="12" y="9" width="4" height="5" rx="0.5" />
                      <circle cx="13.2" cy="15.5" r="0.8" fill="currentColor" />
                      <circle cx="14.8" cy="15.5" r="0.8" fill="currentColor" />
                      <path d="M11 12h1" />
                      <rect x="17" y="9" width="4" height="5" rx="0.5" />
                      <circle cx="18.2" cy="15.5" r="0.8" fill="currentColor" />
                      <circle cx="19.8" cy="15.5" r="0.8" fill="currentColor" />
                      <path d="M16 12h1" />
                      <rect x="22.5" y="9" width="3.5" height="5" rx="0.5" strokeDasharray="2 1" opacity="0.4" />
                      <path d="M21 12h1" strokeDasharray="1.5 1.5" opacity="0.4" />
                    </svg>
                    {!isMobile && <span>Маршрут</span>}
                  </button>
                )}
                {canViewProcess && (canSend || canAcknowledge || canSupervise || canDownload) && (
                  <div className="w-px h-6 shrink-0" style={{ background: "var(--ds-border)" }} />
                )}
                {canDownload && (
                  <button onClick={() => onDownloadAll(cellId)} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Скачать все файлы">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {!isMobile && <span>Скачать</span>}
                  </button>
                )}
                {canSend && (
                  <button onClick={() => onSend({ id: cell.id, name: cell.name, createdBy: cell.created_by })} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Отправить на проверку">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {!isMobile && <span>На проверку</span>}
                  </button>
                )}
                {canAcknowledge && (
                  <button onClick={() => onAcknowledge({ id: cell.id, name: cell.name })} className={`ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm ${isAcknowledged ? "ds-action-btn--active" : ""}`} title={isAcknowledged ? "Ознакомлен производителем работ" : "Отправить на ознакомление"}>
                    <svg className="w-4 h-4" fill={isAcknowledged ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {!isMobile && <span>Ознакомление</span>}
                  </button>
                )}
                {canSupervise && (
                  <button onClick={() => onSupervision({ id: cell.id, name: cell.name, createdBy: cell.created_by })} className={`ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm ${isApprovedByAN ? "ds-action-btn--active" : ""}`} title={isApprovedByAN ? "Согласовано авторским надзором" : "Отправить на авторский надзор"}>
                    <svg className="w-4 h-4" fill={isApprovedByAN ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    {!isMobile && <span>Надзор</span>}
                  </button>
                )}
                {isReviewer && (canSend || canAcknowledge || canSupervise || canDownload) && (
                  <div className="w-px h-6 shrink-0" style={{ background: "var(--ds-border)" }} />
                )}
                {canReviewRemark && (
                  <button onClick={() => onRemarks({ id: cell.id, name: cell.name, sendBackTo: cell.created_by })} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Замечания">
                    <svg className="w-4 h-4" fill="none" stroke="#f97316" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {!isMobile && <span>Замечания</span>}
                  </button>
                )}
                {canReviewSign && (
                  <button onClick={() => onSignCell({ id: cell.id, name: cell.name, createdBy: cell.created_by })} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Подписать">
                    <svg className="w-4 h-4" fill="none" stroke="#0d9488" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {!isMobile && <span>Подписать</span>}
                  </button>
                )}
                {canReviewSignRemarks && (
                  <button onClick={() => onSignWithRemarks({ id: cell.id, name: cell.name, sendBackTo: cell.created_by })} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Подписать с замечанием">
                    <svg className="w-4 h-4" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {!isMobile && <span>С замечанием</span>}
                  </button>
                )}
                {canReviewForward && (
                  <button onClick={() => onForward({ id: cell.id, name: cell.name, originalSenderId: cell.created_by })} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Подписать и переслать">
                    <svg className="w-4 h-4" fill="none" stroke="#6366f1" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    {!isMobile && <span>Переслать</span>}
                  </button>
                )}
                {canReviewDelegate && (
                  <button onClick={() => onDelegate({ id: cell.id, name: cell.name, originalSenderId: cell.created_by })} className="ds-action-btn flex items-center gap-1.5 px-2.5 py-1.5 text-sm" title="Делегировать">
                    <svg className="w-4 h-4" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {!isMobile && <span>Делегировать</span>}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        {showProcess && <ProcessFlowModal cellId={cellId} onClose={() => setShowProcess(false)} />}
        {attachPreview && <FilePreviewModal fileName={attachPreview.fileName} storagePath={attachPreview.storagePath} onClose={() => setAttachPreview(null)} />}
      </div>
    </div>
  );
}


export default memo(CellDetailModal);
