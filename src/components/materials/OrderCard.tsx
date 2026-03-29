import { useMobile } from "@/lib/MobileContext";

export interface OrderItem {
  id: string;
  material_name: string;
  unit_name: string;
  quantity: number;
  delivered_quantity: number;
}

export interface MaterialOrder {
  id: string;
  order_number: string;
  status: "draft" | "ordered" | "partial" | "delivered";
  building_name: string;
  work_type_name: string;
  floor_name: string | null;
  construction_name: string | null;
  notes: string | null;
  created_at: string;
  created_by_name: string;
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  ordered: "Ожидают поступления",
  partial: "Частично",
  delivered: "Доставлено",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)", text: "var(--ds-text-faint)" },
  ordered: { bg: "color-mix(in srgb, #3b82f6 15%, transparent)", text: "#3b82f6" },
  partial: { bg: "color-mix(in srgb, #f59e0b 15%, transparent)", text: "#f59e0b" },
  delivered: { bg: "color-mix(in srgb, #22c55e 15%, transparent)", text: "#22c55e" },
};

interface Props {
  order: MaterialOrder;
  onClick: () => void;
  isDraft?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onSubmit?: () => void;
}

export default function OrderCard({ order, onClick, isDraft, onEdit, onDelete, onSubmit }: Props) {
  const { isMobile } = useMobile();
  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.ordered;

  const locationParts = [
    order.building_name,
    order.work_type_name,
    order.floor_name,
    order.construction_name,
  ].filter(Boolean);

  return (
    <div
      className="ds-card p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm" style={{ color: "var(--ds-text)" }}>
              #{order.order_number}
            </span>
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
              {new Date(order.created_at).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: "var(--ds-text-muted)" }}>
            {locationParts.join(" / ")}
          </p>
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap"
          style={{ background: sc.bg, color: sc.text }}
        >
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {/* Material items with progress bars */}
      <div className="space-y-2 mb-3">
        {order.items.slice(0, isMobile ? 2 : 4).map((item) => {
          const pct = item.quantity > 0 ? Math.min((item.delivered_quantity / item.quantity) * 100, 100) : 0;
          const barColor = pct >= 100 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#3b82f6";
          return (
            <div key={item.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="truncate" style={{ color: "var(--ds-text)" }}>{item.material_name}</span>
                <span className="ml-2 whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>
                  {item.delivered_quantity}/{item.quantity} {item.unit_name}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ds-surface-sunken)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
        {order.items.length > (isMobile ? 2 : 4) && (
          <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
            + ещё {order.items.length - (isMobile ? 2 : 4)} позиций
          </p>
        )}
      </div>

      {/* Draft actions */}
      {isDraft && (
        <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--ds-border)" }}>
          <button
            className="ds-btn text-xs px-3 py-1.5"
            onClick={(e) => { e.stopPropagation(); onSubmit?.(); }}
          >
            Отправить
          </button>
          <button
            className="ds-btn-secondary text-xs px-3 py-1.5"
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
          >
            Редактировать
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#ef4444" }}
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
