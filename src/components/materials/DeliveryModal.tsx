import { useState } from "react";
import { api } from "@/lib/api";
import { useMobile } from "@/lib/MobileContext";
import type { MaterialOrder, OrderItem } from "./OrderCard";

interface DeliveryRow {
  order_item_id: string;
  material_name: string;
  unit_name: string;
  ordered: number;
  already_delivered: number;
  new_quantity: string;
}

interface Props {
  order: MaterialOrder;
  onClose: () => void;
  onSaved: () => void;
}

export default function DeliveryModal({ order, onClose, onSaved }: Props) {
  const { isMobile } = useMobile();
  const [rows, setRows] = useState<DeliveryRow[]>(
    order.items.map((it) => ({
      order_item_id: it.id,
      material_name: it.material_name,
      unit_name: it.unit_name,
      ordered: it.quantity,
      already_delivered: it.delivered_quantity,
      new_quantity: "",
    }))
  );
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQty = (idx: number, val: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, new_quantity: val } : r)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const handleSubmit = async () => {
    const deliveryItems = rows
      .filter((r) => r.new_quantity && Number(r.new_quantity) > 0)
      .map((r) => ({
        order_item_id: r.order_item_id,
        quantity: Number(r.new_quantity),
      }));

    if (deliveryItems.length === 0) {
      setError("Укажите количество хотя бы для одной позиции");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await api.post("/api/materials/deliveries", {
      order_id: order.id,
      items: deliveryItems,
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // Upload photos/files
    if (files.length > 0 && res.data) {
      const deliveryId = (res.data as { id: string }).id;
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("delivery_id", deliveryId);
        await api.upload("/api/materials/deliveries/files", fd);
      }
    }

    setLoading(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: isMobile ? "100%" : "600px",
          maxHeight: "90vh",
          background: "var(--ds-surface)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--ds-border)" }}>
          <h3 className="font-semibold text-base" style={{ color: "var(--ds-text)" }}>
            Зафиксировать поступление #{order.order_number}
          </h3>
          <button className="ds-icon-btn" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", color: "#ef4444" }}>
              {error}
            </div>
          )}

          {/* Items table */}
          <div className="space-y-3">
            {/* Header row */}
            <div className="grid gap-2 text-xs font-medium" style={{
              color: "var(--ds-text-muted)",
              gridTemplateColumns: isMobile ? "1fr 60px 60px 70px" : "1fr 80px 80px 100px",
            }}>
              <span>Материал</span>
              <span className="text-center">Заказано</span>
              <span className="text-center">Получено</span>
              <span className="text-center">Поступление</span>
            </div>

            {rows.map((row, idx) => {
              const remaining = Number(row.ordered || 0) - Number(row.already_delivered || 0);
              return (
                <div
                  key={row.order_item_id}
                  className="grid gap-2 items-center py-2 border-b"
                  style={{
                    borderColor: "var(--ds-border)",
                    gridTemplateColumns: isMobile ? "1fr 60px 60px 70px" : "1fr 80px 80px 100px",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--ds-text)" }}>{row.material_name}</p>
                    <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{row.unit_name}</p>
                  </div>
                  <span className="text-sm text-center" style={{ color: "var(--ds-text)" }}>{row.ordered}</span>
                  <span className="text-sm text-center" style={{ color: "var(--ds-text-muted)" }}>{row.already_delivered}</span>
                  <input
                    className="ds-input text-sm text-center"
                    type="number"
                    min="0"
                    max={remaining}
                    step="0.01"
                    placeholder="0"
                    value={row.new_quantity}
                    onChange={(e) => updateQty(idx, e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          {/* Files / Photos */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Фото / файлы</label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text)" }}
                >
                  {f.name}
                  <button className="ml-1" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <label className="ds-btn-secondary text-xs px-3 py-1.5 cursor-pointer">
                + Добавить файл
                <input type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--ds-border)" }}>
          <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button className="ds-btn text-sm px-4 py-2" onClick={handleSubmit} disabled={loading}>
            {loading ? "Сохранение..." : "Зафиксировать"}
          </button>
        </div>
      </div>
    </div>
  );
}
