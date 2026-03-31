import type { InstallationWork, WorkMaterial } from "./WorkCard";

/* ============================================================================
   Shared types (re-exported for WorkProcessModal)
   ============================================================================ */

export interface MaterialUsage {
  id: string;
  order_item_id?: string;
  material_name: string;
  unit_short: string;
  required_qty: number;
  available_qty: number;
  used_qty: number;
  session_qty: string;
  showDeliveryForm: boolean;
  delivery_qty: string;
}

export interface Disposition {
  order_item_id: string;
  material_name: string;
  unit_short: string;
  unused_qty: number;
  action: "remaining" | "waste";
  qty: string;
}

/* ============================================================================
   ModalShell
   ============================================================================ */

export function ModalShell({
  title,
  onClose,
  isMobile,
  children,
}: {
  title: string;
  onClose: () => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: isMobile ? "100%" : "640px",
          maxHeight: "90vh",
          background: "var(--ds-surface)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--ds-border)" }}
        >
          <h3 className="font-semibold text-base" style={{ color: "var(--ds-text)" }}>
            {title}
          </h3>
          <button className="ds-icon-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ============================================================================
   WorkInfo
   ============================================================================ */

export function WorkInfo({ work }: { work: InstallationWork }) {
  const location = [
    work.building_name,
    work.work_type_name,
    work.floor_name,
    work.construction_name,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Место</p>
        <p className="text-sm" style={{ color: "var(--ds-text)" }}>{location}</p>
      </div>
      <div className="flex gap-4">
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>
            Плановая дата
          </p>
          <p className="text-sm" style={{ color: "var(--ds-text)" }}>
            {new Date(work.planned_date).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Автор</p>
          <p className="text-sm" style={{ color: "var(--ds-text)" }}>{work.created_by_name}</p>
        </div>
      </div>
      {work.notes && (
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>
            Примечание
          </p>
          <p className="text-sm" style={{ color: "var(--ds-text)" }}>{work.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   MaterialsSummaryCompact (planned view)
   ============================================================================ */

export function MaterialsSummaryCompact({ materials }: { materials: WorkMaterial[] }) {
  if (!materials.length) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
        Материалы
      </p>
      <div className="space-y-1">
        {materials.map((m) => (
          <div key={m.id} className="flex justify-between text-xs">
            <span style={{ color: "var(--ds-text)" }}>{m.material_name}</span>
            <span style={{ color: "var(--ds-text-muted)" }}>
              {m.required_qty} {m.unit_short}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   MaterialsProgressList (completed view)
   ============================================================================ */

export function MaterialsProgressList({ materials }: { materials: WorkMaterial[] }) {
  if (!materials.length) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
        Материалы
      </p>
      <div className="space-y-2">
        {materials.map((m) => {
          const pct = m.required_qty > 0
            ? Math.min((m.used_qty / m.required_qty) * 100, 100)
            : 0;
          return (
            <div
              key={m.id}
              className="p-3 rounded-lg"
              style={{ background: "var(--ds-surface-sunken)" }}
            >
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
                  {m.material_name}
                </span>
                <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
                  {m.used_qty}/{m.required_qty} {m.unit_short}
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--ds-border)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? "#22c55e" : "#f59e0b",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   MaterialUsageRow (in_progress view)
   ============================================================================ */

export function MaterialUsageRow({
  u,
  loading,
  onUpdate,
  onUse,
  onDelivery,
}: {
  u: MaterialUsage;
  loading: boolean;
  onUpdate: (patch: Partial<MaterialUsage>) => void;
  onUse: () => void;
  onDelivery: () => void;
}) {
  const needsDelivery = u.available_qty < u.required_qty;

  return (
    <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--ds-surface-sunken)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
          {u.material_name}
        </span>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
          {u.unit_short}
        </span>
      </div>

      <div
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
        style={{ color: "var(--ds-text-muted)" }}
      >
        <span>Заявлено: {u.required_qty}</span>
        <span>Доступно: {u.available_qty}</span>
        <span>Использовано: {u.used_qty}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          className="ds-input text-sm flex-1"
          min="0"
          max={u.available_qty - u.used_qty}
          step="0.01"
          placeholder="Использовано сейчас"
          value={u.session_qty}
          onChange={(e) => onUpdate({ session_qty: e.target.value })}
        />
        <button
          className="ds-btn text-xs px-3 py-1.5 whitespace-nowrap"
          onClick={onUse}
          disabled={loading || !u.session_qty || Number(u.session_qty) <= 0}
        >
          Зафиксировать
        </button>
      </div>

      {needsDelivery && !u.showDeliveryForm && (
        <button
          className="text-xs underline"
          style={{ color: "var(--ds-accent)" }}
          onClick={() => onUpdate({ showDeliveryForm: true })}
        >
          Зафиксировать поступление
        </button>
      )}
      {u.showDeliveryForm && (
        <div
          className="flex items-center gap-2 p-2 rounded-lg"
          style={{ background: "var(--ds-surface)" }}
        >
          <input
            type="number"
            className="ds-input text-sm flex-1"
            min="0"
            step="0.01"
            placeholder="Кол-во поступления"
            value={u.delivery_qty}
            onChange={(e) => onUpdate({ delivery_qty: e.target.value })}
          />
          <button
            className="ds-btn text-xs px-3 py-1.5"
            onClick={onDelivery}
            disabled={loading || !u.delivery_qty || Number(u.delivery_qty) <= 0}
          >
            Принять
          </button>
          <button
            className="ds-btn-secondary text-xs px-2 py-1.5"
            onClick={() => onUpdate({ showDeliveryForm: false, delivery_qty: "" })}
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   MaterialUsageCompactRow - компактная строка с индикатором
   ============================================================================ */

export function MaterialUsageCompactRow({
  u,
  loading,
  selected,
  onSelect,
}: {
  u: MaterialUsage;
  loading: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const required = Number(u.required_qty) || 0;
  const available = Number(u.available_qty) || 0;
  const used = Number(u.used_qty) || 0;
  const maxVal = Math.max(required, 1);
  
  // Проценты для индикатора
  const availablePct = Math.min((available / maxVal) * 100, 100);
  const usedPct = Math.min((used / maxVal) * 100, 100);

  return (
    <div 
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selected ? 'ring-2 ring-blue-500' : ''}`}
      style={{ background: selected ? "var(--ds-surface)" : "var(--ds-surface-sunken)" }}
      onClick={onSelect}
    >
      {/* Индикатор из 3 цветов */}
      <div className="flex-1 h-4 rounded-full overflow-hidden relative" style={{ background: "#ffffff" }}>
        {/* Желтый - поступило */}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${availablePct}%`, background: "#f59e0b" }} />
        {/* Темно-зеленый - использовано */}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${usedPct}%`, background: "#15803d" }} />
      </div>
      {/* Цифры необходимое/поступило/использовано */}
      <span className="text-xs font-mono whitespace-nowrap" style={{ color: "var(--ds-text-faint)" }}>
        {required}/{available}/{used}
      </span>
      
      {/* Кнопка Зафиксировать */}
      <button
        className="ds-btn text-xs px-3 py-1.5 whitespace-nowrap"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        disabled={loading}
      >
        Зафиксировать
      </button>
    </div>
  );
}

/* ============================================================================
   DispositionRow (complete phase)
   ============================================================================ */

export function DispositionRow({
  d,
  onChange,
}: {
  d: Disposition;
  onChange: (oid: string, field: "action" | "qty", val: string) => void;
}) {
  return (
    <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--ds-surface-sunken)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
          {d.material_name}
        </span>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
          Остаток: {d.unused_qty} {d.unit_short}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <label
          className="flex items-center gap-1.5 text-sm cursor-pointer"
          style={{ color: "var(--ds-text)" }}
        >
          <input
            type="radio"
            name={`disp-${d.order_item_id}`}
            checked={d.action === "remaining"}
            onChange={() => onChange(d.order_item_id, "action", "remaining")}
          />
          В остатки
        </label>
        <label
          className="flex items-center gap-1.5 text-sm cursor-pointer"
          style={{ color: "var(--ds-text)" }}
        >
          <input
            type="radio"
            name={`disp-${d.order_item_id}`}
            checked={d.action === "waste"}
            onChange={() => onChange(d.order_item_id, "action", "waste")}
          />
          В утиль
        </label>
        <input
          type="number"
          className="ds-input text-sm"
          style={{ width: "90px" }}
          min="0"
          max={d.unused_qty}
          step="0.01"
          value={d.qty}
          onChange={(e) => onChange(d.order_item_id, "qty", e.target.value)}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   Shared small components
   ============================================================================ */

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="text-sm px-3 py-2 rounded-lg"
      style={{
        background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))",
        color: "#ef4444",
      }}
    >
      {message}
    </div>
  );
}

export function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
