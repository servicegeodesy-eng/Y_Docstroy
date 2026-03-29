import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import OrderCard from "@/components/materials/OrderCard";
import CreateOrderModal from "@/components/materials/CreateOrderModal";
import DeliveryModal from "@/components/materials/DeliveryModal";
import OrderDetailOverlay from "@/components/materials/OrderDetailOverlay";
import MaterialFilters from "@/components/materials/MaterialFilters";
import type { MaterialFilterKey } from "@/components/materials/MaterialFilters";
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

const emptyFilters = (): Record<MaterialFilterKey, Set<string>> => ({
  building: new Set(), workType: new Set(), floor: new Set(), construction: new Set(),
});

export default function MaterialsPage() {
  const { project, isProjectAdmin: isAdmin, isPortalAdmin } = useProject();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<Tab>("ordered");
  const [showAllOrders, setShowAllOrders] = useState(false);

  // Data
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [remaining, setRemaining] = useState<RemainingGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const canAdmin = isAdmin || isPortalAdmin;

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<MaterialFilterKey, Set<string>>>(emptyFilters);
  const [openFilter, setOpenFilter] = useState<MaterialFilterKey | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editOrder, setEditOrder] = useState<MaterialOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<MaterialOrder | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<MaterialOrder | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilter]);

  const loadOrders = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const params: Record<string, string> = { project_id: project.id };
    if (!showAllOrders) params.my = "true";
    const res = await api.get<Record<string, unknown>[]>("/api/materials/orders", params);
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
  }, [project, showAllOrders]);

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

  // Filter options computed from loaded orders
  const filterOptions = useMemo<Record<MaterialFilterKey, string[]>>(() => {
    const sets: Record<MaterialFilterKey, Set<string>> = { building: new Set(), workType: new Set(), floor: new Set(), construction: new Set() };
    for (const o of orders) {
      if (o.building_name) sets.building.add(o.building_name);
      if (o.work_type_name) sets.workType.add(o.work_type_name);
      if (o.floor_name) sets.floor.add(o.floor_name);
      if (o.construction_name) sets.construction.add(o.construction_name);
    }
    return { building: [...sets.building].sort(), workType: [...sets.workType].sort(), floor: [...sets.floor].sort(), construction: [...sets.construction].sort() };
  }, [orders]);

  const toggleFilterValue = useCallback((key: MaterialFilterKey, value: string) => {
    setFilters((prev) => {
      const s = new Set(prev[key]);
      if (s.has(value)) s.delete(value); else s.add(value);
      return { ...prev, [key]: s };
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    for (const k of Object.keys(filters) as MaterialFilterKey[]) c += filters[k].size;
    if (dateFrom) c++;
    if (dateTo) c++;
    if (search) c++;
    if (showAllOrders) c++;
    return c;
  }, [filters, dateFrom, dateTo, search, showAllOrders]);

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters());
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setShowAllOrders(false);
  }, []);

  // Client-side filtering
  const applyFilters = useCallback((list: MaterialOrder[]) => {
    return list.filter((o) => {
      if (filters.building.size > 0 && !filters.building.has(o.building_name)) return false;
      if (filters.workType.size > 0 && !filters.workType.has(o.work_type_name)) return false;
      if (filters.floor.size > 0 && !(o.floor_name && filters.floor.has(o.floor_name))) return false;
      if (filters.construction.size > 0 && !(o.construction_name && filters.construction.has(o.construction_name))) return false;
      if (dateFrom && o.created_at < dateFrom) return false;
      if (dateTo && o.created_at.slice(0, 10) > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [o.order_number, o.notes || ""].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [filters, dateFrom, dateTo, search]);

  if (!project) return null;

  const orderedListRaw = orders.filter((o) =>
    o.status === "ordered" || o.status === "partial" || o.status === "delivered"
  );
  const draftListRaw = orders.filter((o) => o.status === "draft");
  const orderedList = applyFilters(orderedListRaw);
  const draftList = applyFilters(draftListRaw);
  const totalCount = activeTab === "drafts" ? draftListRaw.length : orderedListRaw.length;
  const filteredCount = activeTab === "drafts" ? draftList.length : orderedList.length;

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

  const handleDelete = async (order: MaterialOrder) => {
    const msg = order.status === "draft" ? "Удалить черновик?" : "Удалить заказ?";
    if (!confirm(msg)) return;
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
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
            Материалы
          </h2>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="ds-icon-btn relative"
            style={showFilters || hasActiveFilters ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" } : undefined}
            title="Фильтры"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
        </div>
        <button className="ds-btn text-sm flex items-center gap-1.5" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!isMobile && "Заказать"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: "var(--ds-surface-sunken)" }}>
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

      </div>

      {/* Фильтры */}
      {showFilters && (activeTab === "ordered" || activeTab === "drafts") && (
        <MaterialFilters
          filters={filters} setFilters={setFilters} filterOptions={filterOptions}
          openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef}
          dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
          search={search} setSearch={setSearch} showSearch={showSearch} setShowSearch={setShowSearch}
          hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount}
          filteredCount={filteredCount} totalCount={totalCount}
          clearFilters={clearFilters} toggleFilterValue={toggleFilterValue}
          allOrders={showAllOrders} setAllOrders={setShowAllOrders} showAllToggle
        />
      )}

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
          canAdmin={canAdmin}
          onEdit={(o) => { setEditOrder(o); setShowCreate(true); }}
          onDelete={handleDelete}
        />
      ) : activeTab === "remaining" ? (
        <RemainingTab groups={remaining} />
      ) : (
        <DraftsTab
          orders={draftList}
          onClickOrder={setDetailOrder}
          onEdit={(o) => { setEditOrder(o); setShowCreate(true); }}
          onDelete={handleDelete}
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

/* === Sub-components === */
const STATUS_LABELS: Record<string, string> = { ordered: "Ожидают поступления", partial: "Частично", delivered: "Доставлено", draft: "Черновик" };
const STATUS_COLORS: Record<string, string> = { ordered: "#3b82f6", partial: "#f59e0b", delivered: "#22c55e", draft: "var(--ds-text-faint)" };

function OrderedTab({ orders, onClickOrder, canAdmin, onEdit, onDelete }: {
  orders: MaterialOrder[];
  onClickOrder: (o: MaterialOrder) => void;
  canAdmin: boolean;
  onEdit: (o: MaterialOrder) => void;
  onDelete: (o: MaterialOrder) => void;
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
              {canAdmin && <th className="w-20"></th>}
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && !showArchive ? (
              <tr><td colSpan={canAdmin ? 6 : 5} className="px-4 py-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Нет активных заказов</td></tr>
            ) : active.map((order) => (
              <OrderRow key={order.id} order={order} onClick={() => onClickOrder(order)} canAdmin={canAdmin} onEdit={() => onEdit(order)} onDelete={() => onDelete(order)} />
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
                    <OrderRow key={order.id} order={order} onClick={() => onClickOrder(order)} canAdmin={canAdmin} onEdit={() => onEdit(order)} onDelete={() => onDelete(order)} />
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

function OrderRow({ order, onClick, canAdmin, onEdit, onDelete }: {
  order: MaterialOrder; onClick: () => void;
  canAdmin?: boolean; onEdit?: () => void; onDelete?: () => void;
}) {
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
      {canAdmin && (
        <td>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              className="ds-icon-btn p-1"
              title="Редактировать"
              onClick={() => onEdit?.()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              className="ds-icon-btn p-1"
              title="Удалить"
              onClick={() => onDelete?.()}
              style={{ color: "#ef4444" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

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
