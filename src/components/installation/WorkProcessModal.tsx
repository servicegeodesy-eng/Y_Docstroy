import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useMobile } from "@/lib/MobileContext";
import type { InstallationWork, WorkMaterial } from "./WorkCard";

/* ============================================================================
   Types
   ============================================================================ */

interface MaterialUsage {
  material_id: string;
  material_name: string;
  unit_name: string;
  available_qty: number;
  used_qty: string;
  delivered_inline: boolean;
}

interface Disposition {
  material_id: string;
  material_name: string;
  unit_name: string;
  unused_qty: number;
  action: "remaining" | "waste";
  qty: string;
}

interface Props {
  work: InstallationWork;
  onClose: () => void;
  onUpdated: () => void;
}

/* ============================================================================
   Component
   ============================================================================ */

export default function WorkProcessModal({ work, onClose, onUpdated }: Props) {
  const { isMobile } = useMobile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"process" | "complete">("process");

  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Material usage
  const [usages, setUsages] = useState<MaterialUsage[]>(() =>
    ((work.materials || []) || []).map((m) => ({
      material_id: m.id,
      material_name: m.material_name,
      unit_name: m.unit_short,
      available_qty: m.available_qty,
      used_qty: "",
      delivered_inline: false,
    }))
  );

  // Dispositions (for completing)
  const [dispositions, setDispositions] = useState<Disposition[]>([]);

  /* ---------- Handlers ---------- */

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    const res = await api.post(`/api/installation/works/${work.id}/start`);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    onUpdated();
  };

  const updateUsage = (materialId: string, field: keyof MaterialUsage, val: string | boolean) => {
    setUsages((prev) =>
      prev.map((u) => u.material_id === materialId ? { ...u, [field]: val } : u)
    );
  };

  const handleUseMaterial = async (materialId: string) => {
    const usage = usages.find((u) => u.material_id === materialId);
    if (!usage || !usage.used_qty || Number(usage.used_qty) <= 0) return;

    setLoading(true);
    setError(null);
    const res = await api.post(`/api/installation/works/${work.id}/use-material`, {
      material_id: materialId,
      quantity: Number(usage.used_qty),
    });
    if (res.error) {
      setError(res.error);
    }
    setLoading(false);
    onUpdated();
  };

  const handleInlineDelivery = async (materialId: string) => {
    setLoading(true);
    setError(null);
    const res = await api.post("/api/materials/deliveries", {
      work_id: work.id,
      material_id: materialId,
    });
    if (res.error) {
      setError(res.error);
    } else {
      updateUsage(materialId, "delivered_inline", true);
    }
    setLoading(false);
    onUpdated();
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePhotoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const imageFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      setPhotos((prev) => [...prev, ...imageFiles]);
    }
  }, []);

  const prepareComplete = () => {
    // Calculate unused quantities for disposition
    const disps: Disposition[] = (work.materials || [])
      .map((m) => {
        const usage = usages.find((u) => u.material_id === m.id);
        const usedQty = usage ? Number(usage.used_qty) || 0 : m.used_qty;
        const unused = m.available_qty - usedQty;
        if (unused <= 0) return null;
        return {
          material_id: m.id,
          material_name: m.material_name,
          unit_name: m.unit_short,
          unused_qty: unused,
          action: "remaining" as const,
          qty: String(unused),
        };
      })
      .filter(Boolean) as Disposition[];

    setDispositions(disps);
    setPhase("complete");
  };

  const updateDisposition = (materialId: string, field: "action" | "qty", val: string) => {
    setDispositions((prev) =>
      prev.map((d) => d.material_id === materialId ? { ...d, [field]: val } : d)
    );
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    // Upload photos first
    if (photos.length > 0) {
      for (const photo of photos) {
        const fd = new FormData();
        fd.append("file", photo);
        fd.append("work_id", work.id);
        await api.upload("/api/installation/works/photos", fd);
      }
    }

    const res = await api.post(`/api/installation/works/${work.id}/complete`, {
      dispositions: dispositions.map((d) => ({
        material_id: d.material_id,
        action: d.action,
        quantity: Number(d.qty),
      })),
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    onUpdated();
  };

  /* ---------- Render: Planned ---------- */

  if (work.status === "planned") {
    return (
      <ModalShell title={`Работа #${work.work_number}`} onClose={onClose} isMobile={isMobile}>
        <div className="px-5 py-4 space-y-4">
          {error && <ErrorBanner message={error} />}
          <WorkInfo work={work} />
          <div className="text-center py-4">
            <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
              Работа запланирована на {new Date(work.planned_date).toLocaleDateString("ru-RU")}
            </p>
            <button
              className="ds-btn text-sm px-6 py-2.5"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? "Запуск..." : "Начать процесс"}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  /* ---------- Render: Completed ---------- */

  if (work.status === "completed") {
    return (
      <ModalShell title={`Работа #${work.work_number}`} onClose={onClose} isMobile={isMobile}>
        <div className="px-5 py-4 space-y-4">
          <WorkInfo work={work} />
          <MaterialsSummary materials={(work.materials || [])} />
          <div className="flex justify-end pt-2">
            <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  /* ---------- Render: In Progress - Complete phase ---------- */

  if (phase === "complete") {
    return (
      <ModalShell title="Завершение монтажа" onClose={onClose} isMobile={isMobile}>
        <div className="px-5 py-4 space-y-4">
          {error && <ErrorBanner message={error} />}

          {dispositions.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--ds-text-muted)" }}>
              Все материалы использованы полностью.
            </p>
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
                Укажите, что делать с неиспользованными материалами:
              </p>
              <div className="space-y-3">
                {dispositions.map((d) => (
                  <div
                    key={d.material_id}
                    className="p-3 rounded-lg space-y-2"
                    style={{ background: "var(--ds-surface-sunken)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
                        {d.material_name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                        Остаток: {d.unused_qty} {d.unit_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: "var(--ds-text)" }}>
                        <input
                          type="radio"
                          name={`disp-${d.material_id}`}
                          checked={d.action === "remaining"}
                          onChange={() => updateDisposition(d.material_id, "action", "remaining")}
                        />
                        В остатки
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: "var(--ds-text)" }}>
                        <input
                          type="radio"
                          name={`disp-${d.material_id}`}
                          checked={d.action === "waste"}
                          onChange={() => updateDisposition(d.material_id, "action", "waste")}
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
                        onChange={(e) => updateDisposition(d.material_id, "qty", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="ds-btn-secondary text-sm px-4 py-2"
              onClick={() => setPhase("process")}
              disabled={loading}
            >
              Назад
            </button>
            <button
              className="ds-btn text-sm px-4 py-2"
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? "Завершение..." : "Завершить монтаж"}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  /* ---------- Render: In Progress - Main ---------- */

  return (
    <ModalShell title={`Работа #${work.work_number}`} onClose={onClose} isMobile={isMobile}>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && <ErrorBanner message={error} />}
        <WorkInfo work={work} />

        {/* Photo section */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
            Фото
          </label>
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center transition-colors"
            style={{ borderColor: "var(--ds-border)", background: "var(--ds-surface-sunken)" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handlePhotoDrop}
          >
            {photos.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((f, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: "var(--ds-surface)", color: "var(--ds-text)" }}
                  >
                    {f.name}
                    <button onClick={() => removePhoto(i)}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm mb-2" style={{ color: "var(--ds-text-faint)" }}>
                Перетащите фото сюда или нажмите кнопку
              </p>
            )}
            <button
              className="ds-btn-secondary text-xs px-3 py-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              + Добавить фото
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handlePhotoAdd}
            />
          </div>
        </div>

        {/* Materials usage */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>
            Материалы
          </label>
          <div className="space-y-2">
            {usages.map((usage) => (
              <MaterialUsageRow
                key={usage.material_id}
                usage={usage}
                loading={loading}
                onChangeQty={(val) => updateUsage(usage.material_id, "used_qty", val)}
                onUse={() => handleUseMaterial(usage.material_id)}
                onInlineDelivery={() => handleInlineDelivery(usage.material_id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--ds-border)" }}>
        <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose}>
          Закрыть
        </button>
        <button
          className="ds-btn text-sm px-4 py-2"
          onClick={prepareComplete}
          disabled={loading}
          style={{ background: "#22c55e" }}
        >
          Завершить монтаж
        </button>
      </div>
    </ModalShell>
  );
}

/* ============================================================================
   Sub-components
   ============================================================================ */

function ModalShell({ title, onClose, isMobile, children }: {
  title: string;
  onClose: () => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: isMobile ? "100%" : "640px",
          maxHeight: "90vh",
          background: "var(--ds-surface)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--ds-border)" }}>
          <h3 className="font-semibold text-base" style={{ color: "var(--ds-text)" }}>{title}</h3>
          <button className="ds-icon-btn" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WorkInfo({ work }: { work: InstallationWork }) {
  const locationParts = [
    work.building_name,
    work.work_type_name,
    work.floor_name,
    work.construction_name,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Место</p>
        <p className="text-sm" style={{ color: "var(--ds-text)" }}>{locationParts.join(" / ")}</p>
      </div>
      <div className="flex gap-6">
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Плановая дата</p>
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
          <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Примечание</p>
          <p className="text-sm" style={{ color: "var(--ds-text)" }}>{work.notes}</p>
        </div>
      )}
    </div>
  );
}

function MaterialsSummary({ materials }: { materials: WorkMaterial[] }) {
  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: "var(--ds-text-muted)" }}>Материалы</p>
      <div className="space-y-2">
        {materials.map((m) => {
          const pct = m.required_qty > 0 ? Math.min((m.used_qty / m.required_qty) * 100, 100) : 0;
          return (
            <div key={m.id} className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{m.material_name}</span>
                <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
                  {m.used_qty}/{m.required_qty} {m.unit_short}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--ds-border)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "#f59e0b" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MaterialUsageRow({ usage, loading, onChangeQty, onUse, onInlineDelivery }: {
  usage: MaterialUsage;
  loading: boolean;
  onChangeQty: (val: string) => void;
  onUse: () => void;
  onInlineDelivery: () => void;
}) {
  const notDelivered = usage.available_qty <= 0 && !usage.delivered_inline;

  return (
    <div className="p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
          {usage.material_name}
        </span>
        <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
          Доступно: {usage.available_qty} {usage.unit_name}
        </span>
      </div>

      {notDelivered ? (
        <button
          className="text-xs underline"
          style={{ color: "var(--ds-accent)" }}
          onClick={onInlineDelivery}
          disabled={loading}
        >
          Зафиксировать поступление
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="ds-input text-sm flex-1"
            min="0"
            max={usage.available_qty}
            step="0.01"
            placeholder="Использовано"
            value={usage.used_qty}
            onChange={(e) => onChangeQty(e.target.value)}
          />
          <button
            className="ds-btn text-xs px-3 py-1.5 whitespace-nowrap"
            onClick={onUse}
            disabled={loading || !usage.used_qty || Number(usage.used_qty) <= 0}
          >
            Зафиксировать
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", color: "#ef4444" }}>
      {message}
    </div>
  );
}
