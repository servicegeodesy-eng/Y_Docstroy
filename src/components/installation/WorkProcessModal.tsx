import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useMobile } from "@/lib/MobileContext";
import type { InstallationWork } from "./WorkCard";
import {
  ModalShell,
  WorkInfo,
  MaterialsSummaryCompact,
  MaterialsProgressList,
  MaterialUsageRow,
  DispositionRow,
  ErrorBanner,
} from "./WorkProcessParts";
import type { MaterialUsage, Disposition } from "./WorkProcessParts";

/* ============================================================================
   Props
   ============================================================================ */

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

  /* --- Photos --- */
  const [photos, setPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /* --- Material usage --- */
  const [usages, setUsages] = useState<MaterialUsage[]>(() =>
    (work.materials || []).map((m) => ({
      id: m.id,
      order_item_id: m.order_item_id,
      material_name: m.material_name,
      unit_short: m.unit_short,
      required_qty: m.required_qty,
      available_qty: m.available_qty,
      used_qty: m.used_qty,
      session_qty: "",
      showDeliveryForm: false,
      delivery_qty: "",
    }))
  );

  /* --- Dispositions (complete phase) --- */
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

  const updateUsage = (id: string, patch: Partial<MaterialUsage>) => {
    setUsages((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const handleUseMaterial = async (u: MaterialUsage) => {
    const qty = Number(u.session_qty);
    if (!qty || qty <= 0) return;

    setLoading(true);
    setError(null);
    const res = await api.post(`/api/installation/works/${work.id}/use-material`, {
      installation_material_id: u.id,
      quantity: qty,
    });
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    onUpdated();
  };

  const handleDelivery = async (u: MaterialUsage) => {
    const qty = Number(u.delivery_qty);
    if (!qty || qty <= 0) return;

    setLoading(true);
    setError(null);
    const res = await api.post("/api/materials/deliveries", {
      items: [{ order_item_id: u.order_item_id, quantity: qty }],
    });
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    updateUsage(u.id, { showDeliveryForm: false, delivery_qty: "" });
    setLoading(false);
    onUpdated();
  };

  /* --- Photos --- */

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
    const imageFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length) setPhotos((prev) => [...prev, ...imageFiles]);
  }, []);

  /* --- Complete --- */

  const prepareComplete = () => {
    const disps: Disposition[] = (work.materials || [])
      .map((m) => {
        const totalUsed = usages.find((u) => u.id === m.id)?.used_qty ?? m.used_qty;
        const unused = m.available_qty - totalUsed;
        if (unused <= 0 || !m.order_item_id) return null;
        return {
          order_item_id: m.order_item_id,
          material_name: m.material_name,
          unit_short: m.unit_short,
          unused_qty: unused,
          action: "remaining" as const,
          qty: String(unused),
        };
      })
      .filter(Boolean) as Disposition[];
    setDispositions(disps);
    setPhase("complete");
  };

  const updateDisposition = (oid: string, field: "action" | "qty", val: string) => {
    setDispositions((prev) =>
      prev.map((d) => (d.order_item_id === oid ? { ...d, [field]: val } : d))
    );
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    for (const photo of photos) {
      const fd = new FormData();
      fd.append("file", photo);
      fd.append("work_id", work.id);
      await api.upload("/api/installation/works/photos", fd);
    }

    const res = await api.post(`/api/installation/works/${work.id}/complete`, {
      dispositions: dispositions.map((d) => ({
        order_item_id: d.order_item_id,
        quantity: Number(d.qty),
        disposition: d.action,
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

  /* ========== Render: Planned ========== */

  if (work.status === "planned") {
    return (
      <ModalShell title={`Работа #${work.work_number}`} onClose={onClose} isMobile={isMobile}>
        <div className="px-5 py-4 space-y-4">
          {error && <ErrorBanner message={error} />}
          <WorkInfo work={work} />
          <MaterialsSummaryCompact materials={work.materials || []} />
          <div className="text-center py-4">
            <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
              Работа запланирована на{" "}
              {new Date(work.planned_date).toLocaleDateString("ru-RU")}
            </p>
            <button
              className="ds-btn text-sm px-8 py-3"
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

  /* ========== Render: Completed ========== */

  if (work.status === "completed") {
    return (
      <ModalShell title={`Работа #${work.work_number}`} onClose={onClose} isMobile={isMobile}>
        <div className="px-5 py-4 space-y-4">
          <WorkInfo work={work} />
          {work.completed_at && (
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>
                Завершено
              </p>
              <p className="text-sm" style={{ color: "var(--ds-text)" }}>
                {new Date(work.completed_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          )}
          <MaterialsProgressList materials={work.materials || []} />
          <div className="flex justify-end pt-2">
            <button className="ds-btn-secondary text-sm px-4 py-2" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  /* ========== Render: In Progress - Complete phase ========== */

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
                  <DispositionRow
                    key={d.order_item_id}
                    d={d}
                    onChange={updateDisposition}
                  />
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
              style={{ background: "#22c55e" }}
            >
              {loading ? "Завершение..." : "Завершить монтаж"}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  /* ========== Render: In Progress - Main ========== */

  return (
    <ModalShell title={`Работа #${work.work_number}`} onClose={onClose} isMobile={isMobile}>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {error && <ErrorBanner message={error} />}
        <WorkInfo work={work} />

        {/* ---- Photo section ---- */}
        <PhotoSection
          photos={photos}
          onAdd={handlePhotoAdd}
          onRemove={removePhoto}
          onDrop={handlePhotoDrop}
          cameraInputRef={cameraInputRef}
          fileInputRef={fileInputRef}
        />

        {/* ---- Materials section ---- */}
        <section>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "var(--ds-text-muted)" }}
          >
            Материалы
          </label>
          <div className="space-y-2">
            {usages.map((u) => (
              <MaterialUsageRow
                key={u.id}
                u={u}
                loading={loading}
                onUpdate={(patch) => updateUsage(u.id, patch)}
                onUse={() => handleUseMaterial(u)}
                onDelivery={() => handleDelivery(u)}
              />
            ))}
            {usages.length === 0 && (
              <p className="text-sm py-2" style={{ color: "var(--ds-text-faint)" }}>
                Нет материалов
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-2 px-5 py-4 border-t"
        style={{ borderColor: "var(--ds-border)" }}
      >
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
   PhotoSection (local sub-component)
   ============================================================================ */

function PhotoSection({
  photos,
  onAdd,
  onRemove,
  onDrop,
  cameraInputRef,
  fileInputRef,
}: {
  photos: File[];
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (idx: number) => void;
  onDrop: (e: React.DragEvent) => void;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <section>
      <label
        className="block text-xs font-medium mb-2"
        style={{ color: "var(--ds-text-muted)" }}
      >
        Фото
      </label>
      <div
        className="border-2 border-dashed rounded-lg p-4 text-center transition-colors"
        style={{ borderColor: "var(--ds-border)", background: "var(--ds-surface-sunken)" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {photos.map((f, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ background: "var(--ds-surface)", color: "var(--ds-text)" }}
              >
                {f.name}
                <button onClick={() => onRemove(i)} aria-label="Удалить">
                  <svg width={12} height={12} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        {photos.length === 0 && (
          <p className="text-sm mb-2" style={{ color: "var(--ds-text-faint)" }}>
            Перетащите фото сюда или нажмите кнопку
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            className="ds-btn text-xs px-3 py-1.5"
            onClick={() => cameraInputRef.current?.click()}
          >
            Сделать фото
          </button>
          <button
            className="ds-btn-secondary text-xs px-3 py-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            Прикрепить файл
          </button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={onAdd}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={onAdd}
        />
      </div>
    </section>
  );
}
