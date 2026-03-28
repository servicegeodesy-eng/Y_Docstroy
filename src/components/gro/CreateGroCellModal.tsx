import { FormEvent, memo, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadRawFile } from "@/lib/fileStorage";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize } from "@/lib/utils";
import { useDictionaries } from "@/hooks/useDictionaries";

interface ExistingCell {
  id: string;
  building_id: string | null;
  floor_id: string | null;
}

interface Props {
  existingCells: ExistingCell[];
  onClose: () => void;
  onCreated: () => void;
  onDuplicateFound: (existingId: string) => void;
}

function CreateGroCellModal({ existingCells, onClose, onCreated, onDuplicateFound }: Props) {
  const { project } = useProject();
  const { user } = useAuth();
  const { buildings, floors, loadDicts } = useDictionaries();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selBuilding, setSelBuilding] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => { loadDicts(); }, [loadDicts]);

  const validationHints = useMemo(() => {
    const hints: string[] = [];
    if (!selBuilding) hints.push("место работ");
    return hints;
  }, [selBuilding]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validationHints.length > 0) return;

    // Проверка дубликата
    const duplicate = existingCells.find(
      (c) => c.building_id === selBuilding && (c.floor_id || "") === (selFloor || "")
    );
    if (duplicate) {
      if (confirm("Ячейка ГРО с таким местом работ и уровнем уже существует. Хотите открыть её, чтобы добавить файлы или обновить существующие?")) {
        onDuplicateFound(duplicate.id);
      }
      return;
    }

    doCreate();
  }

  async function doCreate() {
    if (!project || !user) return;
    setLoading(true);
    setError(null);

    const cellId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from("gro_cells").insert({
      id: cellId,
      project_id: project.id,
      building_id: selBuilding || null,
      floor_id: selFloor || null,
      description: description.trim() || null,
      created_by: user.id,
    });

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    // Загрузка файлов
    const uploads = await Promise.all(
      files.map(async (file) => {
        try {
          const storagePath = await uploadRawFile(`${project.id}/gro/${cellId}`, file);
          return {
            gro_cell_id: cellId, file_name: file.name, file_size: file.size,
            mime_type: file.type || "application/octet-stream",
            storage_path: storagePath, uploaded_by: user.id,
          };
        } catch (err) { console.error("Upload error:", err); return null; }
      })
    );
    const rows = uploads.filter(Boolean);
    if (rows.length) await supabase.from("gro_cell_files").insert(rows);

    setLoading(false);
    onCreated();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div
        className="ds-modal w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Новая запись ГРО</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const form = document.getElementById("create-gro-form") as HTMLFormElement; form?.requestSubmit(); }}
              disabled={loading || validationHints.length > 0}
              className="ds-btn px-4 py-1.5 text-sm"
            >
              {loading ? "Создание..." : "Создать"}
            </button>
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {validationHints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 py-2" style={{ borderBottom: "1px solid var(--ds-border)", background: "color-mix(in srgb, #ef4444 5%, var(--ds-surface))" }}>
            <span className="text-xs" style={{ color: "#ef4444" }}>Укажите:</span>
            {validationHints.map((hint) => (
              <span key={hint} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 25%, var(--ds-border))" }}>
                {hint}
              </span>
            ))}
          </div>
        )}

        <form id="create-gro-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="ds-alert-error">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Место работ */}
            <div>
              <label className="ds-label">
                Место работ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={selBuilding}
                onChange={(e) => setSelBuilding(e.target.value)}
                className="ds-input w-full"
              >
                <option value="">Выберите...</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Уровень */}
            <div>
              <label className="ds-label">Уровень</label>
              <select
                value={selFloor}
                onChange={(e) => setSelFloor(e.target.value)}
                className="ds-input w-full"
              >
                <option value="">Не указан</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Описание */}
          <div>
            <label className="ds-label">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="ds-input w-full resize-none"
              placeholder="Необязательное описание..."
            />
          </div>

          {/* Файлы */}
          <div>
            <label className="ds-label">Файлы</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors" style={{ borderColor: "var(--ds-border)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Выберите файлы</span>
              <input type="file" multiple onChange={handleFileSelect} className="hidden" />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className="flex-1 truncate" style={{ color: "var(--ds-text)" }}>{f.name}</span>
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.size)}</span>
                    <button type="button" onClick={() => removeFile(i)} className="ds-icon-btn">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}


export default memo(CreateGroCellModal);
