import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { downloadShareFile } from "@/lib/fileShareStorage";
import { formatSize, formatDateTime, getExt, isPreviewable, downloadAsZip } from "@/lib/utils";
import type { ProfileShort } from "@/lib/utils";
import Modal from "@/components/ui/Modal";

const FilePreviewModal = lazy(() => import("@/components/ui/FilePreviewModal"));

interface Props {
  shareId: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface ShareDetail {
  id: string;
  comment: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  created_by: string;
  creator: ProfileShort | null;
  file_share_files: { id: string; file_name: string; file_size: number; storage_path: string }[];
  file_share_recipients: { user_id: string; is_read: boolean; recipient: ProfileShort | null }[];
}

export default function ShareDetailModal({ shareId, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [share, setShare] = useState<ShareDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);

  useEffect(() => {
    loadShare();
  }, [shareId]);

  async function loadShare() {
    const { data } = await supabase
      .from("file_shares")
      .select(`
        id, comment, status, created_at, sent_at, created_by,
        creator:profiles!created_by(last_name, first_name, middle_name),
        file_share_files(id, file_name, file_size, storage_path),
        file_share_recipients(user_id, is_read, recipient:profiles!user_id(last_name, first_name, middle_name))
      `)
      .eq("id", shareId)
      .single();

    if (data) {
      setShare(data as unknown as ShareDetail);

      if (user) {
        await supabase
          .from("file_share_recipients")
          .update({ is_read: true })
          .eq("share_id", shareId)
          .eq("user_id", user.id);
        onUpdated();
      }
    }
    setLoading(false);
  }

  async function handleDownload(storagePath: string, fileName: string) {
    setDownloading(storagePath);
    try {
      const data = await downloadShareFile(storagePath);
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAll() {
    if (!share) return;
    await downloadAsZip(
      share.file_share_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })),
      share.comment || "файлы",
      "fileshare-files",
    );
  }

  async function handleTrash() {
    if (!user) return;
    await supabase
      .from("file_share_recipients")
      .update({ trashed_at: new Date().toISOString() })
      .eq("share_id", shareId)
      .eq("user_id", user.id);
    onUpdated();
    onClose();
  }

  function personName(p: ProfileShort | null): string {
    if (!p) return "—";
    return [p.last_name, p.first_name].filter(Boolean).join(" ");
  }

  const isCreator = share?.created_by === user?.id;

  return (
    <>
      <Modal open={true} onClose={onClose} title="Просмотр отправки" wide>
        {loading || !share ? (
          <div className="py-8 text-center">
            <div className="ds-spinner mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Мета */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
              <span>От: <strong style={{ color: "var(--ds-text)" }}>{personName(share.creator)}</strong></span>
              {share.sent_at && <span>{formatDateTime(share.sent_at)}</span>}
            </div>

            {/* Получатели */}
            {share.file_share_recipients.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Получатели:</div>
                <div className="flex flex-wrap gap-1.5">
                  {share.file_share_recipients.map((r) => (
                    <span
                      key={r.user_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)" }}
                    >
                      {personName(r.recipient)}
                      {r.is_read && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Комментарий */}
            {share.comment && (
              <div className="text-sm rounded-lg p-3" style={{ background: "var(--ds-surface-elevated)", color: "var(--ds-text)" }}>
                {share.comment}
              </div>
            )}

            {/* Файлы */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>
                  Файлы ({share.file_share_files.length})
                </div>
                {share.file_share_files.length > 1 && (
                  <button onClick={handleDownloadAll} className="text-xs ds-btn-secondary px-2 py-1">
                    Скачать все
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {share.file_share_files.map((f) => {
                  const canPreview = isPreviewable(f.file_name);
                  const ext = getExt(f.file_name);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 py-1.5 px-3 rounded-lg"
                      style={{ background: "var(--ds-surface-elevated)" }}
                    >
                      {/* Формат */}
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0"
                        style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)" }}
                      >
                        {ext}
                      </span>

                      {/* Имя файла — клик = просмотр */}
                      {canPreview ? (
                        <button
                          className="text-sm truncate flex-1 text-left hover:underline"
                          style={{ color: "var(--ds-accent)" }}
                          onClick={() => setPreviewFile({ fileName: f.file_name, storagePath: f.storage_path })}
                        >
                          {f.file_name}
                        </button>
                      ) : (
                        <span className="text-sm truncate flex-1" style={{ color: "var(--ds-text)" }}>
                          {f.file_name}
                        </span>
                      )}

                      {/* Размер */}
                      <span className="text-xs shrink-0" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>

                      {/* Кнопка просмотра */}
                      {canPreview && (
                        <button
                          onClick={() => setPreviewFile({ fileName: f.file_name, storagePath: f.storage_path })}
                          className="p-1 rounded transition-colors shrink-0 hover:opacity-70"
                          style={{ color: "var(--ds-text-faint)" }}
                          title="Просмотр"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}

                      {/* Кнопка скачивания */}
                      <button
                        onClick={() => handleDownload(f.storage_path, f.file_name)}
                        disabled={downloading === f.storage_path}
                        className="p-1 rounded transition-colors shrink-0 hover:opacity-70"
                        style={{ color: "var(--ds-text-faint)" }}
                        title="Скачать"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Действия */}
            <div className="flex gap-2 justify-end pt-2">
              {!isCreator && share.status === "sent" && (
                <button onClick={handleTrash} className="ds-btn-danger px-4 py-2 text-sm">
                  В корзину
                </button>
              )}
              <button onClick={onClose} className="ds-btn-secondary px-4 py-2 text-sm">
                Закрыть
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Suspense fallback={null}>
        {previewFile && (
          <FilePreviewModal
            fileName={previewFile.fileName}
            storagePath={previewFile.storagePath}
            bucket="fileshare-files"
            onClose={() => setPreviewFile(null)}
          />
        )}
      </Suspense>
    </>
  );
}
