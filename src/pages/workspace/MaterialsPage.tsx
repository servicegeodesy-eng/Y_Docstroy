import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import OrderCard from "@/components/materials/OrderCard";
import CreateOrderModal from "@/components/materials/CreateOrderModal";
import DeliveryModal from "@/components/materials/DeliveryModal";
import type { MaterialOrder } from "@/components/materials/OrderCard";

type Tab = "ordered" | "remaining" | "drafts";

interface RemainingItem {
  material_name: string;
  unit_name: string;
  remaining: number;
}

interface RemainingGroup {
  building_name: string;
  work_type_name: string;
  floor_name: string | null;
  construction_name: string | null;
  items: RemainingItem[];
}

export default function MaterialsPage() {
  const { project } = useProject();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<Tab>("ordered");

  // Data
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [remaining, setRemaining] = useState<RemainingGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editOrder, setEditOrder] = useState<MaterialOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<MaterialOrder | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<MaterialOrder | null>(null);

  const loadOrders = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const res = await api.get<Record<string, unknown>[]>("/api/materials/orders", {
      project_id: project.id,
    });
    if (res.data) {
      // Маппинг API → фронтенд типы
      const mapped: MaterialOrder[] = res.data.map((o: Record<string, unknown>) => ({
        id: o.id as string,
        order_number: String(o.order_number || ""),
        status: (o.status || "draft") as MaterialOrder["status"],
        building_name: (o.building_name || "") as string,
        work_type_name: (o.work_type_name || "") as string,
        floor_name: (o.floor_name || null) as string | null,
        construction_name: (o.construction_name || null) as string | null,
        notes: (o.notes || null) as string | null,
        created_at: (o.created_at || "") as string,
        created_by_name: [o.last_name, o.first_name].filter(Boolean).join(" ") || "",
        items: Array.isArray(o.items) ? (o.items as Record<string, unknown>[]).map((it) => ({
          id: (it.id || "") as string,
          material_name: (it.material_name || "") as string,
          unit_name: (it.unit_short || it.unit_name || "") as string,
          quantity: Number(it.quantity || 0),
          delivered_quantity: Number(it.delivered_qty ?? it.delivered_quantity ?? 0),
        })) : [],
      }));
      setOrders(mapped);
    }
    setLoading(false);
  }, [project]);

  const loadRemaining = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    interface RawRow { building_name: string; work_type_name: string; floor_name: string | null; construction_name: string | null; material_name: string; unit_short: string; remaining: number }
    const res = await api.get<RawRow[]>("/api/materials/remaining", {
      project_id: project.id,
    });
    if (res.data) {
      // Группировка по локации
      const map = new Map<string, RemainingGroup>();
      for (const row of res.data) {
        const key = [row.building_name, row.work_type_name, row.floor_name, row.construction_name].join("|");
        if (!map.has(key)) {
          map.set(key, {
            building_name: row.building_name,
            work_type_name: row.work_type_name,
            floor_name: row.floor_name,
            construction_name: row.construction_name,
            items: [],
          });
        }
        map.get(key)!.items.push({
          material_name: row.material_name,
          unit_name: row.unit_short || "",
          remaining: Number(row.remaining) || 0,
        });
      }
      setRemaining(Array.from(map.values()));
    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    if (activeTab === "remaining") {
      loadRemaining();
    } else {
      loadOrders();
    }
  }, [activeTab, loadOrders, loadRemaining]);

  if (!project) return null;

  const orderedList = orders.filter((o) =>
    o.status === "ordered" || o.status === "partial" || o.status === "delivered"
  );
  const draftList = orders.filter((o) => o.status === "draft");

  const handleCreated = () => {
    setShowCreate(false);
    setEditOrder(null);
    loadOrders();
  };

  const handleDeliverySaved = () => {
    setDeliveryOrder(null);
    setDetailOrder(null);
    loadOrders();
  };

  const handleDeleteDraft = async (order: MaterialOrder) => {
    if (!confirm("Удалить черновик?")) return;
    await api.delete(`/api/materials/orders/${order.id}`);
    loadOrders();
  };

  const handleSubmitDraft = async (order: MaterialOrder) => {
    await api.patch(`/api/materials/orders/${order.id}`, { status: "ordered" });
    loadOrders();
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "ordered", label: "Заказано", count: orderedList.length },
    { key: "remaining", label: "Остатки" },
    { key: "drafts", label: "Черновики", count: draftList.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
          Материалы
        </h2>
        <button className="ds-btn text-sm flex items-center gap-1.5" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!isMobile && "Заказать"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit mb-4" style={{ background: "var(--ds-surface-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
            style={activeTab === tab.key
              ? { background: "var(--ds-surface)", color: "var(--ds-text)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
              : { color: "var(--ds-text-faint)" }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === tab.key
                    ? "color-mix(in srgb, var(--ds-accent) 15%, transparent)"
                    : "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)",
                  color: activeTab === tab.key ? "var(--ds-accent)" : "var(--ds-text-faint)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="ds-card p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-2" style={{ color: "var(--ds-accent)" }} />
          <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
        </div>
      ) : activeTab === "ordered" ? (
        <OrderedTab
          orders={orderedList}
          onClickOrder={setDetailOrder}
        />
      ) : activeTab === "remaining" ? (
        <RemainingTab groups={remaining} />
      ) : (
        <DraftsTab
          orders={draftList}
          onClickOrder={setDetailOrder}
          onEdit={(o) => { setEditOrder(o); setShowCreate(true); }}
          onDelete={handleDeleteDraft}
          onSubmit={handleSubmitDraft}
        />
      )}

      {/* Detail overlay for ordered items */}
      {detailOrder && !deliveryOrder && (
        <OrderDetailOverlay
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onDelivery={() => setDeliveryOrder(detailOrder)}
          isMobile={isMobile}
        />
      )}

      {/* Modals */}
      {showCreate && (
        <CreateOrderModal
          onClose={() => { setShowCreate(false); setEditOrder(null); }}
          onCreated={handleCreated}
          editOrder={editOrder}
        />
      )}
      {deliveryOrder && (
        <DeliveryModal
          order={deliveryOrder}
          onClose={() => setDeliveryOrder(null)}
          onSaved={handleDeliverySaved}
        />
      )}
    </div>
  );
}

/* ============================================================================
   Tab: Заказано
   ============================================================================ */

const STATUS_LABELS: Record<string, string> = {
  ordered: "Заказано", partial: "Частично", delivered: "Доставлено", draft: "Черновик",
};
const STATUS_COLORS: Record<string, string> = {
  ordered: "#3b82f6", partial: "#f59e0b", delivered: "#22c55e", draft: "var(--ds-text-faint)",
};

function OrderedTab({ orders, onClickOrder }: {
  orders: MaterialOrder[];
  onClickOrder: (o: MaterialOrder) => void;
}) {
  const [showArchive, setShowArchive] = useState(false);
  const active = orders.filter((o) => o.status !== "delivered");
  const archived = orders.filter((o) => o.status === "delivered");

  if (orders.length === 0) {
    return <EmptyState message="Нет заказов" hint="Нажмите «Заказать» для создания первой заявки на материалы" />;
  }

  return (
    <div>
      <div className="ds-card overflow-hidden">
        <table className="ds-table">
          <thead>
            <tr>
              <th className="w-16">№</th>
              <th className="w-24">Дата</th>
              <th>Место / Вид работ</th>
              <th>Материалы</th>
              <th className="w-24">Статус</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && !showArchive ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Нет активных заказов</td></tr>
            ) : active.map((order) => (
              <OrderRow key={order.id} order={order} onClick={() => onClickOrder(order)} />
            ))}
          </tbody>
        </table>
      </div>

      {archived.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5"
            style={{ color: "var(--ds-text-faint)" }}
          >
            <svg className={`w-3 h-3 transition-transform ${showArchive ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Архив ({archived.length})
          </button>
          {showArchive && (
            <div className="ds-card overflow-hidden mt-1">
              <table className="ds-table">
                <tbody>
                  {archived.map((order) => (
                    <OrderRow key={order.id} order={order} onClick={() => onClickOrder(order)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order, onClick }: { order: MaterialOrder; onClick: () => void }) {
  const location = [order.building_name, order.work_type_name].filter(Boolean).join(" / ");
  const sub = [order.floor_name, order.construction_name].filter(Boolean).join(" / ");
  const date = order.created_at ? new Date(order.created_at).toLocaleDateString("ru") : "";
  const statusColor = STATUS_COLORS[order.status] || "var(--ds-text-faint)";

  return (
    <tr className="cursor-pointer" onClick={onClick}>
      <td className="text-sm font-medium" style={{ color: "var(--ds-accent)" }}>#{order.order_number}</td>
      <td className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{date}</td>
      <td>
        <div className="text-sm" style={{ color: "var(--ds-text)" }}>{location}</div>
        {sub && <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{sub}</div>}
      </td>
      <td>
        <div className="flex flex-col gap-0.5">
          {(order.items || []).map((it, i) => {
            const pct = it.quantity > 0 ? Math.min(100, (it.delivered_quantity / it.quantity) * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs truncate" style={{ color: "var(--ds-text-muted)", maxWidth: 120 }}>{it.material_name}</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--ds-surface-sunken)", minWidth: 60 }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "#3b82f6" }} />
                </div>
                <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: "var(--ds-text-faint)" }}>
                  {it.delivered_quantity}/{it.quantity}
                </span>
              </div>
            );
          })}
        </div>
      </td>
      <td>
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor }}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </td>
    </tr>
  );
}

/* ============================================================================
   Tab: Остатки
   ============================================================================ */

function RemainingTab({ groups }: { groups: RemainingGroup[] }) {
  const { isMobile } = useMobile();

  if (groups.length === 0) {
    return <EmptyState message="Нет остатков" hint="Данные появятся после фиксации поступлений" />;
  }

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => {
        const location = [group.building_name, group.work_type_name, group.floor_name, group.construction_name]
          .filter(Boolean).join(" / ");
        return (
          <div key={gi} className="ds-card overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--ds-border)", background: "var(--ds-surface-sunken)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{location}</p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
              {group.items.map((item, ii) => (
                <div key={ii} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm" style={{ color: "var(--ds-text)" }}>{item.material_name}</span>
                    <span className="text-xs ml-2" style={{ color: "var(--ds-text-faint)" }}>{item.unit_name}</span>
                  </div>
                  <span
                    className="text-sm font-medium ml-3 whitespace-nowrap"
                    style={{ color: item.remaining > 0 ? "#22c55e" : "var(--ds-text-faint)" }}
                  >
                    {item.remaining}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   Tab: Черновики
   ============================================================================ */

function DraftsTab({ orders, onClickOrder, onEdit, onDelete, onSubmit }: {
  orders: MaterialOrder[];
  onClickOrder: (o: MaterialOrder) => void;
  onEdit: (o: MaterialOrder) => void;
  onDelete: (o: MaterialOrder) => void;
  onSubmit: (o: MaterialOrder) => void;
}) {
  const { isMobile } = useMobile();

  if (orders.length === 0) {
    return <EmptyState message="Нет черновиков" hint="Черновики появятся при сохранении заказа без отправки" />;
  }

  return (
    <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"}`}>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onClick={() => onClickOrder(order)}
          isDraft
          onEdit={() => onEdit(order)}
          onDelete={() => onDelete(order)}
          onSubmit={() => onSubmit(order)}
        />
      ))}
    </div>
  );
}

/* ============================================================================
   Order Detail Overlay
   ============================================================================ */

function OrderDetailOverlay({ order, onClose, onDelivery, isMobile }: {
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

/* ============================================================================
   Shared Empty State
   ============================================================================ */

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="ds-card p-8 text-center">
      <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>{message}</p>
      <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>{hint}</p>
    </div>
  );
}
