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
  { id: "pit",         label: "Ограждение котлована",       path: "plan" },
  { id: "piles",       label: "Сваи",                      path: "plan" },
  { id: "earthwork",   label: "Объёмы земляных масс",      path: "plan" },
];

/* ---- Framed label ---- */
function FramedLabel({
  x, y, text, text2, anchor = "start", dk, id, hovered,
}: {
  x: number; y: number; text: string; text2?: string; anchor?: "start" | "middle" | "end"; dk: boolean; id: string; hovered: string | null;
}) {
  const isH = hovered === id;
  const lH = 16, padX = 8, padY = 4, charW = 7.2;
  const lines = text2 ? [text, text2] : [text];
  const maxL = Math.max(...lines.map((l) => l.length));
  const bW = maxL * charW + padX * 2;
  const bH = lines.length * lH + padY * 2;
  const bx = anchor === "end" ? x - bW : anchor === "middle" ? x - bW / 2 : x;
  const by = y - bH + padY;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={bx} y={by} width={bW} height={bH} rx="4"
        fill={dk ? "rgba(26,37,54,0.92)" : "rgba(255,255,255,0.92)"}
        stroke={isH ? (dk ? "#7aaad0" : "#1E3A5F") : (dk ? "#4a5a6a" : "#b0bcc8")}
        strokeWidth={isH ? 1.5 : 1}
      />
      {lines.map((l, i) => (
        <text key={i} x={bx + padX} y={by + padY + (i + 1) * lH - 3} fontSize="12" fontWeight="600" fill={dk ? "#7aaad0" : "#1E3A5F"}>{l}</text>
      ))}
    </g>
  );
}

/* ---------- SVG patterns ---------- */
function SvgDefs() {
  return (
    <defs>
      <pattern id="pat-concrete" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#dce3ec" />
        <path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="#b8c4d4" strokeWidth="0.5" />
      </pattern>
      <pattern id="pat-concrete-dk" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#3b4a5c" />
        <path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="#4e6072" strokeWidth="0.5" />
      </pattern>

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

      <pattern id="pat-grass" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#a8d5a0" />
        <path d="M2 10Q2 6 3 4" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M6 10Q6.5 5 5 3" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M10 10Q10 7 11 5" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M14 10Q13.5 6 14.5 4" fill="none" stroke="#7cb874" strokeWidth="0.7" />
      </pattern>
      <pattern id="pat-grass-dk" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#2d4a28" />
        <path d="M2 10Q2 6 3 4" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M6 10Q6.5 5 5 3" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M10 10Q10 7 11 5" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M14 10Q13.5 6 14.5 4" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
      </pattern>

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

      <filter id="glow" x="-8%" y="-8%" width="116%" height="116%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#5B8DB8" floodOpacity="0.35" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="shadow" />
        <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>

      <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e8f0fe" /><stop offset="100%" stopColor="#f0f4f8" />
      </linearGradient>
      <linearGradient id="sky-grad-dk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1a2536" /><stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="roof-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a7a9a" /><stop offset="100%" stopColor="#3d5a78" />
      </linearGradient>
      <linearGradient id="roof-grad-dk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3a5a7a" /><stop offset="100%" stopColor="#2a4562" />
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

  const dk = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const p = (light: string, dark: string) => `url(#${dk ? dark : light})`;

  /* ---- Layout constants ---- */
  const W = 1000, H = 560;
  const GL = 340; // ground line
  // Building
  const BX = 310, BY = 100, BW = 210, BH = GL - BY;
  // Frame (exposed structure, right side)
  const FX = BX + BW, FY = BY, FW = 115, FH = BH;
  // Roof
  const RoofPeak = 48, RoofLeft = BX - 22, RoofRight = FX + FW + 22;
  // Underground — flat pit
  const PitLeft = BX - 16, PitRight = FX + FW + 16;
  const FoundH = 24;
  const PitH = 28; // very flat strip
  // Earthwork — on surface, left of building
  const PileX = 120, PileW = 130, PileH = 50;
  // Landscaping — right of building
  const LandX = FX + FW + 50;

  const lc = dk ? "#5a6a7a" : "#8a9aaa";

  return (
    <div
      className="flex-1 flex items-center justify-center min-h-0 overflow-hidden select-none"
      style={{ background: "var(--ds-surface-sunken)" }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        fontFamily="'Inter','Segoe UI',system-ui,sans-serif"
      >
        <SvgDefs />

        {/* ====== BACKGROUND ====== */}
        <rect x="0" y="0" width={W} height={GL} fill={dk ? "url(#sky-grad-dk)" : "url(#sky-grad)"} />
        <rect x="0" y={GL} width={W} height={H - GL} fill={p("pat-earth", "pat-earth-dk")} />
        <line x1="0" y1={GL} x2={W} y2={GL} stroke={dk ? "#556677" : "#8a7a6a"} strokeWidth="2.5" />
        <rect x="0" y={GL - 5} width={W} height="7" fill={p("pat-grass", "pat-grass-dk")} opacity="0.6" />

        {/* ====== TERRITORY ====== */}
        <g {...zoneProps("territory")}>
          <rect x="55" y={GL - 84} width={W - 110} height="84" fill="none"
            stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1.5" strokeDasharray="12 6"
            opacity={hovered === "territory" ? 0.9 : 0.4}
          />
          {Array.from({ length: 13 }, (_, i) => 55 + i * 72).map((x) => (
            <line key={`fp-${x}`} x1={x} y1={GL - 84} x2={x} y2={GL - 76} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="2" opacity="0.5" />
          ))}
          <line x1="100" y1={GL - 68} x2="22" y2={GL - 96} stroke={lc} strokeWidth="1" />
          <FramedLabel x={4} y={GL - 80} text="Территория" text2="строительства" dk={dk} id="territory" hovered={hovered} />
        </g>

        {/* ====== FACADE ====== */}
        <g {...zoneProps("facade")}>
          <rect x={BX} y={BY} width={BW} height={BH} fill={p("pat-brick", "pat-brick-dk")} stroke={dk ? "#667788" : "#6a5a4a"} strokeWidth="2" />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => {
              const wx = BX + 18 + col * 65, wy = BY + 18 + row * 52;
              return (
                <g key={`w-${row}-${col}`}>
                  <rect x={wx} y={wy} width="44" height="32" rx="2" fill={dk ? "#2a4060" : "#c8ddf0"} stroke={dk ? "#5a7a9a" : "#7a9aba"} strokeWidth="1.2" />
                  <line x1={wx + 22} y1={wy} x2={wx + 22} y2={wy + 32} stroke={dk ? "#4a6a8a" : "#9ab8d4"} strokeWidth="0.8" />
                  <line x1={wx} y1={wy + 16} x2={wx + 44} y2={wy + 16} stroke={dk ? "#4a6a8a" : "#9ab8d4"} strokeWidth="0.8" />
                </g>
              );
            }),
          )}
          <rect x={BX + 78} y={BY + BH - 50} width="54" height="50" rx="3" fill={dk ? "#2a3848" : "#5a4a3a"} stroke={dk ? "#4a6070" : "#4a3a2a"} strokeWidth="1.5" />
          <circle cx={BX + 122} cy={BY + BH - 22} r="3" fill={dk ? "#8ab0d0" : "#c8a868"} />
          {/* Label upper-left */}
          <line x1={BX + 10} y1={BY + 30} x2={BX - 46} y2={BY - 6} stroke={lc} strokeWidth="1" />
          <FramedLabel x={BX - 48} y={BY - 8} text="Фасад" anchor="end" dk={dk} id="facade" hovered={hovered} />
        </g>

        {/* ====== FRAME ====== */}
        <g {...zoneProps("frame")}>
          <rect x={FX} y={FY} width={FW} height={FH} fill={dk ? "#1a2a3a" : "#eef3f8"} stroke={dk ? "#4a6070" : "#5a7a9a"} strokeWidth="2" />
          {[0, 1, 2, 3, 4].map((i) => {
            const sy = FY + i * (FH / 4);
            return <rect key={`sl-${i}`} x={FX} y={sy - 4} width={FW} height="8" fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />;
          })}
          {[0, 1, 2].map((i) => {
            const cx = FX + 14 + i * ((FW - 28) / 2);
            return <rect key={`cl-${i}`} x={cx - 5} y={FY} width="10" height={FH} fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />;
          })}
          <line x1={FX + 10} y1={FY + 8} x2={FX + 52} y2={FY + FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />
          <line x1={FX + 52} y1={FY + 8} x2={FX + 10} y2={FY + FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />
          <line x1={FX + 63} y1={FY + FH / 2 + 8} x2={FX + FW - 10} y2={FY + 3 * FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />
          <line x1={FX + FW - 10} y1={FY + FH / 2 + 8} x2={FX + 63} y2={FY + 3 * FH / 4 - 8} stroke={dk ? "#d08a40" : "#c07030"} strokeWidth="1.5" opacity="0.5" />
          {/* Label upper-right */}
          <line x1={FX + FW - 12} y1={FY + 30} x2={FX + FW + 36} y2={BY - 6} stroke={lc} strokeWidth="1" />
          <FramedLabel x={FX + FW + 40} y={BY - 8} text="Каркас" dk={dk} id="frame" hovered={hovered} />
        </g>

        {/* ====== ROOF ====== */}
        <g {...zoneProps("roof")}>
          <polygon
            points={`${RoofLeft},${BY} ${(RoofLeft + RoofRight) / 2},${RoofPeak} ${RoofRight},${BY}`}
            fill={dk ? "url(#roof-grad-dk)" : "url(#roof-grad)"}
            stroke={dk ? "#4a6a88" : "#2c4a68"} strokeWidth="2" strokeLinejoin="round"
          />
          <line x1={RoofLeft} y1={BY} x2={RoofRight} y2={BY} stroke={dk ? "#5a7a98" : "#3c5a78"} strokeWidth="3" />
          {[0.3, 0.5, 0.7].map((t) => {
            const ly = RoofPeak + (BY - RoofPeak) * t;
            const mid = (RoofLeft + RoofRight) / 2;
            return <line key={`rt-${t}`} x1={RoofLeft + (mid - RoofLeft) * (1 - t) + 10} y1={ly} x2={RoofRight - (RoofRight - mid) * (1 - t) - 10} y2={ly} stroke={dk ? "#4a6888" : "#4a6888"} strokeWidth="0.6" opacity="0.4" />;
          })}
          {/* Label top-right */}
          <line x1={RoofRight - 40} y1={RoofPeak + 10} x2={RoofRight + 30} y2={18} stroke={lc} strokeWidth="1" />
          <FramedLabel x={RoofRight + 34} y={22} text="Кровля" dk={dk} id="roof" hovered={hovered} />
        </g>

        {/* ====== EARTHWORK — sand pile on surface ====== */}
        <g {...zoneProps("earthwork")}>
          <path
            d={`M${PileX - PileW / 2} ${GL}
                Q${PileX - PileW / 2 + 10} ${GL - PileH * 0.6} ${PileX - PileW / 4} ${GL - PileH * 0.85}
                Q${PileX} ${GL - PileH - 4} ${PileX + PileW / 4} ${GL - PileH * 0.8}
                Q${PileX + PileW / 2 - 10} ${GL - PileH * 0.5} ${PileX + PileW / 2} ${GL}
                Z`}
            fill={p("pat-pile", "pat-pile-dk")}
            stroke={dk ? "#5a5040" : "#8a7a60"} strokeWidth="1.5" strokeLinejoin="round"
          />
          {/* Layer lines */}
          <path d={`M${PileX - PileW / 2 + 12} ${GL - PileH * 0.3}Q${PileX} ${GL - PileH * 0.4} ${PileX + PileW / 2 - 12} ${GL - PileH * 0.25}`}
            fill="none" stroke={dk ? "#6a6050" : "#a09070"} strokeWidth="0.8" opacity="0.5" />
          <path d={`M${PileX - PileW / 2 + 20} ${GL - PileH * 0.55}Q${PileX} ${GL - PileH * 0.65} ${PileX + PileW / 2 - 20} ${GL - PileH * 0.5}`}
            fill="none" stroke={dk ? "#6a6050" : "#a09070"} strokeWidth="0.8" opacity="0.5" />
          {/* Label left */}
          <line x1={PileX - 20} y1={GL - PileH - 2} x2={PileX - 50} y2={GL - PileH - 36} stroke={lc} strokeWidth="1" />
          <FramedLabel x={4} y={GL - PileH - 20} text="Объёмы" text2="земляных масс" dk={dk} id="earthwork" hovered={hovered} />
        </g>

        {/* ====== LANDSCAPING ====== */}
        <g {...zoneProps("landscaping")}>
          <rect x={LandX} y={GL - 5} width="185" height="7" fill={p("pat-grass", "pat-grass-dk")} />
          {/* Tree */}
          <rect x={LandX + 68} y={GL - 64} width="10" height="60" rx="3" fill={dk ? "#5a4a30" : "#8a7050"} />
          <ellipse cx={LandX + 73} cy={GL - 82} rx="32" ry="26" fill={dk ? "#2a5a28" : "#6ab060"} opacity="0.7" />
          <ellipse cx={LandX + 62} cy={GL - 92} rx="22" ry="18" fill={dk ? "#2d6a2a" : "#78c068"} opacity="0.65" />
          <ellipse cx={LandX + 86} cy={GL - 87} rx="20" ry="16" fill={dk ? "#256025" : "#68b858"} opacity="0.6" />
          <ellipse cx={LandX + 73} cy={GL - 104} rx="16" ry="13" fill={dk ? "#308030" : "#80c878"} opacity="0.55" />
          {/* Bush */}
          <ellipse cx={LandX + 146} cy={GL - 10} rx="16" ry="10" fill={dk ? "#2a5a28" : "#6ab060"} opacity="0.6" />
          <ellipse cx={LandX + 138} cy={GL - 14} rx="11" ry="8" fill={dk ? "#308030" : "#78c068"} opacity="0.5" />
          {/* Path */}
          <path d={`M${LandX} ${GL - 2}Q${LandX + 50} ${GL - 6} ${LandX + 100} ${GL - 2}Q${LandX + 140} ${GL + 2} ${LandX + 185} ${GL - 2}`}
            fill="none" stroke={dk ? "#6a7a8a" : "#b0a898"} strokeWidth="3" opacity="0.5" strokeLinecap="round" />
          {/* Label right */}
          <line x1={LandX + 135} y1={GL - 46} x2={LandX + 175} y2={GL - 70} stroke={lc} strokeWidth="1" />
          <FramedLabel x={LandX + 179} y={GL - 52} text="Благоустройство" dk={dk} id="landscaping" hovered={hovered} />
        </g>

        {/* ====== FOUNDATION ====== */}
        <g {...zoneProps("foundation")}>
          <rect x={PitLeft} y={GL} width={PitRight - PitLeft} height={FoundH}
            fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="1.5" />
          {/* Label right */}
          <line x1={PitRight - 20} y1={GL + FoundH / 2} x2={PitRight + 36} y2={GL + FoundH / 2 + 14} stroke={lc} strokeWidth="1" />
          <FramedLabel x={PitRight + 40} y={GL + FoundH / 2 + 18} text="Основание" dk={dk} id="foundation" hovered={hovered} />
        </g>

        {/* ====== PIT (котлован + ограждение) ====== */}
        <g {...zoneProps("pit")}>
          {/* Sheet pile walls */}
          <rect x={PitLeft} y={GL + FoundH} width="12" height={PitH} fill={p("pat-sheet", "pat-sheet-dk")} stroke={dk ? "#5a7a90" : "#5a7a9a"} strokeWidth="1" />
          <rect x={PitRight - 12} y={GL + FoundH} width="12" height={PitH} fill={p("pat-sheet", "pat-sheet-dk")} stroke={dk ? "#5a7a90" : "#5a7a9a"} strokeWidth="1" />
          {/* Pit interior */}
          <rect x={PitLeft + 12} y={GL + FoundH} width={PitRight - PitLeft - 24} height={PitH}
            fill={dk ? "#1a2536" : "#e8e0d4"} stroke={dk ? "#4a5a6a" : "#a09888"} strokeWidth="1" />
          {/* Center line */}
          <line x1={PitLeft + 16} y1={GL + FoundH + PitH / 2} x2={PitRight - 16} y2={GL + FoundH + PitH / 2}
            stroke={dk ? "#4a5a6a" : "#b0a898"} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />
          {/* Label bottom-right */}
          <line x1={PitRight - 40} y1={GL + FoundH + PitH / 2} x2={PitRight + 36} y2={GL + FoundH + PitH / 2 + 16} stroke={lc} strokeWidth="1" />
          <FramedLabel x={PitRight + 40} y={GL + FoundH + PitH / 2 + 20} text="Ограждение" text2="котлована" dk={dk} id="pit" hovered={hovered} />
        </g>

        {/* ====== PILES (сваи) ====== */}
        <g {...zoneProps("piles")}>
          {/* Vertical piles below pit */}
          {Array.from({ length: 7 }, (_, i) => {
            const px = PitLeft + 30 + i * ((PitRight - PitLeft - 60) / 6);
            const pileTop = GL + FoundH + PitH;
            const pileLen = 70 + (i % 2) * 10;
            return (
              <g key={`pile-${i}`}>
                <rect x={px - 4} y={pileTop} width="8" height={pileLen} fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="1" />
                {/* Pile tip */}
                <polygon points={`${px - 4},${pileTop + pileLen} ${px},${pileTop + pileLen + 8} ${px + 4},${pileTop + pileLen}`} fill={dk ? "#3b4a5c" : "#b0bcc8"} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />
              </g>
            );
          })}
          {/* Label right */}
          <line x1={PitRight - 50} y1={GL + FoundH + PitH + 35} x2={PitRight + 36} y2={GL + FoundH + PitH + 50} stroke={lc} strokeWidth="1" />
          <FramedLabel x={PitRight + 40} y={GL + FoundH + PitH + 54} text="Сваи" dk={dk} id="piles" hovered={hovered} />
        </g>
      </svg>
    </div>
  );
}
