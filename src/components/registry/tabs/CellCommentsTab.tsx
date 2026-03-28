import PublicCommentsSection from "@/components/registry/PublicCommentsSection";

interface CellCommentsTabProps {
  cellId: string;
  canAddComments: boolean;
  onBackToInfo: () => void;
}

export default function CellCommentsTab({ cellId, canAddComments, onBackToInfo }: CellCommentsTabProps) {
  return (
    <div>
      <button
        onClick={onBackToInfo}
        className="flex items-center gap-1 text-sm mb-3 hover:opacity-80 transition-opacity"
        style={{ color: "var(--ds-accent)" }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Назад к информации
      </button>
      <PublicCommentsSection cellId={cellId} canAddComments={canAddComments} />
    </div>
  );
}
