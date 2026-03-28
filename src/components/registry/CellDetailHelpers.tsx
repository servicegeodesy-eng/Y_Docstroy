import type { DictionaryItem } from "@/types";

export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span style={{ color: "var(--ds-text-muted)" }}>{label}:</span>{" "}
      <span style={{ color: "var(--ds-text)" }}>{value || "—"}</span>
    </div>
  );
}

export function EditSelect({ label, value, onChange, items, disabled }: {
  label: string; value: string; onChange: (v: string) => void; items: DictionaryItem[]; disabled?: boolean;
}) {
  return (
    <div>
      <label className={`ds-label ${disabled ? "opacity-50" : ""}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`ds-input ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <option value="">{disabled ? "Нет связанных элементов" : "Не выбрано"}</option>
        {items.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
      </select>
    </div>
  );
}
