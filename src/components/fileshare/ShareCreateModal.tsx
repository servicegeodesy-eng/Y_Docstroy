import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { uploadShareFile, MAX_FILES, MAX_TOTAL_SIZE } from "@/lib/fileShareStorage";
import { formatSize } from "@/lib/utils";
import Modal from "@/components/ui/Modal";
import ShareDictSection from "./ShareDictSection";
import type { ShareDictData } from "./ShareDictSection";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Если передан — редактируем черновик */
  draftId?: string;
}

interface ProjectUser {
  user_id: string;
  profiles: { last_name: string; first_name: string; middle_name: string | null } | null;
}

function ShareCreateModal({ open, onClose, onCreated, draftId }: Props) {
  const { project } = useProject();
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showDict, setShowDict] = useState(false);
  const [dictData, setDictData] = useState<ShareDictData | null>(null);

  // Существующие файлы черновика
  const [draftFiles, setDraftFiles] = useState<{ id: string; file_name: string; file_size: number; storage_path: string }[]>([]);

  useEffect(() => {
    if (!open || !project || !user) return;

    // Загрузить участников проекта (кроме себя)
    supabase
      .from("project_members")
      .select("user_id, profiles(last_name, first_name, middle_name)")
      .eq("project_id", project.id)
      .neq("user_id", user.id)
      .then(({ data }) => {
        if (data) setProjectUsers(data as unknown as ProjectUser[]);
      });

    // Если редактируем черновик — загрузить данные
    if (draftId) {
      supabase
        .from("file_shares")
        .select("comment")
        .eq("id", draftId)
        .single()
        .then(({ data }) => {
          if (data?.comment) setComment(data.comment);
        });

      supabase
        .from("file_share_files")
        .select("id, file_name, file_size, storage_path")
        .eq("share_id", draftId)
        .then(({ data }) => {
          if (data) setDraftFiles(data);
        });

      supabase
        .from("file_share_recipients")
        .select("user_id")
        .eq("share_id", draftId)
        .then(({ data }) => {
          if (data) setSelectedUsers(data.map((r) => r.user_id));
        });
    }
  }, [open, project, user, draftId]);

  // Сбросить состояние при закрытии
  useEffect(() => {
    if (!open) {
      setFiles([]);
      setComment("");
      setSelectedUsers([]);
      setDraftFiles([]);
      setError("");
      setUserSearch("");
      setShowDict(false);
      setDictData(null);
    }
  }, [open]);

  const totalNewSize = files.reduce((s, f) => s + f.size, 0);
  const totalDraftSize = draftFiles.reduce((s, f) => s + f.file_size, 0);
  const totalSize = totalNewSize + totalDraftSize;
  const totalCount = files.length + draftFiles.length;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const newTotal = totalCount + selected.length;
    if (newTotal > MAX_FILES) {
      setError(`Максимум ${MAX_FILES} файлов`);
      return;
    }

    const newSize = totalSize + selected.reduce((s, f) => s + f.size, 0);
    if (newSize > MAX_TOTAL_SIZE) {
      setError(`Общий размер файлов не должен превышать ${formatSize(MAX_TOTAL_SIZE)}`);
      return;
    }

    setError("");
    setFiles((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function removeDraftFile(fileId: string, storagePath: string) {
    const { removeShareFiles } = await import("@/lib/fileShareStorage");
    await removeShareFiles([storagePath]);
    await supabase.from("file_share_files").delete().eq("id", fileId);
    setDraftFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function userName(u: ProjectUser): string {
    const p = u.profiles;
    if (!p) return "—";
    return [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(" ");
  }

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const filteredUsers = projectUsers.filter((u) => {
    if (!userSearch) return !selectedUsers.includes(u.user_id);
    return !selectedUsers.includes(u.user_id) && userName(u).toLowerCase().includes(userSearch.toLowerCase());
  });

  const selectedUserObjects = projectUsers.filter((u) => selectedUsers.includes(u.user_id));

  // Вычисление позиции и закрытие dropdown
  useEffect(() => {
    if (!dropdownOpen) { setDropdownPos(null); return; }
    function updatePos() {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        const preferredHeight = isMobile ? 150 : 200;

        if (spaceBelow >= Math.min(preferredHeight, 100)) {
          // Открыть вниз
          setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: Math.min(spaceBelow, preferredHeight) });
        } else {
          // Открыть вверх
          const h = Math.min(spaceAbove, preferredHeight);
          setDropdownPos({ top: rect.top - h - 4, left: rect.left, width: rect.width, maxHeight: h });
        }
      }
    }
    updatePos();
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [dropdownOpen]);


  async function handleSend() {
    if (!project || !user) return;
    if (totalCount === 0) { setError("Добавьте файлы"); return; }
    if (selectedUsers.length === 0) { setError("Выберите получателей"); return; }

    setSending(true);
    setError("");

    try {
      let shareId: string;

      if (!draftId) {
        const { data, error: err } = await supabase
          .from("file_shares")
          .insert({
            project_id: project.id, created_by: user.id, comment: comment || null, status: "sent", sent_at: new Date().toISOString(),
            ...(dictData ? { building_id: dictData.building_id, floor_id: dictData.floor_id, work_type_id: dictData.work_type_id, construction_id: dictData.construction_id, work_id: dictData.work_id, tag: dictData.tag, manual_tag: dictData.manual_tag || null } : {}),
          })
          .select("id")
          .single();
        if (err) throw err;
        shareId = data.id;
      } else {
        shareId = draftId;
        await supabase.from("file_shares").update({
          comment: comment || null, status: "sent", sent_at: new Date().toISOString(),
          ...(dictData ? { building_id: dictData.building_id, floor_id: dictData.floor_id, work_type_id: dictData.work_type_id, construction_id: dictData.construction_id, work_id: dictData.work_id, tag: dictData.tag, manual_tag: dictData.manual_tag || null } : {}),
        }).eq("id", shareId);
      }

      // Загрузить новые файлы
      const uploadResults = await Promise.allSettled(
        files.map((file) => uploadShareFile(project.id, shareId, file))
      );
      for (const r of uploadResults) {
        if (r.status === "rejected") console.error("Upload error:", r.reason);
      }

      // Получатели
      await supabase.from("file_share_recipients").delete().eq("share_id", shareId);
      await supabase.from("file_share_recipients").insert(
        selectedUsers.map((uid) => ({ share_id: shareId, user_id: uid }))
      );

      // Маски подложки
      if (dictData?.polygons.length && dictData.overlay_id) {
        await supabase.from("file_share_overlay_masks").delete().eq("share_id", shareId);
        await supabase.from("file_share_overlay_masks").insert(
          dictData.polygons.map((p) => ({ share_id: shareId, overlay_id: dictData.overlay_id!, polygon_points: p }))
        );
      }

      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    onClose();
  }

  const validationHints: string[] = [];
  if (totalCount === 0) validationHints.push("Файлы");
  if (selectedUsers.length === 0) validationHints.push("Получатели");

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={draftId ? "Редактировать отправку" : "Поделиться файлом"}
      wide
      headerExtra={
        <button
          onClick={handleSend}
          className="ds-btn px-4 py-1.5 text-sm"
          disabled={sending || validationHints.length > 0}
        >
          {sending ? "Отправка..." : "Отправить"}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Подсказки валидации */}
        {validationHints.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 -mx-6 -mt-4 px-6 py-2 mb-2" style={{ borderBottom: "1px solid var(--ds-border)", background: "color-mix(in srgb, #f59e0b 5%, var(--ds-surface))" }}>
            <span className="text-xs" style={{ color: "#f59e0b" }}>Укажите:</span>
            {validationHints.map((hint) => (
              <span key={hint} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))", color: "#f59e0b", border: "1px solid color-mix(in srgb, #f59e0b 25%, var(--ds-border))" }}>
                {hint}
              </span>
            ))}
          </div>
        )}
        {/* Файлы */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ds-text)" }}>
            Файлы <span className="text-xs font-normal" style={{ color: "var(--ds-text-muted)" }}>({totalCount}/{MAX_FILES}, {formatSize(totalSize)}/{formatSize(MAX_TOTAL_SIZE)})</span>
          </label>

          {/* Список существующих файлов черновика */}
          {draftFiles.map((f) => (
            <div key={f.id} className="flex items-center gap-2 py-1.5 px-2 rounded mb-1" style={{ background: "var(--ds-surface-elevated)" }}>
              <svg className="w-4 h-4 shrink-0" style={{ color: "var(--ds-text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm truncate flex-1" style={{ color: "var(--ds-text)" }}>{f.file_name}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>
              <button onClick={() => removeDraftFile(f.id, f.storage_path)} className="ds-icon-btn shrink-0" title="Удалить">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Новые файлы */}
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded mb-1" style={{ background: "var(--ds-surface-elevated)" }}>
              <svg className="w-4 h-4 shrink-0" style={{ color: "var(--ds-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm truncate flex-1" style={{ color: "var(--ds-text)" }}>{f.name}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.size)}</span>
              <button onClick={() => removeFile(i)} className="ds-icon-btn shrink-0" title="Удалить">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {totalCount < MAX_FILES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="ds-btn-secondary w-full py-2 mt-1 text-sm"
            >
              + Добавить файлы
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Комментарий */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ds-text)" }}>Комментарий</label>
          <textarea
            className="ds-input w-full text-sm"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Необязательно"
          />
        </div>

        {/* Привязка к конструкциям */}
        {!showDict ? (
          <button type="button" onClick={() => setShowDict(true)}
            className="ds-btn-secondary w-full py-2 text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Привязать к конструкциям
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium" style={{ color: "var(--ds-text)" }}>Привязка к конструкциям</label>
              <button
                type="button"
                onClick={() => { setShowDict(false); setDictData(null); }}
                className="text-xs flex items-center gap-1 px-2 py-0.5 rounded hover:opacity-80"
                style={{ color: "var(--ds-text-muted)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Убрать привязку
              </button>
            </div>
            <ShareDictSection onChange={setDictData} initialData={dictData || undefined} />
          </div>
        )}

        {/* Получатели — dropdown */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ds-text)" }}>
            Получатели {selectedUsers.length > 0 && <span className="text-xs font-normal" style={{ color: "var(--ds-text-muted)" }}>({selectedUsers.length})</span>}
          </label>

          {/* Чипсы выбранных */}
          {selectedUserObjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedUserObjects.map((u) => (
                <span
                  key={u.user_id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs"
                  style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}
                >
                  {userName(u)}
                  <button
                    type="button"
                    onClick={() => toggleUser(u.user_id)}
                    className="hover:opacity-70 p-0.5 rounded-full"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Dropdown */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              className="ds-input w-full text-sm"
              placeholder={selectedUsers.length > 0 ? "Добавить ещё..." : "Выберите получателей..."}
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
            />
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--ds-text-muted)" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>

            {dropdownOpen && dropdownPos && createPortal(
              <div
                ref={dropdownRef}
                className="border rounded-lg overflow-y-auto shadow-lg"
                style={{
                  position: "fixed",
                  zIndex: 99999,
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  borderColor: "var(--ds-border)",
                  background: "var(--ds-surface)",
                  maxHeight: dropdownPos.maxHeight,
                }}
              >
                {filteredUsers.length === 0 ? (
                  <div className="p-3 text-sm text-center" style={{ color: "var(--ds-text-muted)" }}>
                    {projectUsers.length === 0 ? "Нет участников проекта" : "Не найдено"}
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:brightness-95 transition-colors"
                      style={{ color: "var(--ds-text)", background: "var(--ds-surface)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--ds-accent) 8%, var(--ds-surface))")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ds-surface)")}
                      onClick={() => { toggleUser(u.user_id); setUserSearch(""); }}
                    >
                      {userName(u)}
                    </button>
                  ))
                )}
              </div>,
              document.body
            )}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>
        )}

      </div>
    </Modal>
  );
}


export default memo(ShareCreateModal);
