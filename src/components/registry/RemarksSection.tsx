import { shortName, formatSize, downloadStorage, isPreviewable } from "@/lib/utils";
import { useProject } from "@/lib/ProjectContext";

export interface RemarkRow {
  id: string;
  text: string | null;
  created_at: string;
  profiles: {
    last_name: string;
    first_name: string;
    middle_name: string | null;
  } | null;
  cell_comment_files: {
    id: string;
    file_name: string;
    file_size: number;
    storage_path: string;
  }[];
}

interface Props {
  remarks: RemarkRow[];
  onPreview: (fileName: string, storagePath: string) => void;
}

export default function RemarksSection({ remarks, onPreview }: Props) {
  const { hasPermission } = useProject();
  const canDownload = hasPermission("can_download_files");

  if (remarks.length === 0) {
    return <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет замечаний</p>;
  }

  return (
    <div className="space-y-3">
      {remarks.map((r) => (
        <div key={r.id} className="ds-alert-warning">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{shortName(r.profiles)}</span>
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{new Date(r.created_at).toLocaleString("ru-RU")}</span>
          </div>
          {r.text && <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ds-text-muted)" }}>{r.text}</p>}
          {r.cell_comment_files.length > 0 && (
            <div className="mt-2 space-y-1">
              {r.cell_comment_files.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isPreviewable(f.file_name)) {
                        onPreview(f.file_name, f.storage_path);
                      } else if (canDownload) {
                        downloadStorage(f.storage_path, f.file_name);
                      }
                    }}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--ds-accent)" }}
                    title={isPreviewable(f.file_name) ? "Просмотр" : canDownload ? "Скачать" : "Скачивание запрещено"}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isPreviewable(f.file_name) ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      )}
                    </svg>
                    {f.file_name}
                  </button>
                  <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>({formatSize(f.file_size)})</span>
                  {canDownload && (
                    <button onClick={() => downloadStorage(f.storage_path, f.file_name)} className="ds-icon-btn p-0.5" title="Скачать">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
