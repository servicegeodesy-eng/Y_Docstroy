import CellStatusPanel from "@/components/registry/CellStatusPanel";
import type { CellWithDicts, SignatureRow } from "@/hooks/useCellDetail";
import type { CellFile } from "@/types";

interface CellProcessTabProps {
  cellId: string;
  cell: CellWithDicts;
  signatures: SignatureRow[];
  supervisionFile: CellFile | null;
}

export default function CellProcessTab({ cellId, cell, signatures, supervisionFile }: CellProcessTabProps) {
  return (
    <CellStatusPanel cellId={cellId} cell={{ status: cell.status, assigned_to: cell.assigned_to, assigned_by: cell.assigned_by, assignee: cell.assignee, assigner: cell.assigner, creator: cell.creator_profile }} signatures={signatures} hasSupervisionApproval={!!supervisionFile} />
  );
}
