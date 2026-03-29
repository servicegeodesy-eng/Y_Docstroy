import { useMobile } from "@/lib/MobileContext";

export interface WorkMaterial {
  id: string;
  material_name: string;
  unit_name: string;
  required_qty: number;
  ordered_qty: number;
  available_qty: number;
  used_qty: number;
}

export interface InstallationWork {
  id: string;
  work_number: string;
  status: "planned" | "in_progress" | "completed";
  building_name: string;
  work_type_name: string;
  floor_name: string | null;
  construction_name: string | null;
  planned_date: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_by_name: string;
  materials: WorkMaterial[];
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Завершено",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  planned: { bg: "color-mix(in srgb, #3b82f6 15%, transparent)", text: "#3b82f6" },
  in_progress: { bg: "color-mix(in srgb, #f59e0b 15%, transparent)", text: "#f59e0b" },
  completed: { bg: "color-mix(in srgb, #22c55e 15%, transparent)", text: "#22c55e" },
};

interface Props {
  work: InstallationWork;
  onClick: () => void;
}

export default function WorkCard({ work, onClick }: Props) {
  const { isMobile } = useMobile();
  const sc = STATUS_COLORS[work.status] || STATUS_COLORS.planned;

  const locationParts = [
    work.building_name,
    work.work_type_name,
    work.floor_name,
    work.construction_name,
  ].filter(Boolean);

  return (
    <div
      className="ds-card p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm" style={{ color: "var(--ds-text)" }}>
              #{work.work_number}
            </span>
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
              {new Date(work.planned_date).toLocaleDateString("ru-RU")}
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
          {STATUS_LABELS[work.status] || work.status}
        </span>
      </div>

      {/* Material progress bars */}
      <div className="space-y-2">
        {work.materials.slice(0, isMobile ? 2 : 4).map((mat) => {
          const max = Math.max(mat.required_qty, 1);
          const orderedPct = Math.min((mat.ordered_qty / max) * 100, 100);
          const availablePct = Math.min((mat.available_qty / max) * 100, 100);
          const usedPct = Math.min((mat.used_qty / max) * 100, 100);

          return (
            <div key={mat.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="truncate" style={{ color: "var(--ds-text)" }}>
                  {mat.material_name}
                </span>
                <span className="ml-2 whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>
                  {mat.used_qty}/{mat.required_qty} {mat.unit_name}
                </span>
              </div>
              {/* Stacked progress bar */}
              <div
                className="h-2 rounded-full overflow-hidden relative"
                style={{ background: "var(--ds-surface-sunken)" }}
              >
                {/* Required = full gray background */}
                {/* Ordered = blue layer */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${orderedPct}%`, background: "#3b82f6", opacity: 0.3 }}
                />
                {/* Available = green layer */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${availablePct}%`, background: "#22c55e", opacity: 0.5 }}
                />
                {/* Used = orange solid */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${usedPct}%`, background: "#f59e0b" }}
                />
              </div>
            </div>
          );
        })}
        {work.materials.length > (isMobile ? 2 : 4) && (
          <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
            + ещё {work.materials.length - (isMobile ? 2 : 4)} позиций
          </p>
        )}
      </div>

      {/* Legend (compact) */}
      {work.materials.length > 0 && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: "var(--ds-border)" }}>
          <LegendDot color="#9ca3af" label="Заявлено" />
          <LegendDot color="#3b82f6" label="Заказано" />
          <LegendDot color="#22c55e" label="Доступно" />
          <LegendDot color="#f59e0b" label="Использовано" />
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ds-text-faint)" }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
      {label}
    </span>
  );
}
