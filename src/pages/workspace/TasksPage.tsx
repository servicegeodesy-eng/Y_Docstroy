import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useTasksData } from "@/hooks/useTasksData";
import CellDetailModal from "@/components/registry/CellDetailModal";
import RemarksModal from "@/components/registry/RemarksModal";
import SignWithRemarksModal from "@/components/registry/SignWithRemarksModal";
import AcknowledgeModal from "@/components/registry/AcknowledgeModal";
import ForwardCellModal from "@/components/registry/ForwardCellModal";
import DelegateCellModal from "@/components/registry/DelegateCellModal";
import SendCellModal from "@/components/registry/SendCellModal";
import SendToAcknowledgeModal from "@/components/registry/SendToAcknowledgeModal";
import SendToSupervisionModal from "@/components/registry/SendToSupervisionModal";
import CorrectionModal from "@/components/registry/CorrectionModal";
import ArchiveModal from "@/components/registry/ArchiveModal";
import HistoryTable from "@/components/tasks/HistoryTable";
import ActiveTable from "@/components/tasks/ActiveTable";
import TasksMobileCards from "@/components/tasks/TasksMobileCards";
import Pagination, { usePagination, getStoredPageSize } from "@/components/ui/Pagination";
import RowScaleButton, { useRowScale } from "@/components/ui/RowScaleButton";
import { downloadAsZip } from "@/lib/utils";
import TaskRequests from "@/components/tasks/TaskRequests";
import TaskFileShares from "@/components/tasks/TaskFileShares";
import { isGeoMode } from "@/lib/geoMode";
import FilePreviewModal from "@/components/ui/FilePreviewModal";

type SectionKey = "registry" | "requests" | "fileshare";
type TabKey = "all" | "incoming" | "outgoing" | "history_all" | "history_in" | "history_out";

const activeTabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "incoming", label: "Входящие", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> },
  { key: "outgoing", label: "Исходящие", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0l-4 4m4-4v12" /></svg> },
  { key: "all", label: "Все", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
];

const historyTabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "history_all", label: "Вся история", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: "history_in", label: "Входящие", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> },
  { key: "history_out", label: "Исходящие", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0l-4 4m4-4v12" /></svg> },
];

const isHistoryTab = (t: TabKey) => t.startsWith("history_");

const emptyMsg: Record<string, string> = {
  all: "Нет активных задач.",
  incoming: "Нет входящих задач.",
  outgoing: "Нет исходящих задач.",
  history_all: "История пуста.",
  history_in: "Нет входящих в истории.",
  history_out: "Нет исходящих в истории.",
};

const sections: { key: SectionKey; label: string; icon: JSX.Element }[] = [
  {
    key: "registry", label: "Реестр",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    key: "requests", label: "Заявки",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    key: "fileshare", label: "Файлообмен",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>,
  },
];

export default function TasksPage() {
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const { getColorKey } = useProjectStatuses();
  const geo = isGeoMode();
  const [section, setSection] = useState<SectionKey>(geo ? "requests" : "registry");
  const [activeTab, setActiveTab] = useState<TabKey>("incoming");

  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [remarksCell, setRemarksCell] = useState<{ id: string; name: string; sendBackTo: string } | null>(null);
  const [signRemarksCell, setSignRemarksCell] = useState<{ id: string; name: string; sendBackTo: string } | null>(null);
  const [acknowledgeCell, setAcknowledgeCell] = useState<{ id: string; name: string } | null>(null);
  const [forwardCell, setForwardCell] = useState<{ id: string; name: string; originalSenderId: string } | null>(null);
  const [delegateCell, setDelegateCell] = useState<{ id: string; name: string; originalSenderId: string } | null>(null);
  const [sendReviewCell, setSendReviewCell] = useState<{ id: string; name: string; createdBy: string } | null>(null);
  const [sendAcknowledgeCell, setSendAcknowledgeCell] = useState<{ id: string; name: string } | null>(null);
  const [supervisionCell, setSupervisionCell] = useState<{ id: string; name: string; createdBy: string } | null>(null);
  const [correctionCell, setCorrectionCell] = useState<{ id: string; name: string; sendBackTo: string } | null>(null);
  const [archiveCell, setArchiveCell] = useState<{ id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const { scale, cycleScale } = useRowScale();

  const {
    cells,
    loading,
    loadData,
    filteredActive,
    filteredHistory,
    incomingCount,
    requestsBadge,
    filesBadge,
    setArchivedIds,
    canReview,
    canSupervise,
    canArchive,
    canAcknowledgeCell,
    canSendCells,
    getReturnTo,
    handleSign,
    handleApproveSupervision,
    hasPermission,
  } = useTasksData(activeTab);

  // Сброс страницы при смене вкладки
  useEffect(() => { setPage(1); }, [activeTab]);

  const paginatedActive = usePagination(filteredActive, page, pageSize);
  const paginatedHistory = usePagination(filteredHistory, page, pageSize);

  function handleArchiveComplete() {
    if (archiveCell) {
      setArchivedIds((prev) => new Set([...prev, archiveCell.id]));
      setArchiveCell(null);
    }
    loadData();
  }

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>Задачи</h2>
          {!isMobile && section === "registry" && <RowScaleButton scale={scale} onCycle={cycleScale} />}
        </div>
      </div>

      {/* Переключатель разделов — скрыт в geo-режиме (только заявки) */}
      {!geo && (
        <div className={`flex gap-1 rounded-lg p-1 ${isMobile ? "mb-3" : "mb-5"}`} style={{ background: "var(--ds-surface-sunken)" }}>
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 ${isMobile ? "px-2 py-1.5 text-xs" : "px-3 py-1.5 text-sm"} font-medium rounded-md transition-colors whitespace-nowrap ${
                section === s.key ? "ds-btn shadow-sm" : ""
              }`}
              style={section !== s.key ? { color: "var(--ds-text-muted)" } : undefined}
            >
              {s.icon}
              {!isMobile && s.label}
              {s.key === "registry" && incomingCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
              {s.key === "requests" && requestsBadge > 0 && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
              {s.key === "fileshare" && filesBadge > 0 && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {section === "requests" && <TaskRequests />}
      {!geo && section === "fileshare" && <TaskFileShares />}
      {section !== "registry" ? null : (
      <>
      {/* Далее — оригинальный контент реестра */}

      {/* Tabs */}
      <div className={`flex items-center gap-4 ${isMobile ? "mb-3 overflow-x-auto" : "mb-6"} flex-wrap`}>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--ds-surface-sunken)" }}>
          {activeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 ${isMobile ? "px-2 py-1.5" : "px-3 py-1.5 text-sm"} font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key ? "ds-btn shadow-sm" : ""
              }`}
              style={activeTab !== tab.key ? { color: "var(--ds-text-muted)" } : undefined}
              title={tab.label}
            >
              {isMobile ? tab.icon : tab.label}
            </button>
          ))}
        </div>
        {!isMobile && <div className="h-5 w-px" style={{ background: "var(--ds-border)" }} />}
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--ds-surface-sunken)" }}>
          {historyTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 ${isMobile ? "px-2 py-1.5" : "px-3 py-1.5 text-sm"} font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key ? "ds-btn shadow-sm" : ""
              }`}
              style={activeTab !== tab.key ? { color: "var(--ds-text-muted)" } : undefined}
              title={tab.label}
            >
              {isMobile ? tab.icon : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Мобильные карточки */}
      {isMobile ? (
        <div className="space-y-2">
          <TasksMobileCards
            isHistory={isHistoryTab(activeTab)}
            loading={loading}
            emptyMsg={emptyMsg[activeTab]}
            activeCards={paginatedActive}
            historyCards={paginatedHistory}
            userId={user?.id}
            getColorKey={getColorKey}
            hasPermission={hasPermission}
            canReview={canReview}
            canSupervise={canSupervise}
            canArchive={canArchive}
            canAcknowledgeCell={canAcknowledgeCell}
            canSendCells={canSendCells}
            getReturnTo={getReturnTo}
            onOpenCell={setDetailCellId}
            onRemarks={(c) => setRemarksCell(c)}
            onSignWithRemarks={(c) => setSignRemarksCell(c)}
            onSign={handleSign}
            onForward={(c) => setForwardCell(c)}
            onDelegate={(c) => setDelegateCell(c)}
            onAcknowledge={(c) => setAcknowledgeCell(c)}
            onApproveSupervision={handleApproveSupervision}
            onCorrection={(c) => setCorrectionCell(c)}
            onArchive={(c) => setArchiveCell(c)}
            onSendToReview={(c) => setSendReviewCell(c)}
            onSendToAcknowledge={(c) => setSendAcknowledgeCell(c)}
            onSendToSupervision={(c) => setSupervisionCell(c)}
            onPreview={setPreviewFile}
          />
          <Pagination
            totalItems={isHistoryTab(activeTab) ? filteredHistory.length : filteredActive.length}
            currentPage={page} onPageChange={setPage}
            pageSize={pageSize} onPageSizeChange={setPageSize}
          />
        </div>
      ) : (
      /* Таблица (десктоп) */
      <div className="ds-card overflow-hidden" data-row-scale={scale}>
        <div className="overflow-x-auto">
          {isHistoryTab(activeTab) ? (
            <HistoryTable
              shares={paginatedHistory} loading={loading} emptyMsg={emptyMsg[activeTab]}
              onOpenCell={setDetailCellId} userId={user?.id}
              getColorKey={getColorKey}
              hasPermission={hasPermission}
              onPreview={setPreviewFile}
            />
          ) : (
            <ActiveTable
              cells={paginatedActive} loading={loading} emptyMsg={emptyMsg[activeTab]}
              canReview={canReview} canArchive={canArchive} canSupervise={canSupervise}
              canAcknowledgeCell={canAcknowledgeCell} canSendCells={canSendCells}
              onOpenCell={setDetailCellId}
              onRemarks={(cell) => setRemarksCell({ id: cell.id, name: cell.name, sendBackTo: cell.created_by })}
              onSignWithRemarks={(cell) => setSignRemarksCell({ id: cell.id, name: cell.name, sendBackTo: cell.created_by })}
              onSign={handleSign} onArchive={(cell) => setArchiveCell({ id: cell.id, name: cell.name })}
              onAcknowledge={(cell) => setAcknowledgeCell({ id: cell.id, name: cell.name })}
              onForward={(cell) => setForwardCell({ id: cell.id, name: cell.name, originalSenderId: cell.created_by })}
              onDelegate={(cell) => setDelegateCell({ id: cell.id, name: cell.name, originalSenderId: cell.created_by })}
              onApproveSupervision={handleApproveSupervision}
              onCorrection={(cell) => setCorrectionCell({ id: cell.id, name: cell.name, sendBackTo: getReturnTo(cell) })}
              onSendToSupervision={(cell) => setSupervisionCell({ id: cell.id, name: cell.name, createdBy: cell.created_by })}
              onSendToReview={(cell) => setSendReviewCell({ id: cell.id, name: cell.name, createdBy: cell.created_by })}
              onSendToAcknowledge={(cell) => setSendAcknowledgeCell({ id: cell.id, name: cell.name })}
              hasPermission={hasPermission}
              getColorKey={getColorKey}
              onPreview={setPreviewFile}
            />
          )}
        </div>
        <Pagination
          totalItems={isHistoryTab(activeTab) ? filteredHistory.length : filteredActive.length}
          currentPage={page} onPageChange={setPage}
          pageSize={pageSize} onPageSizeChange={setPageSize}
        />
      </div>
      )}
      </>
      )}

      {detailCellId && (
        <CellDetailModal
          cellId={detailCellId}
          onClose={() => setDetailCellId(null)}
          onUpdated={loadData}
          onSend={(c) => setSendReviewCell({ id: c.id, name: c.name, createdBy: c.createdBy })}
          onAcknowledge={(c) => setSendAcknowledgeCell({ id: c.id, name: c.name })}
          onSupervision={(c) => setSupervisionCell({ id: c.id, name: c.name, createdBy: c.createdBy })}
          onDownloadAll={async (cellId) => {
            const cell = cells.find((c) => c.id === cellId);
            if (cell) await downloadAsZip(cell.cell_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), cell.name || "файлы");
          }}
          onRemarks={(c) => setRemarksCell({ id: c.id, name: c.name, sendBackTo: c.sendBackTo })}
          onSignCell={(c) => { const cell = cells.find((r) => r.id === c.id); if (cell && confirm(`Подписать "${c.name}"?`)) handleSign(cell); }}
          onSignWithRemarks={(c) => setSignRemarksCell({ id: c.id, name: c.name, sendBackTo: c.sendBackTo })}
          onForward={(c) => setForwardCell({ id: c.id, name: c.name, originalSenderId: c.originalSenderId })}
          onDelegate={(c) => setDelegateCell({ id: c.id, name: c.name, originalSenderId: c.originalSenderId })}
        />
      )}
      {remarksCell && (
        <RemarksModal
          cellId={remarksCell.id} cellName={remarksCell.name} sendBackToUserId={remarksCell.sendBackTo}
          onClose={() => setRemarksCell(null)} onSent={() => { setRemarksCell(null); loadData(); }}
        />
      )}
      {signRemarksCell && (
        <SignWithRemarksModal
          cellId={signRemarksCell.id} cellName={signRemarksCell.name} sendBackToUserId={signRemarksCell.sendBackTo}
          onClose={() => setSignRemarksCell(null)} onSigned={() => { setSignRemarksCell(null); loadData(); }}
        />
      )}
      {acknowledgeCell && (
        <AcknowledgeModal
          cellId={acknowledgeCell.id} cellName={acknowledgeCell.name}
          onClose={() => setAcknowledgeCell(null)} onAcknowledged={() => { setAcknowledgeCell(null); loadData(); }}
        />
      )}
      {forwardCell && (
        <ForwardCellModal
          cellId={forwardCell.id} cellName={forwardCell.name} originalSenderId={forwardCell.originalSenderId}
          onClose={() => setForwardCell(null)} onForwarded={() => { setForwardCell(null); loadData(); }}
        />
      )}
      {delegateCell && (
        <DelegateCellModal
          cellId={delegateCell.id} cellName={delegateCell.name} originalSenderId={delegateCell.originalSenderId}
          onClose={() => setDelegateCell(null)} onDelegated={() => { setDelegateCell(null); loadData(); }}
        />
      )}
      {sendReviewCell && (
        <SendCellModal
          cellId={sendReviewCell.id} cellName={sendReviewCell.name}
          returnToUserId={sendReviewCell.createdBy !== user?.id ? sendReviewCell.createdBy : undefined}
          onClose={() => setSendReviewCell(null)} onSent={() => { setSendReviewCell(null); loadData(); }}
        />
      )}
      {sendAcknowledgeCell && (
        <SendToAcknowledgeModal
          cellId={sendAcknowledgeCell.id} cellName={sendAcknowledgeCell.name}
          onClose={() => setSendAcknowledgeCell(null)} onSent={() => { setSendAcknowledgeCell(null); loadData(); }}
        />
      )}
      {supervisionCell && (
        <SendToSupervisionModal
          cellId={supervisionCell.id} cellName={supervisionCell.name}
          returnToUserId={supervisionCell.createdBy !== user?.id ? supervisionCell.createdBy : undefined}
          onClose={() => setSupervisionCell(null)} onSent={() => { setSupervisionCell(null); loadData(); }}
        />
      )}
      {correctionCell && (
        <CorrectionModal
          cellId={correctionCell.id} cellName={correctionCell.name} sendBackToUserId={correctionCell.sendBackTo}
          onClose={() => setCorrectionCell(null)} onSent={() => { setCorrectionCell(null); loadData(); }}
        />
      )}
      {archiveCell && (
        <ArchiveModal
          cellId={archiveCell.id} cellName={archiveCell.name}
          onClose={() => setArchiveCell(null)} onArchived={handleArchiveComplete}
        />
      )}
      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.fileName}
          storagePath={previewFile.storagePath}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
