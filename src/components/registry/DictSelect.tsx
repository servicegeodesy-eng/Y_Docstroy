import type { DictionaryItem } from "@/types";

export default function DictSelect({ label, name, items, required, value, onChange, disabled }: {
  label: string;
  name: string;
  items: DictionaryItem[];
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={`ds-label ${disabled ? "opacity-50" : ""}`}>
        {label} {required && !disabled && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <select
        name={name}
        required={required && !disabled}
        disabled={disabled}
        className={`ds-input ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="" disabled={required && !disabled}>
          {disabled ? "Нет связанных элементов" : required ? "Выберите..." : "Не выбрано"}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </div>
  );
}
