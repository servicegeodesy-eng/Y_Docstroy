import { useState } from "react";
import { useMobile } from "@/lib/MobileContext";
import { ALL_EXPORT_COLUMNS } from "@/lib/exportRegistry";

const STORAGE_KEY = "registry_export_columns";

function loadSavedSelection(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set(ALL_EXPORT_COLUMNS.map((c) => c.key));
}

function saveSelection(keys: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
}

interface Props {
  onExport: (selectedKeys: Set<string>) => void;
  onClose: () => void;
  exporting: boolean;
}

export default function ExportColumnsModal({ onExport, onClose, exporting }: Props) {
  const { isMobile } = useMobile();
  const [selected, setSelected] = useState<Set<string>>(loadSavedSelection);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_EXPORT_COLUMNS.map((c) => c.key)));
  const deselectAll = () => setSelected(new Set());

  const handleExport = () => {
    saveSelection(selected);
    onExport(selected);
  };

  return (
    <div className="ds-overlay">
      <div className="ds-overlay-bg" onClick={onClose} />
      <div
        className={`ds-modal flex flex-col ${isMobile ? "w-full max-h-[90vh] mx-2" : "w-full max-w-md max-h-[80vh]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <h3 className="ds-modal-title text-sm font-semibold">Экспорт в Excel</h3>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
            Выбрано {selected.size} из {ALL_EXPORT_COLUMNS.length}
          </span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs font-medium" style={{ color: "var(--ds-accent)" }}>Все</button>
            <button onClick={deselectAll} className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Ничего</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {ALL_EXPORT_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2.5 py-1.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.has(col.key)}
                onChange={() => toggle(col.key)}
                className="w-4 h-4 rounded accent-[var(--ds-accent)]"
              />
              <span className="text-sm" style={{ color: "var(--ds-text)" }}>{col.label}</span>
            </label>
          ))}
        </div>

        <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: "1px solid var(--ds-border)" }}>
          <button onClick={onClose} className="ds-btn-secondary px-4 py-2 text-sm">Отмена</button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
            className="ds-btn px-4 py-2 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? "Экспорт..." : "Выгрузить"}
          </button>
        </div>
      </div>
    </div>
  );
}
