import { useState } from "react";

const SCALES = [1, 1.5, 2] as const;
const STORAGE_KEY = "ds_row_scale";

export type RowScale = (typeof SCALES)[number];

export function getStoredRowScale(): RowScale {
  const v = localStorage.getItem(STORAGE_KEY);
  const n = v ? parseFloat(v) : NaN;
  return SCALES.includes(n as RowScale) ? (n as RowScale) : 1;
}

export function useRowScale() {
  const [scale, setScale] = useState<RowScale>(getStoredRowScale);

  function cycleScale() {
    setScale((prev) => {
      const idx = SCALES.indexOf(prev);
      const next = SCALES[(idx + 1) % SCALES.length];
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return { scale, cycleScale };
}

interface Props {
  scale: RowScale;
  onCycle: () => void;
}

export default function RowScaleButton({ scale, onCycle }: Props) {
  return (
    <button
      type="button"
      onClick={onCycle}
      className="text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
      style={{
        background: scale === 1 ? "var(--ds-surface-elevated)" : "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))",
        color: scale === 1 ? "var(--ds-text-muted)" : "var(--ds-accent)",
        border: "1px solid var(--ds-border)",
      }}
      title="Масштаб строк"
    >
      ×{scale}
    </button>
  );
}
