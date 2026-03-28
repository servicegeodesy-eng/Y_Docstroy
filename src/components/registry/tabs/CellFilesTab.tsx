import CellFileSection from "@/components/registry/CellFileSection";
import type { CellFile } from "@/types";

interface CellFilesTabProps {
  cellId: string;
  files: CellFile[];
  isLocked: boolean;
  isSent: boolean;
  canModifyFiles: boolean;
  canAddFiles: boolean;
  canDeleteFiles: boolean;
  canUpdateFiles: boolean;
  isAdmin: boolean;
  onFilesChanged: () => void;
}

export default function CellFilesTab({
  cellId, files, isLocked, isSent, canModifyFiles, canAddFiles,
  canDeleteFiles, canUpdateFiles, isAdmin, onFilesChanged,
}: CellFilesTabProps) {
  return (
    <CellFileSection cellId={cellId} files={files} isLocked={isLocked} isSent={isSent} canModifyFiles={canModifyFiles} canAddFiles={canAddFiles} canDeleteFiles={canDeleteFiles} canUpdateFiles={canUpdateFiles} isAdmin={isAdmin} onFilesChanged={onFilesChanged} />
  );
}
