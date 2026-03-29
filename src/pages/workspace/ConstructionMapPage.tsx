import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Zone {
  id: string;
  label: string;
  path: string;
}

const ZONES: Zone[] = [
  { id: "roof",        label: "Кровля",                  path: "plan" },
  { id: "facade",      label: "Фасад",                   path: "facades" },
  { id: "frame",       label: "Каркас",                   path: "chessboard" },
  { id: "territory",   label: "Территория строительства", path: "plan" },
  { id: "landscaping", label: "Благоустройство",          path: "landscaping" },
  { id: "foundation",  label: "Основание",                path: "plan" },
  { id: "pit",         label: "Котлован",                  path: "plan" },
  { id: "pit-fence",   label: "Ограждение котлована",      path: "plan" },
  { id: "earthwork",   label: "Объёмы земляных масс",      path: "plan" },
];

export default function ConstructionMapPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const go = useCallback(
    (path: string) => navigate(`/projects/${projectId}/${path}`),
    [navigate, projectId],
  );

  const zoneStyle = (id: string): React.CSSProperties => ({
    cursor: "pointer",
    transition: "all 0.25s ease",
    opacity: hovered && hovered !== id ? 0.45 : 1,
    filter: hovered === id ? "brightness(1.15)" : "none",
  });

  const labelForZone = (id: string) =>
    ZONES.find((z) => z.id === id)?.label ?? "";

  const handleClick = (id: string) => {
    const zone = ZONES.find((z) => z.id === id);
    if (zone) go(zone.path);
  };

  const zoneProps = (id: string) => ({
    style: zoneStyle(id),
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
    onClick: () => handleClick(id),
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleClick(id);
    },
  });

  return (
    <div
      className="flex flex-col items-center justify-center w-full"
      style={{
        minHeight: "calc(100vh - 56px)",
        background: "var(--ds-surface-sunken)",
      }}
    >
      <h1
        className="text-xl font-bold mb-6 mt-4"
        style={{ color: "var(--ds-text)" }}
      >
        Процесс строительства
      </h1>

      <div
        className="w-full flex items-center justify-center px-4"
        style={{ maxWidth: 960 }}
      >
        <svg
          viewBox="0 0 800 520"
          className="w-full"
          style={{
            maxHeight: "calc(100vh - 160px)",
            filter: "drop-shadow(0 4px 24px hsl(215 28% 17% / 0.10))",
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* ground pattern */}
            <pattern id="ground-pat" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="var(--ds-surface-sunken)" />
              <circle cx="2" cy="6" r="0.7" fill="var(--ds-border)" />
              <circle cx="6" cy="3" r="0.5" fill="var(--ds-border)" />
            </pattern>
            {/* hatch for underground */}
            <pattern id="earth-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--ds-surface)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ds-border)" strokeWidth="1" />
            </pattern>
            {/* grass */}
            <linearGradient id="grass-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* ==================== SKY ==================== */}
          <rect x="0" y="0" width="800" height="280" fill="var(--ds-surface)" rx="16" />

          {/* ==================== GROUND LINE ==================== */}
          <line x1="0" y1="280" x2="800" y2="280" stroke="var(--ds-border-strong)" strokeWidth="2" />

          {/* ==================== UNDERGROUND FILL ==================== */}
          <rect x="0" y="280" width="800" height="240" fill="var(--ds-surface-sunken)" rx="0" />

          {/* ================= TERRITORY (background area) ================= */}
          <g {...zoneProps("territory")}>
            {/* fenced perimeter */}
            <rect
              x="60" y="200" width="680" height="82"
              rx="6"
              fill="none"
              stroke="var(--ds-accent)"
              strokeWidth="1.5"
              strokeDasharray="8 4"
              opacity="0.35"
            />
            {/* fence posts */}
            {[80, 160, 240, 320, 400, 480, 560, 640, 720].map((x) => (
              <line key={x} x1={x} y1="198" x2={x} y2="206" stroke="var(--ds-accent)" strokeWidth="1.5" opacity="0.4" />
            ))}
            {/* label */}
            <text
              x="400" y="216"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--ds-text-muted)"
              opacity={hovered === "territory" ? 1 : 0.7}
            >
              ТЕРРИТОРИЯ СТРОИТЕЛЬСТВА
            </text>
          </g>

          {/* ================= BUILDING BODY ================= */}
          {/* Building outline (facade zone) */}
          <g {...zoneProps("facade")}>
            <rect
              x="240" y="60" width="200" height="220"
              rx="4"
              fill="var(--ds-surface-elevated)"
              stroke="var(--ds-border-strong)"
              strokeWidth="2"
            />
            {/* Facade details — windows grid */}
            {[0, 1, 2, 3].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`w-${row}-${col}`}
                  x={264 + col * 60}
                  y={90 + row * 48}
                  width="36"
                  height="30"
                  rx="3"
                  fill="var(--ds-surface-sunken)"
                  stroke="var(--ds-border)"
                  strokeWidth="1"
                />
              )),
            )}
            {/* Door */}
            <rect
              x="316" y="240" width="48" height="40"
              rx="3"
              fill="var(--ds-surface-sunken)"
              stroke="var(--ds-border-strong)"
              strokeWidth="1.5"
            />
            <circle cx="358" cy="262" r="2.5" fill="var(--ds-accent)" />
            {/* Label */}
            <text
              x="340" y="170"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="var(--ds-accent)"
              opacity={hovered === "facade" ? 1 : 0.75}
            >
              ФАСАД
            </text>
          </g>

          {/* ================= FRAME (каркас — visible structural grid behind facade) ================= */}
          <g {...zoneProps("frame")}>
            {/* Right side of building — exposed frame */}
            <rect
              x="440" y="60" width="120" height="220"
              rx="2"
              fill="none"
              stroke="var(--ds-accent)"
              strokeWidth="2"
              opacity="0.6"
            />
            {/* Perspective lines */}
            <line x1="440" y1="60" x2="560" y2="60" stroke="var(--ds-accent)" strokeWidth="1.5" opacity="0.5" />
            <line x1="440" y1="280" x2="560" y2="280" stroke="var(--ds-accent)" strokeWidth="1.5" opacity="0.5" />
            {/* Vertical columns */}
            {[470, 500, 530].map((x) => (
              <line key={`fc-${x}`} x1={x} y1="60" x2={x} y2="280" stroke="var(--ds-accent)" strokeWidth="1.5" opacity="0.35" />
            ))}
            {/* Horizontal floors */}
            {[110, 158, 206, 254].map((y) => (
              <line key={`ff-${y}`} x1="440" y1={y} x2="560" y2={y} stroke="var(--ds-accent)" strokeWidth="1.5" opacity="0.35" />
            ))}
            {/* Cross bracing */}
            <line x1="440" y1="60" x2="470" y2="110" stroke="var(--ds-brand-orange)" strokeWidth="1" opacity="0.4" />
            <line x1="470" y1="60" x2="440" y2="110" stroke="var(--ds-brand-orange)" strokeWidth="1" opacity="0.4" />
            <line x1="530" y1="206" x2="560" y2="254" stroke="var(--ds-brand-orange)" strokeWidth="1" opacity="0.4" />
            <line x1="560" y1="206" x2="530" y2="254" stroke="var(--ds-brand-orange)" strokeWidth="1" opacity="0.4" />
            {/* Label */}
            <text
              x="500" y="170"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="var(--ds-accent)"
              opacity={hovered === "frame" ? 1 : 0.75}
            >
              КАРКАС
            </text>
          </g>

          {/* ================= ROOF (кровля) ================= */}
          <g {...zoneProps("roof")}>
            <polygon
              points="220,60 400,12 560,60"
              fill="var(--ds-accent)"
              opacity="0.15"
              stroke="var(--ds-accent)"
              strokeWidth="2"
            />
            {/* Roof ridge */}
            <line x1="400" y1="12" x2="400" y2="22" stroke="var(--ds-accent)" strokeWidth="2" opacity="0.5" />
            {/* Roof tiles hint */}
            <line x1="310" y1="36" x2="490" y2="36" stroke="var(--ds-accent)" strokeWidth="0.8" opacity="0.25" />
            <line x1="270" y1="48" x2="530" y2="48" stroke="var(--ds-accent)" strokeWidth="0.8" opacity="0.25" />
            {/* Label */}
            <text
              x="400" y="46"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="var(--ds-accent)"
              opacity={hovered === "roof" ? 1 : 0.8}
            >
              КРОВЛЯ
            </text>
          </g>

          {/* ================= LANDSCAPING (благоустройство) ================= */}
          <g {...zoneProps("landscaping")}>
            {/* Grass area */}
            <rect x="580" y="258" width="180" height="22" rx="4" fill="url(#grass-grad)" />
            <rect x="580" y="258" width="180" height="22" rx="4" fill="none" stroke="#4ade80" strokeWidth="1" opacity="0.3" />
            {/* Tree 1 */}
            <circle cx="630" cy="232" r="22" fill="#4ade80" opacity="0.2" />
            <circle cx="630" cy="228" r="16" fill="#4ade80" opacity="0.25" />
            <rect x="628" y="248" width="4" height="14" rx="1" fill="#a3824a" opacity="0.4" />
            {/* Tree 2 */}
            <circle cx="710" cy="238" r="16" fill="#4ade80" opacity="0.18" />
            <circle cx="710" cy="234" r="11" fill="#4ade80" opacity="0.22" />
            <rect x="708" y="248" width="4" height="12" rx="1" fill="#a3824a" opacity="0.35" />
            {/* Bench */}
            <rect x="660" y="260" width="24" height="6" rx="2" fill="var(--ds-border-strong)" opacity="0.5" />
            <rect x="662" y="266" width="3" height="6" rx="1" fill="var(--ds-border-strong)" opacity="0.4" />
            <rect x="679" y="266" width="3" height="6" rx="1" fill="var(--ds-border-strong)" opacity="0.4" />
            {/* Path */}
            <path
              d="M 580 272 Q 620 270 660 274 Q 700 278 740 274 L 760 272"
              fill="none"
              stroke="var(--ds-border-strong)"
              strokeWidth="2"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            {/* Label */}
            <text
              x="670" y="248"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#16a34a"
              opacity={hovered === "landscaping" ? 1 : 0.7}
            >
              БЛАГОУСТРОЙСТВО
            </text>
          </g>

          {/* ================= FOUNDATION (основание) ================= */}
          <g {...zoneProps("foundation")}>
            <rect
              x="230" y="280" width="340" height="30"
              fill="var(--ds-surface-elevated)"
              stroke="var(--ds-border-strong)"
              strokeWidth="1.5"
            />
            {/* foundation texture */}
            {[250, 290, 330, 370, 410, 450, 490, 530, 550].map((x) => (
              <line key={`fn-${x}`} x1={x} y1="284" x2={x} y2="306" stroke="var(--ds-border)" strokeWidth="0.8" opacity="0.4" />
            ))}
            {/* Label */}
            <text
              x="400" y="300"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--ds-text-muted)"
              opacity={hovered === "foundation" ? 1 : 0.7}
            >
              ОСНОВАНИЕ
            </text>
          </g>

          {/* ================= PIT (котлован) ================= */}
          <g {...zoneProps("pit")}>
            <rect
              x="230" y="310" width="340" height="90"
              fill="url(#earth-hatch)"
              stroke="var(--ds-border-strong)"
              strokeWidth="1.5"
            />
            {/* depth markers */}
            <line x1="236" y1="340" x2="564" y2="340" stroke="var(--ds-border)" strokeWidth="0.5" strokeDasharray="3 4" opacity="0.4" />
            <line x1="236" y1="370" x2="564" y2="370" stroke="var(--ds-border)" strokeWidth="0.5" strokeDasharray="3 4" opacity="0.4" />
            {/* Label */}
            <text
              x="400" y="365"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="var(--ds-text-muted)"
              opacity={hovered === "pit" ? 1 : 0.7}
            >
              КОТЛОВАН
            </text>
          </g>

          {/* ================= PIT FENCE (ограждение котлована) ================= */}
          <g {...zoneProps("pit-fence")}>
            {/* Left wall */}
            <rect
              x="220" y="278" width="12" height="126"
              fill="var(--ds-surface-elevated)"
              stroke="var(--ds-accent)"
              strokeWidth="1.5"
              opacity="0.7"
            />
            {/* Right wall */}
            <rect
              x="568" y="278" width="12" height="126"
              fill="var(--ds-surface-elevated)"
              stroke="var(--ds-accent)"
              strokeWidth="1.5"
              opacity="0.7"
            />
            {/* Sheet pile texture left */}
            {[290, 310, 330, 350, 370, 390].map((y) => (
              <line key={`pl-${y}`} x1="222" y1={y} x2="230" y2={y} stroke="var(--ds-accent)" strokeWidth="0.6" opacity="0.35" />
            ))}
            {/* Sheet pile texture right */}
            {[290, 310, 330, 350, 370, 390].map((y) => (
              <line key={`pr-${y}`} x1="570" y1={y} x2="578" y2={y} stroke="var(--ds-accent)" strokeWidth="0.6" opacity="0.35" />
            ))}
            {/* Labels */}
            <text
              x="182" y="348"
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="var(--ds-accent)"
              opacity={hovered === "pit-fence" ? 1 : 0.65}
              transform="rotate(-90 182 348)"
            >
              ОГРАЖДЕНИЕ КОТЛОВАНА
            </text>
          </g>

          {/* ================= EARTHWORK (объёмы земляных масс) ================= */}
          <g {...zoneProps("earthwork")}>
            {/* Left earth pile */}
            <path
              d="M 60 400 L 60 340 Q 70 310 100 306 Q 130 302 160 310 Q 180 316 190 340 L 190 400 Z"
              fill="url(#ground-pat)"
              stroke="var(--ds-border-strong)"
              strokeWidth="1.5"
            />
            {/* earth layer lines */}
            <path d="M 68 360 Q 100 354 130 356 Q 160 358 184 362" fill="none" stroke="var(--ds-border)" strokeWidth="0.7" opacity="0.5" />
            <path d="M 64 380 Q 100 374 130 376 Q 160 378 188 382" fill="none" stroke="var(--ds-border)" strokeWidth="0.7" opacity="0.5" />
            {/* Label */}
            <text
              x="125" y="350"
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="var(--ds-text-muted)"
              opacity={hovered === "earthwork" ? 1 : 0.65}
            >
              ОБЪЁМЫ
            </text>
            <text
              x="125" y="362"
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="var(--ds-text-muted)"
              opacity={hovered === "earthwork" ? 1 : 0.65}
            >
              ЗЕМЛЯНЫХ
            </text>
            <text
              x="125" y="374"
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="var(--ds-text-muted)"
              opacity={hovered === "earthwork" ? 1 : 0.65}
            >
              МАСС
            </text>
          </g>

          {/* ================= LEADER LINES & ANNOTATIONS ================= */}
          {/* Subtle connection lines from zones to labels (only on hover) */}

          {/* ================= GROUND EDGE DECORATION ================= */}
          <rect x="0" y="400" width="800" height="120" fill="var(--ds-surface-sunken)" rx="0" ry="0" />
          <line x1="0" y1="400" x2="220" y2="400" stroke="var(--ds-border)" strokeWidth="1" opacity="0.5" />
          <line x1="580" y1="400" x2="800" y2="400" stroke="var(--ds-border)" strokeWidth="1" opacity="0.5" />

          {/* ================= TOOLTIP ================= */}
          {hovered && (
            <g>
              <rect
                x="300" y="470" width="200" height="34" rx="8"
                fill="var(--ds-accent)"
                opacity="0.92"
              />
              <text
                x="400" y="492"
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="white"
              >
                {labelForZone(hovered)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
