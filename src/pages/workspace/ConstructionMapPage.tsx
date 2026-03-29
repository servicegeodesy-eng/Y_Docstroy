import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Zone { id: string; label: string; path: string }

const ZONES: Zone[] = [
  { id: "roof",        label: "Кровля",                  path: "plan" },
  { id: "facade",      label: "Фасад",                   path: "facades" },
  { id: "frame",       label: "Каркас",                   path: "chessboard" },
  { id: "walls",       label: "Стены",                    path: "chessboard" },
  { id: "floors",      label: "Полы и потолки",            path: "plan" },
  { id: "territory",   label: "Территория строительства", path: "plan" },
  { id: "landscaping", label: "Благоустройство",          path: "landscaping" },
  { id: "earthwork",   label: "Объёмы земляных масс",     path: "plan" },
  { id: "foundation",  label: "Основание",                path: "plan" },
  { id: "pit",         label: "Ограждение котлована",      path: "plan" },
  { id: "piles",       label: "Сваи",                     path: "plan" },
];

function FramedLabel({ x, y, text, text2, anchor = "start", dk, id, hovered, lineFromX, lineFromY }: {
  x: number; y: number; text: string; text2?: string;
  anchor?: "start" | "middle" | "end";
  dk: boolean; id: string; hovered: string | null;
  lineFromX?: number; lineFromY?: number;
}) {
  const isH = hovered === id;
  const lH = 16, padX = 8, padY = 5, charW = 7.2;
  const lines = text2 ? [text, text2] : [text];
  const maxL = Math.max(...lines.map(l => l.length));
  const bW = maxL * charW + padX * 2, bH = lines.length * lH + padY * 2;
  const bx = anchor === "end" ? x - bW : anchor === "middle" ? x - bW / 2 : x;
  const by = y;
  let lx = bx + bW / 2, ly = by + bH / 2;
  if (lineFromX !== undefined && lineFromY !== undefined) {
    const cx = bx + bW / 2, cy = by + bH / 2;
    const dx = lineFromX - cx, dy = lineFromY - cy;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      const s = Math.min(dx !== 0 ? (bW / 2) / Math.abs(dx) : 999, dy !== 0 ? (bH / 2) / Math.abs(dy) : 999);
      lx = cx + dx * s; ly = cy + dy * s;
    }
  }
  const lc = dk ? "#5a6a7a" : "#8a9aaa";
  return (
    <>
      {lineFromX !== undefined && lineFromY !== undefined && (
        <line x1={lineFromX} y1={lineFromY} x2={lx} y2={ly} stroke={isH ? (dk ? "#7aaad0" : "#1E3A5F") : lc} strokeWidth="1" style={{ pointerEvents: "none" }} />
      )}
      <rect x={bx} y={by} width={bW} height={bH} rx="4"
        fill={dk ? "rgba(26,37,54,0.92)" : "rgba(255,255,255,0.92)"}
        stroke={isH ? (dk ? "#7aaad0" : "#1E3A5F") : (dk ? "#4a5a6a" : "#b0bcc8")}
        strokeWidth={isH ? 1.5 : 1} style={{ cursor: "pointer" }}
      />
      {lines.map((l, i) => (
        <text key={i} x={bx + padX} y={by + padY + (i + 1) * lH - 3} fontSize="12" fontWeight="600" fill={dk ? "#7aaad0" : "#1E3A5F"} style={{ pointerEvents: "none" }}>{l}</text>
      ))}
    </>
  );
}

function SvgDefs() {
  return (
    <defs>
      <pattern id="pat-concrete" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#dce3ec" /><path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="#b8c4d4" strokeWidth="0.5" />
      </pattern>
      <pattern id="pat-concrete-dk" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#3b4a5c" /><path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="#4e6072" strokeWidth="0.5" />
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
        <rect width="12" height="12" fill="#c9b99a" /><circle cx="3" cy="4" r="1.2" fill="#b5a487" /><circle cx="9" cy="9" r="0.9" fill="#b5a487" /><circle cx="7" cy="2" r="0.6" fill="#bfae94" />
      </pattern>
      <pattern id="pat-earth-dk" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#4a4030" /><circle cx="3" cy="4" r="1.2" fill="#5a5040" /><circle cx="9" cy="9" r="0.9" fill="#5a5040" /><circle cx="7" cy="2" r="0.6" fill="#554838" />
      </pattern>
      <pattern id="pat-pile" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#b8a888" /><circle cx="4" cy="4" r="2" fill="#a89878" /><circle cx="11" cy="10" r="1.5" fill="#a89878" /><circle cx="2" cy="11" r="1" fill="#c0b090" /><circle cx="10" cy="3" r="1.2" fill="#c0b090" />
      </pattern>
      <pattern id="pat-pile-dk" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#3e3828" /><circle cx="4" cy="4" r="2" fill="#4e4838" /><circle cx="11" cy="10" r="1.5" fill="#4e4838" /><circle cx="2" cy="11" r="1" fill="#544e3e" /><circle cx="10" cy="3" r="1.2" fill="#544e3e" />
      </pattern>
      <pattern id="pat-grass" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#a8d5a0" />
        <path d="M2 10Q2 6 3 4" fill="none" stroke="#7cb874" strokeWidth="0.7" /><path d="M6 10Q6.5 5 5 3" fill="none" stroke="#7cb874" strokeWidth="0.7" />
        <path d="M10 10Q10 7 11 5" fill="none" stroke="#7cb874" strokeWidth="0.7" /><path d="M14 10Q13.5 6 14.5 4" fill="none" stroke="#7cb874" strokeWidth="0.7" />
      </pattern>
      <pattern id="pat-grass-dk" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#2d4a28" />
        <path d="M2 10Q2 6 3 4" fill="none" stroke="#3d6a38" strokeWidth="0.7" /><path d="M6 10Q6.5 5 5 3" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
        <path d="M10 10Q10 7 11 5" fill="none" stroke="#3d6a38" strokeWidth="0.7" /><path d="M14 10Q13.5 6 14.5 4" fill="none" stroke="#3d6a38" strokeWidth="0.7" />
      </pattern>
      <pattern id="pat-sheet" width="4" height="10" patternUnits="userSpaceOnUse">
        <rect width="4" height="10" fill="#8a9bb0" /><line x1="0" y1="0" x2="0" y2="10" stroke="#7088a0" strokeWidth="0.8" /><line x1="2" y1="0" x2="2" y2="10" stroke="#96a8bc" strokeWidth="0.4" />
      </pattern>
      <pattern id="pat-sheet-dk" width="4" height="10" patternUnits="userSpaceOnUse">
        <rect width="4" height="10" fill="#3a4858" /><line x1="0" y1="0" x2="0" y2="10" stroke="#2a3848" strokeWidth="0.8" /><line x1="2" y1="0" x2="2" y2="10" stroke="#4a5868" strokeWidth="0.4" />
      </pattern>
      <filter id="glow" x="-8%" y="-8%" width="116%" height="116%">
        <feGaussianBlur stdDeviation="3" result="blur" /><feFlood floodColor="#5B8DB8" floodOpacity="0.35" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="shadow" /><feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8f0fe" /><stop offset="100%" stopColor="#f0f4f8" /></linearGradient>
      <linearGradient id="sky-grad-dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1a2536" /><stop offset="100%" stopColor="#1e293b" /></linearGradient>
      <linearGradient id="roof-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5a7a9a" /><stop offset="100%" stopColor="#3d5a78" /></linearGradient>
      <linearGradient id="roof-grad-dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3a5a7a" /><stop offset="100%" stopColor="#2a4562" /></linearGradient>
    </defs>
  );
}

export default function ConstructionMapPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);
  const go = useCallback((path: string) => navigate(`/projects/${projectId}/${path}`), [navigate, projectId]);
  const handleClick = (id: string) => { const z = ZONES.find(z => z.id === id); if (z) go(z.path); };
  const zoneProps = (id: string) => ({
    style: { cursor: "pointer", transition: "opacity 0.3s, filter 0.3s", opacity: hovered && hovered !== id ? 0.35 : 1, filter: hovered === id ? "url(#glow)" : "none" } as React.CSSProperties,
    onMouseEnter: () => setHovered(id), onMouseLeave: () => setHovered(null),
    onClick: () => handleClick(id), role: "button" as const, tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(id); } },
  });
  const dk = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const p = (l: string, d: string) => `url(#${dk ? d : l})`;

  /* ---- MIRRORED Layout: Frame LEFT, Facade RIGHT ---- */
  const GL = 300;
  const FW = 115, BW = 210;
  // Frame on LEFT, then Facade on RIGHT
  const FX = 250, FY = 80; // frame starts here
  const BX = FX + FW;       // facade starts right of frame = 365
  const BY = 80, BH = GL - BY, FH = BH;
  const RoofPeak = 38, RoofLeft = FX - 22, RoofRight = BX + BW + 22;
  const SheetW = 14;
  const ShoringLeft = FX - 16, ShoringRight = BX + BW + 16;
  const ShoringTop = GL + 6, FoundH = 22, PitH = 28;
  const PitBottom = ShoringTop + FoundH + PitH;
  const ShoringBottom = PitBottom + 40;
  const PitTop = ShoringTop + FoundH;
  const PileLen = 130;
  // Landscaping — LEFT side, close to frame
  const LandW = 120;
  const LandX = FX - 14 - LandW; // = 250-14-120 = 116
  // Earthwork — RIGHT side, close to facade
  const PileW = 100, PileH = 44;
  const PileX = BX + BW + 16 + PileW / 2; // = 575+16+50 = 641

  // ViewBox
  const VT = 12, VB = PitTop + PileLen + 24;
  const VL = LandX - 140; // room for left labels
  const VR = PileX + PileW / 2 + 140; // room for right labels

  // Territory fence
  const FenceLeft = VL + 20, FenceRight = VR - 20;

  // Frame grid
  const frameCols = [0, 1, 2].map(i => FX + 14 + i * ((FW - 28) / 2));
  const frameRows = [0, 1, 2, 3, 4].map(i => FY + i * (FH / 4));

  // LEFT column labels (above ground): Кровля, Фасад, Каркас, Стены
  const lcX = VL + 4;
  const aboveY = { roof: VT + 6, facade: VT + 34, floors: VT + 62, walls: VT + 90, frame: VT + 118 };

  // LEFT column labels (below ground): Основание, Ограждение, Сваи — SAME position
  const belowY = { foundation: GL + 10, pit: GL + 46, piles: GL + 92 };

  // RIGHT labels: Объёмы земляных масс
  const rcX = VR - 6;

  return (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden select-none"
      style={{ background: "var(--ds-surface-sunken)" }}>
      <svg viewBox={`${VL} ${VT} ${VR - VL} ${VB - VT}`} className="w-full h-full"
        preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"
        fontFamily="'Inter','Segoe UI',system-ui,sans-serif">
        <SvgDefs />

        {/* BG */}
        <rect x={VL} y={VT} width={VR - VL} height={GL - VT} fill={dk ? "url(#sky-grad-dk)" : "url(#sky-grad)"} />
        <rect x={VL} y={GL} width={VR - VL} height={VB - GL} fill={p("pat-earth", "pat-earth-dk")} />
        <line x1={VL} y1={GL} x2={VR} y2={GL} stroke={dk ? "#556677" : "#8a7a6a"} strokeWidth="2.5" />
        <rect x={VL} y={GL - 5} width={VR - VL} height="7" fill={p("pat-grass", "pat-grass-dk")} opacity="0.6" />

        {/* TERRITORY — отдельно, справа у пунктирной рамки */}
        <g {...zoneProps("territory")}>
          <rect x={FenceLeft} y={GL - 76} width={FenceRight - FenceLeft} height="76" fill="none"
            stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="1.5" strokeDasharray="12 6"
            opacity={hovered === "territory" ? 0.9 : 0.4} />
          {Array.from({ length: 9 }, (_, i) => FenceLeft + i * ((FenceRight - FenceLeft) / 8)).map(x => (
            <line key={`fp-${x}`} x1={x} y1={GL - 76} x2={x} y2={GL - 68} stroke={dk ? "#7aaad0" : "#2c5a8a"} strokeWidth="2" opacity="0.5" />
          ))}
          <FramedLabel x={FenceRight - 6} y={GL - 74} text="Территория" text2="строительства" anchor="end" dk={dk} id="territory" hovered={hovered} />
        </g>

        {/* LANDSCAPING — LEFT side */}
        <g {...zoneProps("landscaping")}>
          <rect x={LandX} y={GL-5} width={LandW} height="7" fill={p("pat-grass", "pat-grass-dk")} />
          <rect x={LandX+46} y={GL-56} width="8" height="52" rx="3" fill={dk ? "#5a4a30" : "#8a7050"} />
          <ellipse cx={LandX+50} cy={GL-72} rx="26" ry="22" fill={dk ? "#2a5a28" : "#6ab060"} opacity="0.7" />
          <ellipse cx={LandX+40} cy={GL-80} rx="18" ry="15" fill={dk ? "#2d6a2a" : "#78c068"} opacity="0.65" />
          <ellipse cx={LandX+60} cy={GL-76} rx="16" ry="14" fill={dk ? "#256025" : "#68b858"} opacity="0.6" />
          <ellipse cx={LandX+50} cy={GL-90} rx="14" ry="11" fill={dk ? "#308030" : "#80c878"} opacity="0.55" />
          <ellipse cx={LandX+100} cy={GL-10} rx="14" ry="9" fill={dk ? "#2a5a28" : "#6ab060"} opacity="0.6" />
          <ellipse cx={LandX+94} cy={GL-14} rx="10" ry="7" fill={dk ? "#308030" : "#78c068"} opacity="0.5" />
          <path d={`M${LandX} ${GL-2}Q${LandX+40} ${GL-5} ${LandX+80} ${GL-2}Q${LandX+100} ${GL+1} ${LandX+LandW} ${GL-2}`}
            fill="none" stroke={dk ? "#6a7a8a" : "#b0a898"} strokeWidth="2.5" opacity="0.5" strokeLinecap="round" />
          <FramedLabel x={lcX} y={GL - 56} text="Благоустройство" dk={dk} id="landscaping" hovered={hovered}
            lineFromX={LandX + 50} lineFromY={GL - 30} />
        </g>

        {/* FRAME — LEFT side of building */}
        <g {...zoneProps("frame")}>
          <rect x={FX} y={FY} width={FW} height={FH} fill={dk ? "#1a2a3a" : "#eef3f8"} stroke={dk ? "#4a6070" : "#5a7a9a"} strokeWidth="2" />
          {frameRows.map((sy, i) => (
            <rect key={`sl-${i}`} x={FX} y={sy - 4} width={FW} height="8" fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />
          ))}
          {frameCols.map((cx, i) => (
            <rect key={`cl-${i}`} x={cx - 5} y={FY} width="10" height={FH} fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />
          ))}
          <FramedLabel x={lcX} y={aboveY.frame} text="Каркас" dk={dk} id="frame" hovered={hovered}
            lineFromX={FX + 10} lineFromY={FY + FH * 0.8} />
        </g>

        {/* FLOORS — strips above and below floor slabs in frame */}
        <g {...zoneProps("floors")}>
          {frameRows.map((sy, i) => (
            <g key={`floor-${i}`}>
              {/* Strip above slab — skip on top slab (i=0) */}
              {i > 0 && <rect x={FX + 2} y={sy - 9} width={FW - 4} height="5" fill={dk ? "#4a6070" : "#b8c8d8"} opacity="0.6" rx="1" />}
              {/* Strip below slab */}
              <rect x={FX + 2} y={sy + 4} width={FW - 4} height="5" fill={dk ? "#4a5a68" : "#c8d4e0"} opacity="0.5" rx="1" />
            </g>
          ))}
          <FramedLabel x={lcX} y={aboveY.floors} text="Полы и потолки" dk={dk} id="floors" hovered={hovered}
            lineFromX={FX + FW * 0.5} lineFromY={frameRows[1] + 5} />
        </g>

        {/* WALLS — brick infill in frame */}
        <g {...zoneProps("walls")}>
          {[0,1,2,3].map(row => [0,1].map(col => {
            const cx1 = frameCols[col] + 6, cx2 = frameCols[col + 1] - 6;
            const ry1 = frameRows[row] + 5, ry2 = frameRows[row + 1] - 5;
            return (
              <rect key={`wall-${row}-${col}`} x={cx1} y={ry1} width={cx2 - cx1} height={ry2 - ry1}
                fill={p("pat-brick", "pat-brick-dk")} stroke={dk ? "#5a5045" : "#b0a090"} strokeWidth="0.6" rx="1" />
            );
          }))}
          <FramedLabel x={lcX} y={aboveY.walls} text="Стены" dk={dk} id="walls" hovered={hovered}
            lineFromX={FX + FW * 0.6} lineFromY={FY + FH * 0.45} />
        </g>

        {/* FACADE — RIGHT side of building */}
        <g {...zoneProps("facade")}>
          <rect x={BX} y={BY} width={BW} height={BH} fill={p("pat-brick", "pat-brick-dk")} stroke={dk ? "#667788" : "#6a5a4a"} strokeWidth="2" />
          {[0,1,2,3].map(row => [0,1,2].map(col => {
            const wx = BX + 18 + col * 65, wy = BY + 18 + row * 46;
            return (<g key={`w-${row}-${col}`}>
              <rect x={wx} y={wy} width="44" height="30" rx="2" fill={dk ? "#2a4060" : "#c8ddf0"} stroke={dk ? "#5a7a9a" : "#7a9aba"} strokeWidth="1.2" />
              <line x1={wx+22} y1={wy} x2={wx+22} y2={wy+30} stroke={dk ? "#4a6a8a" : "#9ab8d4"} strokeWidth="0.8" />
              <line x1={wx} y1={wy+15} x2={wx+44} y2={wy+15} stroke={dk ? "#4a6a8a" : "#9ab8d4"} strokeWidth="0.8" />
            </g>);
          }))}
          <rect x={BX+78} y={BY+BH-48} width="54" height="48" rx="3" fill={dk ? "#2a3848" : "#5a4a3a"} stroke={dk ? "#4a6070" : "#4a3a2a"} strokeWidth="1.5" />
          <circle cx={BX+122} cy={BY+BH-22} r="3" fill={dk ? "#8ab0d0" : "#c8a868"} />
          <FramedLabel x={lcX} y={aboveY.facade} text="Фасад" dk={dk} id="facade" hovered={hovered}
            lineFromX={BX + BW / 2} lineFromY={BY + 10} />
        </g>

        {/* ROOF */}
        <g {...zoneProps("roof")}>
          <polygon points={`${RoofLeft},${BY} ${(RoofLeft+RoofRight)/2},${RoofPeak} ${RoofRight},${BY}`}
            fill={dk ? "url(#roof-grad-dk)" : "url(#roof-grad)"} stroke={dk ? "#4a6a88" : "#2c4a68"} strokeWidth="2" strokeLinejoin="round" />
          <line x1={RoofLeft} y1={BY} x2={RoofRight} y2={BY} stroke={dk ? "#5a7a98" : "#3c5a78"} strokeWidth="3" />
          {[0.3,0.5,0.7].map(t => {
            const ly = RoofPeak + (BY - RoofPeak) * t, mid = (RoofLeft + RoofRight) / 2;
            return <line key={`rt-${t}`} x1={RoofLeft+(mid-RoofLeft)*(1-t)+10} y1={ly} x2={RoofRight-(RoofRight-mid)*(1-t)-10} y2={ly} stroke={dk ? "#4a6888" : "#4a6888"} strokeWidth="0.6" opacity="0.4" />;
          })}
          <FramedLabel x={lcX} y={aboveY.roof} text="Кровля" dk={dk} id="roof" hovered={hovered}
            lineFromX={RoofRight - 60} lineFromY={RoofPeak + (BY - RoofPeak) * 0.15} />
        </g>

        {/* EARTHWORK — RIGHT side */}
        <g {...zoneProps("earthwork")}>
          <path d={`M${PileX-PileW/2} ${GL} Q${PileX-PileW/2+8} ${GL-PileH*0.6} ${PileX-PileW/4} ${GL-PileH*0.85} Q${PileX} ${GL-PileH-4} ${PileX+PileW/4} ${GL-PileH*0.8} Q${PileX+PileW/2-8} ${GL-PileH*0.5} ${PileX+PileW/2} ${GL}Z`}
            fill={p("pat-pile", "pat-pile-dk")} stroke={dk ? "#5a5040" : "#8a7a60"} strokeWidth="1.5" strokeLinejoin="round" />
          <path d={`M${PileX-PileW/2+10} ${GL-PileH*0.3}Q${PileX} ${GL-PileH*0.4} ${PileX+PileW/2-10} ${GL-PileH*0.25}`} fill="none" stroke={dk ? "#6a6050" : "#a09070"} strokeWidth="0.8" opacity="0.5" />
          <FramedLabel x={rcX} y={GL + 10} text="Объёмы" text2="земляных масс" anchor="end" dk={dk} id="earthwork" hovered={hovered}
            lineFromX={PileX + PileW / 4} lineFromY={GL - PileH / 2} />
        </g>

        {/* SHORING — stays centered */}
        <g {...zoneProps("pit")}>
          <rect x={ShoringLeft} y={ShoringTop} width={SheetW} height={ShoringBottom - ShoringTop}
            fill={p("pat-sheet", "pat-sheet-dk")} stroke={dk ? "#5a7a90" : "#5a7a9a"} strokeWidth="1.5" />
          <rect x={ShoringRight-SheetW} y={ShoringTop} width={SheetW} height={ShoringBottom - ShoringTop}
            fill={p("pat-sheet", "pat-sheet-dk")} stroke={dk ? "#5a7a90" : "#5a7a9a"} strokeWidth="1.5" />
          <rect x={ShoringLeft+SheetW} y={PitTop} width={ShoringRight-ShoringLeft-SheetW*2} height={PitH}
            fill={dk ? "#141e2e" : "#e4dcd0"} stroke={dk ? "#3a4a5a" : "#a09888"} strokeWidth="0.5" />
          <FramedLabel x={lcX} y={belowY.pit} text="Ограждение" text2="котлована" dk={dk} id="pit" hovered={hovered}
            lineFromX={ShoringLeft + SheetW / 2} lineFromY={(ShoringTop + ShoringBottom) / 2} />
        </g>

        {/* FOUNDATION — stays centered */}
        <g {...zoneProps("foundation")}>
          <rect x={ShoringLeft+SheetW} y={ShoringTop} width={ShoringRight-ShoringLeft-SheetW*2} height={FoundH}
            fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="1.5" />
          <FramedLabel x={lcX} y={belowY.foundation} text="Основание" dk={dk} id="foundation" hovered={hovered}
            lineFromX={ShoringLeft + SheetW + 50} lineFromY={ShoringTop + FoundH / 2} />
        </g>

        {/* PILES — stays centered */}
        <g {...zoneProps("piles")}>
          {Array.from({ length: 7 }, (_, i) => {
            const px = ShoringLeft + SheetW + 20 + i * ((ShoringRight - ShoringLeft - SheetW * 2 - 40) / 6);
            const pTop = PitTop, pLen = PileLen + (i % 2) * 14;
            return (<g key={`pile-${i}`}>
              <rect x={px-4} y={pTop} width="8" height={pLen} fill={p("pat-concrete", "pat-concrete-dk")} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="1" />
              <polygon points={`${px-4},${pTop+pLen} ${px},${pTop+pLen+8} ${px+4},${pTop+pLen}`} fill={dk ? "#3b4a5c" : "#b0bcc8"} stroke={dk ? "#5a7a90" : "#7a8a9a"} strokeWidth="0.8" />
            </g>);
          })}
          <FramedLabel x={lcX} y={belowY.piles} text="Сваи" dk={dk} id="piles" hovered={hovered}
            lineFromX={ShoringLeft + SheetW + 24} lineFromY={PitTop + PileLen * 0.4} />
        </g>
      </svg>
    </div>
  );
}
