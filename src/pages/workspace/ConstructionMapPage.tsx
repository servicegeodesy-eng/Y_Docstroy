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

/* ---------- sub-components for SVG patterns (defs) ---------- */

function SvgDefs() {
  return (
    <defs>
      {/* Concrete cross-hatch */}
      <pattern id="pat-concrete" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#dce3ec" />
        <path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="#b8c4d4" strokeWidth="0.5" />
      </pattern>
      <pattern id="pat-concrete-dk" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#3b4a5c" />
        <path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="#4e6072" strokeWidth="0.5" />
      </pattern>

      {/* Brick */}
      <pattern id="pat-brick" width="20" height="12" patternUnits="userSpaceOnUse">
        <rect width="20" height="12" fill="#e8ddd0" />
        <rect x="0.5" y="0.5" width="9" height="5" rx="0.5" fill="#d4c4b0" stroke="#c0ad96" strokeWidth="0.4" />
        <rect x="10.5" y="0.5" width="9" height="5" rx="0.5" fill="#d9cab8" stroke="#c0ad96" strokeWidth="0.4" />
        <rect x="5.5" y="6.5" width="9" height="5" rx="0.5" fill="#d6c7b3" stroke="#c0ad96" strokeWidth="0.4" />
        <rect x="-4.5" y="6.5" width="9" height="5" rx="0.5" fill="#d4c4b0" stroke="#c0ad96" strokeWidth="0.4" />
        <rect x="15.5" y="6.5" width="9" height="5" rx="0.5" fill="#d9cab8" stroke="#c0ad96" strokeWidth="0.4" />
      </pattern>
      <pattern id="pat-brick-dk" width="20" height="12" patternUnits="userSpaceOnUse">
        <rect width="20" height="12" fill="#3a3530" />
        <rect x="0.5" y="0.5" width="9" height="5" rx="0.5" fill="#4a4035" stroke="#5a5045" strokeWidth="0.4" />
        <rect x="10.5" y="0.5" width="9" height="5" rx="0.5" fill="#4e453a" stroke="#5a5045" strokeWidth="0.4" />
        <rect x="5.5" y="6.5" width="9" height="5" rx="0.5" fill="#4a4035" stroke="#5a5045" strokeWidth="0.4" />
        <rect x="-4.5" y="6.5" width="9" height="5" rx="0.5" fill="#4e453a" stroke="#5a5045" strokeWidth="0.4" />
        <rect x="15.5" y="6.5" width="9" height="5" rx="0.5" fill="#4a4035" stroke="#5a5045" strokeWidth="0.4" />
      </pattern>

      {/* Earth layers */}
      <pattern id="pat-earth" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#c9b99a" />
        <circle cx="3" cy="4" r="1.2" fill="#b5a487" />
        <circle cx="9" cy="9" r="0.9" fill="#b5a487" />
        <circle cx="7" cy="2" r="0.6" fill="#bfae94" />
      </pattern>
      <pattern id="pat-earth-dk" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#4a4030" />
        <circle cx="3" cy="4" r="1.2" fill="#5a5040" />
        <circle cx="9" cy="9" r="0.9" fill="#5a5040" />
        <circle cx="7" cy="2" r="0.6" fill="#554838" />
      </pattern>

      {/* Earth pile (excavated) */}
      <pattern id="pat-pile" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#b8a888" />
        <circle cx="4" cy="4" r="2" fill="#a89878" />
        <circle cx="11" cy="10" r="1.5" fill="#a89878" />
        <circle cx="2" cy="11" r="1" fill="#c0b090" />
        <circle cx="10" cy="3" r="1.2" fill="#c0b090" />
      </pattern>
      <pattern id="pat-pile-dk" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#3e3828" />
        <circle cx="4" cy="4" r="2" fill="#4e4838" />
        <circle cx="11" cy="10" r="1.5" fill="#4e4838" />
        <circle cx="2" cy="11" r="1" fill="#544e3e" />
        <circle cx="10" cy="3" r="1.2" fill="#544e3e" />
      </pattern>

      {/* Grass */}
      <pattern id="pat-grass" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#a8d5a0" />
        <path d="M2 10 Q2 6 3 4" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M6 10 Q6.5 5 5 3" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M10 10 Q10 7 11 5" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M14 10 Q13.5 6 14.5 4" fill="none" stroke="#7cb874" strokeWidth="0.7" />
      </pattern>
      <pattern id="pat-grass-dk" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#2d4a28" />
        <path d="M2 10 Q2 6 3 4" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M6 10 Q6.5 5 5 3" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M10 10 Q10 7 11 5" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M14 10 Q13.5 6 14.5 4" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
      </pattern>

      {/* Sheet pile hatching */}
      <pattern id="pat-sheet" width="4" height="10" patternUnits="userSpaceOnUse">
        <rect width="4" height="10" fill="#8a9bb0" />
        <line x1="0" y1="0" x2="0" y2="10" stroke="#7088a0" strokeWidth="0.8" />
        <line x1="2" y1="0" x2="2" y2="10" stroke="#96a8bc" strokeWidth="0.4" />
      </pattern>
      <pattern id="pat-sheet-dk" width="4" height="10" patternUnits="userSpaceOnUse">
        <rect width="4" height="10" fill="#3a4858" />
        <line x1="0" y1="0" x2="0" y2="10" stroke="#2a3848" strokeWidth="0.8" />
        <line x1="2" y1="0" x2="2" y2="10" stroke="#4a5868" strokeWidth="0.4" />
      </pattern>

      {/* Hover glow filter */}
      <filter id="glow" x="-8%" y="-8%" width="116%" height="116%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#5B8DB8" floodOpacity="0.35" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Sky gradient */}
      <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e8f0fe" />
        <stop offset="100%" stopColor="#f0f4f8" />
      </linearGradient>
      <linearGradient id="sky-grad-dk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1a2536" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>

      {/* Roof gradient */}
      <linearGradient id="roof-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a7a9a" />
        <stop offset="100%" stopColor="#3d5a78" />
      </linearGradient>
      <linearGradient id="roof-grad-dk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3a5a7a" />
        <stop offset="100%" stopColor="#2a4562" />
      </linearGradient>
    </defs>
  );
}

/* ---------- main component ---------- */

export default function ConstructionMapPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const go = useCallback(
    (path: string) => navigate(`/projects/${projectId}/${path}`),
    [navigate, projectId],
  );

  const handleClick = (id: string) => {
    const zone = ZONES.find((z) => z.id === id);
    if (zone) go(zone.path);
  };

  const zoneProps = (id: string) => ({
    className: "construction-zone",
    style: {
      cursor: "pointer",
      transition: "opacity 0.3s ease, filter 0.3s ease",
      opacity: hovered && hovered !== id ? 0.35 : 1,
      filter: hovered === id ? "url(#glow)" : "none",
    } as React.CSSProperties,
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
    onClick: () => handleClick(id),
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(id); }
    },
  });

  // Use dark patterns when .dark class is on html
  // We pass both sets; CSS will handle visibility via media/class
  // For simplicity, detect via JS:
  const dk = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const p = (light: string, dark: string) => `url(#${dk ? dark : light})`;

  // ---- Layout constants ----
  const W = 1000, H = 620;
  const GL = 340; // ground line Y
  // Building body
  const BX = 300, BY = 80, BW = 240, BH = GL - 80; // facade part
  // Frame (right side, exposed structure)
  const FX = BX + BW, FY = BY, FW = 130, FH = BH;
  // Roof
  const RoofPeak = 30;
  const RoofLeft = BX - 30, RoofRight = FX + FW + 30;
  // Underground
  const PitTop = GL;
  const PitBottom = GL + 140;
  const PitLeft = BX - 20, PitRight = FX + FW + 20;
  const FoundH = 30;
  // Earth pile
  const PileCenter = 140;
  // Landscaping
  const LandX = FX + FW + 60;

  return (
    <div
      className="flex flex-col items-center justify-center w-full select-none"
      style={{
        minHeight: "calc(100vh - 56px)",
        background: "var(--ds-surface-sunken)",
      }}
    >
      <h1
        className="text-xl font-bold mb-4 mt-3 tracking-tight"
        style={{ color: "var(--ds-text)" }}
      >
        Процесс строительства
      </h1>

      <div className="w-full flex items-center justify-center px-2 sm:px-6" style={{ maxWidth: 1100 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: "calc(100vh - 140px)" }}
          xmlns="http://www.w3.org/2000/svg"
          fontFamily="'Inter','Segoe UI',system-ui,sans-serif"
        >
          <SvgDefs />

          {/* ====== BACKGROUND ====== */}
          {/* Sky */}
          <rect x="0" y="0" width={W} height={GL} fill={dk ? "url(#sky-grad-dk)" : "url(#sky-grad)"} rx="12" />
          {/* Underground */}
          <rect x="0" y={GL} width={W} height={H - GL} fill={p("pat-earth", "pat-earth-dk")} />
          {/* Ground surface line */}
          <line x1="0" y1={GL} x2={W} y2={GL} stroke={dk ? "#556677" : "#8a7a6a"} strokeWidth="2.5" />
          {/* Grass strip on ground */}
          <rect x="0" y={GL - 6} width={W} height="8" fill={p("pat-grass", "pat-grass-dk")} opacity="0.6" />

          {/* ====== TERRITORY — dashed perimeter ====== */}
          <g {...zoneProps("territory")}>
            <rect
              x="50" y={GL - 100} width={W - 100} height="100"
              rx="0" fill="none"
              stroke={dk ? "#7aaad0" : "#2c5a8a"}
              strokeWidth="1.5"
              strokeDasharray="12 6"
              opacity={hovered === "territory" ? 0.9 : 0.4}
            />
            {/* Fence posts */}
            {Array.from({ length: 13 }, (_, i) => 50 + i * 72).map((x) => (
              <g key={`fp-${x}`}>
                <line x1={x} y1={GL - 100} x2={x} y2={GL - 90} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="2" opacity="0.5" />
              </g>
            ))}
            {/* Leader line + label (top-left, like the sketch) */}
            <line x1="100" y1={GL - 80} x2="48" y2={GL - 120} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.6" />
            <text x="46" y={GL - 126} textAnchor="start" fontSize="13" fontWeight="600" fill={dk ? "#7aaad0" : "#2c5a8a"}>
              Территория
            </text>
            <text x="46" y={GL - 112} textAnchor="start" fontSize="13" fontWeight="600" fill={dk ? "#7aaad0" : "#2c5a8a"}>
              строительства
            </text>
          </g>

          {/* ====== FACADE ====== */}
          <g {...zoneProps("facade")}>
            {/* Main facade wall */}
            <rect x={BX} y={BY} width={BW} height={BH} fill={p("pat-brick", "pat-brick-dk")} stroke={dk ? "#667788" : "#6a5a4a"} strokeWidth="2" />

            {/* Windows — 4 rows x 3 cols */}
            {[0, 1, 2, 3].map((row) =>
              [0, 1, 2].map((col) => {
                const wx = BX + 22 + col * 74;
                const wy = BY + 22 + row * 58;
                return (
                  <g key={`win-${row}-${col}`}>
                    <rect x={wx} y={wy} width="50" height="38" rx="2" fill={dk ? "#2a4060" : "#c8ddf0"} stroke={dk ? "#5a7a9a" : "#7a9aba"} strokeWidth="1.2" />
                    {/* Glass reflection */}
                    <line x1={wx + 25} y1={wy} x2={wx + 25} y2={wy + 38} stroke={dk ? "#4a6a8a" : "#9ab8d4"} strokeWidth="0.8" />
                    <line x1={wx} y1={wy + 19} x2={wx + 50} y2={wy + 19} stroke={dk ? "#4a6a8a" : "#9ab8d4"} strokeWidth="0.8" />
                  </g>
                );
              }),
            )}

            {/* Entrance door */}
            <rect x={BX + 90} y={BY + BH - 56} width="60" height="56" rx="3" fill={dk ? "#2a3848" : "#5a4a3a"} stroke={dk ? "#4a6070" : "#4a3a2a"} strokeWidth="1.5" />
            <circle cx={BX + 140} cy={BY + BH - 26} r="3" fill={dk ? "#8ab0d0" : "#c8a868"} />

            {/* Leader line + label (upper-left, like sketch) */}
            <line x1={BX + 20} y1={BY + 60} x2={BX - 60} y2={BY - 10} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.7" />
            <text x={BX - 62} y={BY - 16} textAnchor="end" fontSize="15" fontWeight="700" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              Фасад
            </text>
          </g>

          {/* ====== FRAME (каркас) ====== */}
          <g {...zoneProps("frame")}>
            {/* Background — light to show it's "inside" */}
            <rect x={FX} y={FY} width={FW} height={FH} fill={dk ? "#1a2a3a" : "#eef3f8"} stroke={dk ? "#4a6070" : "#5a7a9a"} strokeWidth="2" />

            {/* Floor slabs — horizontal beams */}
            {[0, 1, 2, 3, 4].map((i) => {
              const sy = FY + i * (FH / 4);
              return (
                <rect key={`slab-${i}`} x={FX} y={sy - 4} width={FW} height="8" fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />
              );
            })}

            {/* Vertical columns */}
            {[0, 1, 2].map((i) => {
              const cx = FX + 15 + i * (FW - 30) / 2;
              return (
                <rect key={`col-${i}`} x={cx - 5} y={FY} width="10" height={FH} fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />
              );
            })}

            {/* Diagonal bracing — X-pattern in two cells */}
            <line x1={FX + 10} y1={FY + 8} x2={FX + 60} y2={FY + FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />
            <line x1={FX + 60} y1={FY + 8} x2={FX + 10} y2={FY + FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />

            <line x1={FX + 70} y1={FY + FH / 2 + 8} x2={FX + FW - 10} y2={FY + 3 * FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />
            <line x1={FX + FW - 10} y1={FY + FH / 2 + 8} x2={FX + 70} y2={FY + 3 * FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />

            {/* Leader line + label (upper-right, like sketch) */}
            <line x1={FX + FW - 20} y1={FY + 50} x2={FX + FW + 50} y2={FY - 10} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.7" />
            <text x={FX + FW + 54} y={FY - 14} textAnchor="start" fontSize="15" fontWeight="700" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              Каркас
            </text>
          </g>

          {/* ====== ROOF (кровля) ====== */}
          <g {...zoneProps("roof")}>
            {/* Roof shape — flat-ish with slight slope, overhang */}
            <polygon
              points={`${RoofLeft},${BY} ${(RoofLeft + RoofRight) / 2},${RoofPeak} ${RoofRight},${BY}`}
              fill={dk ? "url(#roof-grad-dk)" : "url(#roof-grad)"}
              stroke={dk ? "#4a6a88" : "#2c4a68"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Roof edge / eave */}
            <line x1={RoofLeft} y1={BY} x2={RoofRight} y2={BY} stroke={dk ? "#5a7a98" : "#3c5a78"} strokeWidth="3" />
            {/* Roof tile lines */}
            {[0.3, 0.5, 0.7].map((t) => {
              const ly = RoofPeak + (BY - RoofPeak) * t;
              const lxl = RoofLeft + (((RoofLeft + RoofRight) / 2) - RoofLeft) * (1 - t) + 10;
              const lxr = RoofRight - (RoofRight - ((RoofLeft + RoofRight) / 2)) * (1 - t) - 10;
              return <line key={`rtl-${t}`} x1={lxl} y1={ly} x2={lxr} y2={ly} stroke={dk ? "#4a6888" : "#4a6888"} strokeWidth="0.6" opacity="0.4" />;
            })}

            {/* Leader line + label (top-right) */}
            <line x1={RoofRight - 60} y1={RoofPeak + 18} x2={RoofRight + 20} y2={RoofPeak - 10} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.7" />
            <text x={RoofRight + 24} y={RoofPeak - 14} textAnchor="start" fontSize="15" fontWeight="700" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              Кровля
            </text>
          </g>

          {/* ====== LANDSCAPING (благоустройство) ====== */}
          <g {...zoneProps("landscaping")}>
            {/* Grass area */}
            <rect x={LandX} y={GL - 6} width="200" height="8" fill={p("pat-grass", "pat-grass-dk")} />
            <rect x={LandX} y={GL - 6} width="200" height="8" fill="none" stroke={dk ? "#3d6a38" : "#5a9a50"} strokeWidth="0.5" opacity="0.6" />

            {/* Tree trunk */}
            <rect x={LandX + 78} y={GL - 70} width="10" height="66" rx="3" fill={dk ? "#5a4a30" : "#8a7050"} />
            {/* Tree crown — layered ellipses */}
            <ellipse cx={LandX + 83} cy={GL - 90} rx="36" ry="30" fill={dk ? "#2a5a28" : "#6ab060"} opacity="0.7" />
            <ellipse cx={LandX + 70} cy={GL - 100} rx="26" ry="22" fill={dk ? "#2d6a2a" : "#78c068"} opacity="0.65" />
            <ellipse cx={LandX + 96} cy={GL - 95} rx="24" ry="20" fill={dk ? "#256025" : "#68b858"} opacity="0.6" />
            <ellipse cx={LandX + 83} cy={GL - 112} rx="20" ry="16" fill={dk ? "#308030" : "#80c878"} opacity="0.55" />

            {/* Small bush */}
            <ellipse cx={LandX + 160} cy={GL - 14} rx="20" ry="14" fill={dk ? "#2a5a28" : "#6ab060"} opacity="0.6" />
            <ellipse cx={LandX + 150} cy={GL - 18} rx="14" ry="10" fill={dk ? "#308030" : "#78c068"} opacity="0.5" />

            {/* Path (walkway) */}
            <path
              d={`M ${LandX} ${GL - 2} Q ${LandX + 60} ${GL - 8} ${LandX + 120} ${GL - 2} Q ${LandX + 160} ${GL + 2} ${LandX + 200} ${GL - 2}`}
              fill="none" stroke={dk ? "#6a7a8a" : "#b0a898"} strokeWidth="3" opacity="0.5" strokeLinecap="round"
            />

            {/* Leader line + label (right side, like sketch) */}
            <line x1={LandX + 150} y1={GL - 50} x2={LandX + 200} y2={GL - 80} stroke={dk ? "#4a9a48" : "#3a8a38"} strokeWidth="1" opacity="0.7" />
            <text x={LandX + 204} y={GL - 82} textAnchor="start" fontSize="14" fontWeight="700" fill={dk ? "#5aaa58" : "#2a7a28"}>
              Благоустройство
            </text>
          </g>

          {/* ====== PIT FENCE (ограждение котлована) ====== */}
          <g {...zoneProps("pit-fence")}>
            {/* Left sheet pile wall */}
            <rect x={PitLeft} y={PitTop - 8} width="14" height={PitBottom - PitTop + 16} fill={p("pat-sheet", "pat-sheet-dk")} stroke={dk ? "#5a7a90" : "#5a7a9a"} strokeWidth="1.5" />
            {/* Right sheet pile wall */}
            <rect x={PitRight - 14} y={PitTop - 8} width="14" height={PitBottom - PitTop + 16} fill={p("pat-sheet", "pat-sheet-dk")} stroke={dk ? "#5a7a90" : "#5a7a9a"} strokeWidth="1.5" />

            {/* Labels — rotated on left wall */}
            <text
              x={PitLeft - 12}
              y={(PitTop + PitBottom) / 2}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill={dk ? "#7aaad0" : "#2c5a8a"}
              transform={`rotate(-90 ${PitLeft - 12} ${(PitTop + PitBottom) / 2})`}
            >
              Ограждение котлована
            </text>
          </g>

          {/* ====== FOUNDATION (основание) ====== */}
          <g {...zoneProps("foundation")}>
            <rect x={PitLeft + 14} y={PitTop} width={PitRight - PitLeft - 28} height={FoundH} fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="1.5" />

            {/* Leader line + label (right side) */}
            <line x1={PitRight - 40} y1={PitTop + FoundH / 2} x2={PitRight + 40} y2={PitTop + FoundH / 2 + 20} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.7" />
            <text x={PitRight + 44} y={PitTop + FoundH / 2 + 24} textAnchor="start" fontSize="14" fontWeight="700" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              Основание
            </text>
          </g>

          {/* ====== PIT (котлован) ====== */}
          <g {...zoneProps("pit")}>
            <rect
              x={PitLeft + 14} y={PitTop + FoundH}
              width={PitRight - PitLeft - 28} height={PitBottom - PitTop - FoundH}
              fill={dk ? "#1a2536" : "#e8e0d4"}
              stroke={dk ? "#4a5a6a" : "#a09888"}
              strokeWidth="1"
            />
            {/* Depth dimension lines */}
            <line x1={PitLeft + 20} y1={PitTop + FoundH + 20} x2={PitRight - 20} y2={PitTop + FoundH + 20} stroke={dk ? "#4a5a6a" : "#b0a898"} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />
            <line x1={PitLeft + 20} y1={PitBottom - 20} x2={PitRight - 20} y2={PitBottom - 20} stroke={dk ? "#4a5a6a" : "#b0a898"} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />

            {/* Leader line + label (bottom) */}
            <line x1={(PitLeft + PitRight) / 2} y1={PitBottom - 10} x2={(PitLeft + PitRight) / 2} y2={PitBottom + 30} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.7" />
            <text x={(PitLeft + PitRight) / 2} y={PitBottom + 46} textAnchor="middle" fontSize="15" fontWeight="700" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              Котлован
            </text>
          </g>

          {/* ====== EARTHWORK (объёмы земляных масс) ====== */}
          <g {...zoneProps("earthwork")}>
            {/* Earth pile — organic mound shape */}
            <path
              d={`M ${PileCenter - 70} ${PitBottom + 8}
                  L ${PileCenter - 70} ${PitTop + 40}
                  Q ${PileCenter - 60} ${PitTop - 10} ${PileCenter - 20} ${PitTop - 20}
                  Q ${PileCenter + 10} ${PitTop - 28} ${PileCenter + 40} ${PitTop - 14}
                  Q ${PileCenter + 70} ${PitTop} ${PileCenter + 80} ${PitTop + 50}
                  L ${PileCenter + 80} ${PitBottom + 8} Z`}
              fill={p("pat-pile", "pat-pile-dk")}
              stroke={dk ? "#5a5040" : "#8a7a60"}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Layer lines inside pile */}
            <path
              d={`M ${PileCenter - 60} ${PitTop + 50} Q ${PileCenter} ${PitTop + 40} ${PileCenter + 70} ${PitTop + 55}`}
              fill="none" stroke={dk ? "#6a6050" : "#a09070"} strokeWidth="0.8" opacity="0.5"
            />
            <path
              d={`M ${PileCenter - 66} ${PitTop + 80} Q ${PileCenter - 10} ${PitTop + 72} ${PileCenter + 76} ${PitTop + 85}`}
              fill="none" stroke={dk ? "#6a6050" : "#a09070"} strokeWidth="0.8" opacity="0.5"
            />

            {/* Leader line + label (left side, like sketch) */}
            <line x1={PileCenter - 30} y1={PitTop + 20} x2={PileCenter - 80} y2={PitTop - 30} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1" opacity="0.7" />
            <text x={PileCenter - 82} y={PitTop - 50} textAnchor="start" fontSize="12" fontWeight="600" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              Объёмы
            </text>
            <text x={PileCenter - 82} y={PitTop - 36} textAnchor="start" fontSize="12" fontWeight="600" fill={dk ? "#7aaad0" : "#1E3A5F"}>
              земляных масс
            </text>
          </g>

          {/* ====== TOOLTIP BAR ====== */}
          {hovered && (() => {
            const zone = ZONES.find((z) => z.id === hovered);
            if (!zone) return null;
            const label = zone.label;
            const tw = Math.max(label.length * 9.5, 140);
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={W / 2 - tw / 2 - 16} y={H - 50}
                  width={tw + 32} height="36" rx="10"
                  fill={dk ? "#2a4a6a" : "#1E3A5F"}
                  opacity="0.94"
                />
                <text x={W / 2} y={H - 26} textAnchor="middle" fontSize="14" fontWeight="600" fill="white">
                  {label}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
