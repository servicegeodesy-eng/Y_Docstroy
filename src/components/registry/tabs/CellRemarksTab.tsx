import RemarksSection from "@/components/registry/RemarksSection";
import type { RemarkRow } from "@/hooks/useCellDetail";

interface CellRemarksTabProps {
  remarks: RemarkRow[];
  onPreview: (fileName: string, storagePath: string) => void;
}

export default function CellRemarksTab({ remarks, onPreview }: CellRemarksTabProps) {
  return (
    <RemarksSection remarks={remarks} onPreview={(fileName, storagePath) => onPreview(fileName, storagePath)} />
  );
}
