import ArchiveScansSection from "@/components/registry/ArchiveScansSection";
import type { CellFile } from "@/types";

interface CellSignaturesTabProps {
  cellId: string;
  projectId: string;
  archiveScans: CellFile[];
  canAttachScan: boolean;
  isFinalApproved: boolean;
  canArchive: boolean;
  isAdmin: boolean;
  onFilesChanged: () => void;
  onArchived: () => void;
  onPreview: (fileName: string, storagePath: string) => void;
}

export default function CellSignaturesTab({
  cellId, projectId, archiveScans, canAttachScan, isFinalApproved,
  canArchive, isAdmin, onFilesChanged, onArchived, onPreview,
}: CellSignaturesTabProps) {
  return (
    <ArchiveScansSection cellId={cellId} projectId={projectId} archiveScans={archiveScans} canAttachScan={canAttachScan} isFinalApproved={isFinalApproved} canArchive={canArchive} isAdmin={isAdmin} onFilesChanged={onFilesChanged} onArchived={onArchived} onPreview={(fileName, storagePath) => onPreview(fileName, storagePath)} />
  );
}
