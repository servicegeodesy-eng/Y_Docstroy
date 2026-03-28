import { lazy, Suspense, useState } from "react";
import type { CellRow } from "@/hooks/useRegistryCells";

const FilePreviewModal = lazy(() => import("@/components/ui/FilePreviewModal"));
const CreateCellModal = lazy(() => import("@/components/registry/CreateCellModal"));
const CellDetailModal = lazy(() => import("@/components/registry/CellDetailModal"));
const SendCellModal = lazy(() => import("@/components/registry/SendCellModal"));
const SendToSupervisionModal = lazy(() => import("@/components/registry/SendToSupervisionModal"));
const SendToAcknowledgeModal = lazy(() => import("@/components/registry/SendToAcknowledgeModal"));
const RemarksModal = lazy(() => import("@/components/registry/RemarksModal"));
const SignWithRemarksModal = lazy(() => import("@/components/registry/SignWithRemarksModal"));
const ForwardCellModal = lazy(() => import("@/components/registry/ForwardCellModal"));
const DelegateCellModal = lazy(() => import("@/components/registry/DelegateCellModal"));
const ExportColumnsModal = lazy(() => import("@/components/registry/ExportColumnsModal"));

export interface ModalHandlers {
  setShowCreate: (v: boolean) => void;
  setDetailCellId: (id: string | null) => void;
  setSendCell: (c: { id: string; name: string } | null) => void;
  setSupervisionCell: (c: { id: string; name: string } | null) => void;
  setAcknowledgeCell: (c: { id: string; name: string } | null) => void;
  setRemarksCell: (c: { id: string; name: string; sendBackTo: string } | null) => void;
  setSignRemarksCell: (c: { id: string; name: string; sendBackTo: string } | null) => void;
  setForwardCell: (c: { id: string; name: string; originalSenderId: string } | null) => void;
  setDelegateCell: (c: { id: string; name: string; originalSenderId: string } | null) => void;
}

interface RegistryModalsProps {
  cells: CellRow[];
  loadCells: () => void;
  handleSignFromRegistry: (cell: CellRow) => void;
  downloadAllFiles: (cell: CellRow) => void;
  projectId: string | undefined;
  projectName: string | undefined;
  previewFile: { fileName: string; storagePath: string } | null;
  setPreviewFile: (f: { fileName: string; storagePath: string } | null) => void;
}

export function useRegistryModals(): ModalHandlers & {
  showCreate: boolean;
  detailCellId: string | null;
  sendCell: { id: string; name: string } | null;
  supervisionCell: { id: string; name: string } | null;
  acknowledgeCell: { id: string; name: string } | null;
  remarksCell: { id: string; name: string; sendBackTo: string } | null;
  signRemarksCell: { id: string; name: string; sendBackTo: string } | null;
  forwardCell: { id: string; name: string; originalSenderId: string } | null;
  delegateCell: { id: string; name: string; originalSenderId: string } | null;
} {
  const [showCreate, setShowCreate] = useState(false);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [sendCell, setSendCell] = useState<{ id: string; name: string } | null>(null);
  const [supervisionCell, setSupervisionCell] = useState<{ id: string; name: string } | null>(null);
  const [acknowledgeCell, setAcknowledgeCell] = useState<{ id: string; name: string } | null>(null);
  const [remarksCell, setRemarksCell] = useState<{ id: string; name: string; sendBackTo: string } | null>(null);
  const [signRemarksCell, setSignRemarksCell] = useState<{ id: string; name: string; sendBackTo: string } | null>(null);
  const [forwardCell, setForwardCell] = useState<{ id: string; name: string; originalSenderId: string } | null>(null);
  const [delegateCell, setDelegateCell] = useState<{ id: string; name: string; originalSenderId: string } | null>(null);

  return {
    showCreate, setShowCreate,
    detailCellId, setDetailCellId,
    sendCell, setSendCell,
    supervisionCell, setSupervisionCell,
    acknowledgeCell, setAcknowledgeCell,
    remarksCell, setRemarksCell,
    signRemarksCell, setSignRemarksCell,
    forwardCell, setForwardCell,
    delegateCell, setDelegateCell,
  };
}

interface Props extends RegistryModalsProps {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  detailCellId: string | null;
  setDetailCellId: (id: string | null) => void;
  sendCell: { id: string; name: string } | null;
  setSendCell: (c: { id: string; name: string } | null) => void;
  supervisionCell: { id: string; name: string } | null;
  setSupervisionCell: (c: { id: string; name: string } | null) => void;
  acknowledgeCell: { id: string; name: string } | null;
  setAcknowledgeCell: (c: { id: string; name: string } | null) => void;
  remarksCell: { id: string; name: string; sendBackTo: string } | null;
  setRemarksCell: (c: { id: string; name: string; sendBackTo: string } | null) => void;
  signRemarksCell: { id: string; name: string; sendBackTo: string } | null;
  setSignRemarksCell: (c: { id: string; name: string; sendBackTo: string } | null) => void;
  forwardCell: { id: string; name: string; originalSenderId: string } | null;
  setForwardCell: (c: { id: string; name: string; originalSenderId: string } | null) => void;
  delegateCell: { id: string; name: string; originalSenderId: string } | null;
  setDelegateCell: (c: { id: string; name: string; originalSenderId: string } | null) => void;
  exporting: boolean;
  setExporting: (v: boolean) => void;
  showExport: boolean;
  setShowExport: (v: boolean) => void;
}

export default function RegistryModals({
  cells, loadCells, handleSignFromRegistry, downloadAllFiles,
  projectId, projectName,
  previewFile, setPreviewFile,
  showCreate, setShowCreate,
  detailCellId, setDetailCellId,
  sendCell, setSendCell,
  supervisionCell, setSupervisionCell,
  acknowledgeCell, setAcknowledgeCell,
  remarksCell, setRemarksCell,
  signRemarksCell, setSignRemarksCell,
  forwardCell, setForwardCell,
  delegateCell, setDelegateCell,
  exporting, setExporting,
  showExport, setShowExport,
}: Props) {
  return (
    <Suspense fallback={null}>
      {showExport && projectId && (
        <ExportColumnsModal
          exporting={exporting}
          onClose={() => setShowExport(false)}
          onExport={async (selectedKeys) => {
            setExporting(true);
            try {
              const { exportRegistryToXls } = await import("@/lib/exportRegistry");
              await exportRegistryToXls(projectId, projectName || "", selectedKeys);
              setShowExport(false);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Ошибка экспорта");
            } finally {
              setExporting(false);
            }
          }}
        />
      )}
      {showCreate && (
        <CreateCellModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadCells(); }}
        />
      )}

      {detailCellId && (
        <CellDetailModal
          cellId={detailCellId}
          onClose={() => setDetailCellId(null)}
          onUpdated={loadCells}
          onSend={(c) => setSendCell(c)}
          onAcknowledge={(c) => setAcknowledgeCell(c)}
          onSupervision={(c) => setSupervisionCell(c)}
          onDownloadAll={(id) => {
            const cell = cells.find((c) => c.id === id);
            if (cell) downloadAllFiles(cell);
          }}
          onRemarks={(c) => setRemarksCell(c)}
          onSignCell={(c) => { if (confirm(`Подписать "${c.name}"?`)) { const row = cells.find((r) => r.id === c.id); if (row) handleSignFromRegistry(row); } }}
          onSignWithRemarks={(c) => setSignRemarksCell(c)}
          onForward={(c) => setForwardCell(c)}
          onDelegate={(c) => setDelegateCell(c)}
        />
      )}

      {sendCell && (
        <SendCellModal
          cellId={sendCell.id}
          cellName={sendCell.name}
          onClose={() => setSendCell(null)}
          onSent={() => { setSendCell(null); loadCells(); }}
        />
      )}

      {acknowledgeCell && (
        <SendToAcknowledgeModal
          cellId={acknowledgeCell.id}
          cellName={acknowledgeCell.name}
          onClose={() => setAcknowledgeCell(null)}
          onSent={() => { setAcknowledgeCell(null); loadCells(); }}
        />
      )}

      {supervisionCell && (
        <SendToSupervisionModal
          cellId={supervisionCell.id}
          cellName={supervisionCell.name}
          onClose={() => setSupervisionCell(null)}
          onSent={() => { setSupervisionCell(null); loadCells(); }}
        />
      )}

      {remarksCell && (
        <RemarksModal
          cellId={remarksCell.id} cellName={remarksCell.name} sendBackToUserId={remarksCell.sendBackTo}
          onClose={() => setRemarksCell(null)} onSent={() => { setRemarksCell(null); loadCells(); }}
        />
      )}
      {signRemarksCell && (
        <SignWithRemarksModal
          cellId={signRemarksCell.id} cellName={signRemarksCell.name} sendBackToUserId={signRemarksCell.sendBackTo}
          onClose={() => setSignRemarksCell(null)} onSigned={() => { setSignRemarksCell(null); loadCells(); }}
        />
      )}
      {forwardCell && (
        <ForwardCellModal
          cellId={forwardCell.id} cellName={forwardCell.name} originalSenderId={forwardCell.originalSenderId}
          onClose={() => setForwardCell(null)} onForwarded={() => { setForwardCell(null); loadCells(); }}
        />
      )}
      {delegateCell && (
        <DelegateCellModal
          cellId={delegateCell.id} cellName={delegateCell.name} originalSenderId={delegateCell.originalSenderId}
          onClose={() => setDelegateCell(null)} onDelegated={() => { setDelegateCell(null); loadCells(); }}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.fileName}
          storagePath={previewFile.storagePath}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </Suspense>
  );
}
