import type { MaterialOrder } from "./OrderCard";

export default function OrderDetailOverlay({ order, onClose, onDelivery, isMobile }: {
  order: MaterialOrder;
  onClose: () => void;
  onDelivery: () => void;
  isMobile: boolean;
}) {
  const locationParts = [
    order.building_name,
    order.work_type_name,
    order.floor_name,
    order.construction_name,
  ].filter(Boolean);

  const canDeliver = order.status === "ordered" || order.status === "partial";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: isMobile ? "100%" : "560px",
          maxHeight: "90vh",
          background: "var(--ds-surface)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--ds-border)" }}>
          <h3 className="font-semibold text-base" style={{ color: "var(--ds-text)" }}>
            Заказ #{order.order_number}
          </h3>
          <button className="ds-icon-btn" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Location */}
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Место</p>
            <p className="text-sm" style={{ color: "var(--ds-text)" }}>{locationParts.join(" / ")}</p>
          </div>

          {/* Date and author */}
          <div className="flex gap-6">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Дата</p>
              <p className="text-sm" style={{ color: "var(--ds-text)" }}>
                {new Date(order.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Автор</p>
              <p className="text-sm" style={{ color: "var(--ds-text)" }}>{order.created_by_name}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Позиции</p>
            <div className="space-y-3">
              {order.items.map((item) => {
                const pct = item.quantity > 0 ? Math.min((item.delivered_quantity / item.quantity) * 100, 100) : 0;
                const barColor = pct >= 100 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#3b82f6";
                return (
                  <div key={item.id} className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{item.material_name}</span>
                      <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{item.unit_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--ds-border)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--ds-text)" }}>
                        {item.delivered_quantity} / {item.quantity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>Примечание</p>
              <p className="text-sm" style={{ color: "var(--ds-text)" }}>{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--ds-border)" }}>
          <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose}>
            Закрыть
          </button>
          {canDeliver && (
            <button className="ds-btn text-sm px-4 py-2" onClick={onDelivery}>
              Зафиксировать поступление
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
