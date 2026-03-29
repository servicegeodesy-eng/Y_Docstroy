import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useOverlays } from "@/hooks/useOverlays";
import { useCellMasks } from "@/hooks/useCellMasks";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useDictionaries } from "@/hooks/useDictionaries";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import DropdownPortal from "@/components/ui/DropdownPortal";
import StatusHatchPatterns from "@/components/plan/svgPatterns";
import { getColorPreset } from "@/constants/colorPalette";

interface WorkMask {
  id: string;
  work_id: string;
  overlay_id: string;
  polygon_points: { x: number; y: number }[];
  work_status: string;
  work_notes: string | null;
  planned_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  progress: number;
  building_name: string | null;
  work_type_name: string | null;
  floor_name: string | null;
  construction_name: string | null;
}

interface Props {
  onWorkClick?: (workId: string) => void;
}

type Point = { x: number; y: number };

const STATUS_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  planned: { fill: "rgba(59,130,246,0.12)", stroke: "#3b82f6", label: "Запланировано" },
  in_progress: { fill: "rgba(249,115,22,0.25)", stroke: "#f97316", label: "В процессе" },
  completed: { fill: "rgba(34,197,94,0.3)", stroke: "#22c55e", label: "Завершено" },
};

function centroid(points: Point[]): Point {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / n, y: cy / n };
}

function shortDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Заливка по прогрессу: от светло-оранжевого (0%) до зелёного (100%) */
function progressFill(status: string, progress: number): string {
  if (status === "completed") return "rgba(34,197,94,0.35)";
  if (status === "planned") return "rgba(59,130,246,0.1)";
  // in_progress: interpolate orange → green
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const r = Math.round(249 * (1 - t) + 34 * t);
  const g = Math.round(115 * (1 - t) + 197 * t);
  const b = Math.round(22 * (1 - t) + 94 * t);
  const a = 0.15 + t * 0.2;
  return `rgba(${r},${g},${b},${a})`;
}

function progressStroke(status: string, progress: number): string {
  if (status === "completed") return "#22c55e";
  if (status === "planned") return "#3b82f6";
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const r = Math.round(249 * (1 - t) + 34 * t);
  const g = Math.round(115 * (1 - t) + 197 * t);
  const b = Math.round(22 * (1 - t) + 94 * t);
  return `rgb(${r},${g},${b})`;
}

export default function WorkOverlayView({ onWorkClick }: Props) {
  const { buildings } = useDictionaries();
  const {
    overlays, overlayBuildings,
    loading: overlaysLoading,
  } = useOverlays();
  const { getColorKey } = useProjectStatuses();

  const [selBuilding, setSelBuilding] = useState("");
  const [selOverlay, setSelOverlay] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [workMasks, setWorkMasks] = useState<WorkMask[]>([]);
  const [loadingMasks, setLoadingMasks] = useState(false);
  const [hoveredMask, setHoveredMask] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; mask: WorkMask } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Cell masks for reference
  const { masks: cellMasks } = useCellMasks(selOverlay || null);

  // Filter overlays (show all that have buildings/constructions)
  const filteredOverlays = useMemo(() => {
    return overlays.filter((o) => {
      const hasBld = (overlayBuildings[o.id]?.length || 0) > 0;
      if (selBuilding && hasBld && !overlayBuildings[o.id].includes(selBuilding)) return false;
      return true;
    });
  }, [overlays, overlayBuildings, selBuilding]);

  // Auto-select first overlay
  useEffect(() => {
    if (filteredOverlays.length > 0) {
      const current = filteredOverlays.find((o) => o.id === selOverlay);
      if (!current) setSelOverlay(filteredOverlays[0].id);
    } else {
      setSelOverlay("");
    }
  }, [filteredOverlays, selOverlay]);

  // Load overlay image
  useEffect(() => {
    if (!selOverlay) { setImageUrl(null); return; }
    const overlay = overlays.find((o) => o.id === selOverlay);
    if (!overlay) return;
    let cancelled = false;
    getOverlayUrl(overlay.storage_path).then((url) => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [selOverlay, overlays]);

  // Load work masks
  const loadWorkMasks = useCallback(async () => {
    if (!selOverlay) { setWorkMasks([]); return; }
    setLoadingMasks(true);
    const res = await api.get<WorkMask[]>("/api/installation/masks", { overlay_id: selOverlay });
    if (res.data) setWorkMasks(res.data);
    setLoadingMasks(false);
  }, [selOverlay]);

  useEffect(() => {
    loadWorkMasks();
  }, [loadWorkMasks]);



  const selectedOverlay = overlays.find((o) => o.id === selOverlay);
  const aspectW = 1000;
  const imageAspectH = selectedOverlay?.height && selectedOverlay?.width
    ? (1000 * selectedOverlay.height) / selectedOverlay.width : 750;

  const displayPoint = (p: Point) => `${p.x * aspectW},${p.y * imageAspectH}`;

  const handleMouseEnter = useCallback((mask: WorkMask, e: React.MouseEvent) => {
    setHoveredMask(mask.id);
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, mask });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredMask(null);
    setTooltip(null);
  }, []);

  // Filter dropdown state
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openFilter) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(target) &&
          !(target instanceof Element && target.closest("[data-dropdown-portal]"))) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openFilter]);

  if (overlaysLoading) {
    return (
      <div className="ds-card p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "var(--ds-accent)" }} />
      </div>
    );
  }

  if (overlays.length === 0) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p>Нет доступных подложек</p>
      </div>
    );
  }

  const filterDefs = [
    { key: "building", label: "Место работ", value: selBuilding, items: buildings, onChange: (v: string) => setSelBuilding(v) },
    ...(filteredOverlays.length > 1
      ? [{ key: "overlay", label: "Подложка", value: selOverlay, items: filteredOverlays, onChange: (v: string) => setSelOverlay(v) }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="ds-card p-3">
        <div className="flex items-center gap-2 flex-wrap" ref={filterRef}>
          {filterDefs.map(({ key, label, value, items, onChange }) => {
            if (items.length === 0 && !value) return null;
            const isOpen = openFilter === key;
            const selectedName = items.find((i) => i.id === value)?.name;
            return (
              <div key={key} className="relative">
                <button
                  ref={(el) => { filterBtnRefs.current[key] = el; }}
                  onClick={() => setOpenFilter(isOpen ? null : key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  style={value
                    ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                    : { borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}
                >
                  {label}
                  {selectedName && (
                    <span className="max-w-[120px] truncate font-normal" style={{ color: "var(--ds-accent)" }}>: {selectedName}</span>
                  )}
                  <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <DropdownPortal anchorRef={{ current: filterBtnRefs.current[key] ?? null }} open={isOpen} className="min-w-[200px] max-w-[280px] max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { onChange(""); setOpenFilter(null); }}
                    className="w-full text-left px-3 py-1.5 text-sm"
                    style={!value ? { color: "var(--ds-accent)", fontWeight: 500 } : { color: "var(--ds-text-muted)" }}
                  >
                    Все
                  </button>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { onChange(item.id); setOpenFilter(null); }}
                      className="w-full text-left px-3 py-1.5 text-sm truncate"
                      style={value === item.id
                        ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", fontWeight: 500 }
                        : { color: "var(--ds-text)" }}
                    >
                      {item.name}
                    </button>
                  ))}
                </DropdownPortal>
              </div>
            );
          })}

          {filteredOverlays.length === 1 && selectedOverlay && (
            <span className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)", border: "1px solid var(--ds-border)" }}>
              {selectedOverlay.name}
            </span>
          )}

          {selOverlay && !loadingMasks && (
            <>
              <div className="w-px h-5" style={{ background: "var(--ds-border)" }} />
              <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                Работ на карте: {workMasks.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ds-text-faint)" }}>
            <span className="w-3 h-3 rounded-sm inline-block border" style={{ background: val.fill, borderColor: val.stroke }} />
            {val.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ds-text-faint)" }}>
          <span className="w-3 h-3 rounded-sm inline-block border" style={{ background: "rgba(156,163,175,0.15)", borderColor: "#9ca3af" }} />
          Ячейки (реестр)
        </span>
      </div>

      {/* Canvas */}
      {!selOverlay ? (
        <div className="flex items-center justify-center h-48 text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Выберите фильтры для отображения подложки
        </div>
      ) : !imageUrl ? (
        <div className="flex items-center justify-center h-48">
          <div className="ds-spinner" />
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${aspectW} ${imageAspectH}`}
            className="w-full h-auto rounded-lg"
            style={{ border: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}
          >
            <StatusHatchPatterns />

            {/* Overlay image */}
            <image href={imageUrl} width={aspectW} height={imageAspectH} />

            {/* Cell masks (reference, gray) */}
            {cellMasks.map((mask) => {
              const colorKey = getColorKey(mask.cell_status);
              const preset = getColorPreset(colorKey);
              return (
                <polygon
                  key={`cell-${mask.id}`}
                  points={mask.polygon_points.map(displayPoint).join(" ")}
                  fill={`url(#hatch-${colorKey})`}
                  stroke={preset.bg}
                  strokeWidth="1.5"
                  opacity="0.35"
                  className="pointer-events-none"
                />
              );
            })}

            {/* Work masks */}
            {workMasks.map((mask) => {
              const isHovered = hoveredMask === mask.id;
              const fill = progressFill(mask.work_status, mask.progress);
              const stroke = progressStroke(mask.work_status, mask.progress);
              const isDashed = mask.work_status === "planned";
              const center = centroid(mask.polygon_points);

              return (
                <g key={`work-${mask.id}`}>
                  <polygon
                    points={mask.polygon_points.map(displayPoint).join(" ")}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isHovered ? "3" : "2"}
                    strokeDasharray={isDashed ? "8 4" : undefined}
                    opacity={isHovered ? 0.95 : 0.8}
                    className="cursor-pointer transition-opacity"
                    onClick={() => onWorkClick?.(mask.work_id)}
                    onMouseEnter={(e) => handleMouseEnter(mask, e)}
                    onMouseLeave={handleMouseLeave}
                  />
                  {/* Progress label */}
                  <text
                    x={center.x * aspectW}
                    y={center.y * imageAspectH - 6}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={11}
                    fontWeight="700"
                    fill={stroke}
                    className="pointer-events-none select-none"
                  >
                    {mask.progress}%
                  </text>
                  {/* Date */}
                  <text
                    x={center.x * aspectW}
                    y={center.y * imageAspectH + 8}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight="500"
                    fill={stroke}
                    opacity="0.8"
                    className="pointer-events-none select-none"
                  >
                    {shortDate(mask.planned_date)}
                  </text>
                  {/* Completed checkmark */}
                  {mask.work_status === "completed" && (
                    <text
                      x={center.x * aspectW + 16}
                      y={center.y * imageAspectH - 6}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      className="pointer-events-none select-none"
                    >
                      &#10003;
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-10 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[240px]"
              style={{
                background: "var(--ds-surface)",
                border: "1px solid var(--ds-border)",
                left: Math.min(tooltip.x + 12, (svgRef.current?.getBoundingClientRect().width || 600) - 250),
                top: tooltip.y + 12,
              }}
            >
              <p className="font-medium" style={{ color: "var(--ds-text)" }}>
                {[tooltip.mask.building_name, tooltip.mask.work_type_name].filter(Boolean).join(" / ")}
              </p>
              {(tooltip.mask.floor_name || tooltip.mask.construction_name) && (
                <p className="mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
                  {[tooltip.mask.floor_name, tooltip.mask.construction_name].filter(Boolean).join(" / ")}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    background: STATUS_COLORS[tooltip.mask.work_status]?.fill || "transparent",
                    color: STATUS_COLORS[tooltip.mask.work_status]?.stroke || "var(--ds-text)",
                  }}
                >
                  {STATUS_COLORS[tooltip.mask.work_status]?.label || tooltip.mask.work_status}
                </span>
                <span style={{ color: "var(--ds-text)" }}>{tooltip.mask.progress}%</span>
              </div>
              {tooltip.mask.planned_date && (
                <p className="mt-0.5" style={{ color: "var(--ds-text-faint)" }}>
                  План: {new Date(tooltip.mask.planned_date).toLocaleDateString("ru")}
                </p>
              )}
              {tooltip.mask.work_notes && (
                <p className="mt-0.5 truncate" style={{ color: "var(--ds-text-faint)" }}>
                  {tooltip.mask.work_notes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
