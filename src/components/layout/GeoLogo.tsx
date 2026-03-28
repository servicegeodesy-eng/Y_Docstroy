import { isGeoMode } from "@/lib/geoMode";
import { DocStroyLogo } from "./Sidebar";

export function AppLogo({ size = 32, iconOnly = false }: { size?: number; iconOnly?: boolean }) {
  if (!isGeoMode()) {
    return <DocStroyLogo size={size} iconOnly={iconOnly} />;
  }
  return <GeoServiceLogo size={size} iconOnly={iconOnly} />;
}

function GeoServiceLogo({ size = 32, iconOnly = false }: { size?: number; iconOnly?: boolean }) {
  const s = iconOnly ? size : size * 1.6;

  return (
    <div className="relative shrink-0" style={{ width: s, height: s }}>
      <svg
        width={s}
        height={s}
        viewBox="0 0 80 80"
        fill="none"
        className="shrink-0"
        role="img"
        aria-label="Логотип Службы Геодезии"
      >
        <defs>
          {/* ── ГРАДИЕНТЫ ── */}
          {/* С — основной тёмно-синий объём */}
          <linearGradient id="gs1" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#3B6A9C" />
            <stop offset="50%" stopColor="var(--ds-accent, #1E3A5F)" />
            <stop offset="100%" stopColor="#0E2440" />
          </linearGradient>
          {/* С — блик верхнего ребра */}
          <linearGradient id="gs-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5A9ED6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#5A9ED6" stopOpacity="0" />
          </linearGradient>
          {/* Г — оранжевый объём */}
          <linearGradient id="gg1" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#FFD19A" />
            <stop offset="40%" stopColor="var(--ds-brand-orange, #F97316)" />
            <stop offset="100%" stopColor="#C25A00" />
          </linearGradient>
          {/* Корпус прибора */}
          <linearGradient id="gb" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#4A7FAF" />
            <stop offset="40%" stopColor="var(--ds-accent, #1E3A5F)" />
            <stop offset="100%" stopColor="#0C1E35" />
          </linearGradient>
          {/* Линза — радиальный */}
          <radialGradient id="gl" cx="0.38" cy="0.32" r="0.55">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#EBF2FA" />
            <stop offset="85%" stopColor="#C8D8E8" />
            <stop offset="100%" stopColor="#94ACC4" />
          </radialGradient>
          {/* Блик линзы */}
          <radialGradient id="gl-hi" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {/* Бленда */}
          <radialGradient id="gb-lens" cx="0.5" cy="0.45" r="0.55">
            <stop offset="0%" stopColor="#1A3050" />
            <stop offset="100%" stopColor="#080F1A" />
          </radialGradient>
          {/* Трегер */}
          <linearGradient id="gt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A4A6B" />
            <stop offset="100%" stopColor="#0C1E35" />
          </linearGradient>
          {/* Площадка */}
          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD19A" />
            <stop offset="50%" stopColor="var(--ds-brand-orange, #F97316)" />
            <stop offset="100%" stopColor="#C25A00" />
          </linearGradient>
          {/* Ножки */}
          <linearGradient id="gn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ds-brand-orange, #F97316)" />
            <stop offset="100%" stopColor="#A04D00" />
          </linearGradient>

          {/* ── ФИЛЬТРЫ ── */}
          <filter id="f-drop" x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2.5" floodColor="#050D18" floodOpacity="0.45" />
          </filter>
          <filter id="f-inner" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5" />
          </filter>
          <filter id="f-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="f-letter" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0.8" dy="1.5" stdDeviation="1.5" floodColor="#050D18" floodOpacity="0.35" />
          </filter>
          {/* Скос/фаска для букв */}
          <filter id="f-bevel" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
            <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.6" specularExponent="20" result="spec">
              <fePointLight x="-20" y="-20" z="40" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="specOut" />
            </feMerge>
          </filter>
        </defs>

        {/* ══════ БУКВА «С» — объёмная, единый path ══════ */}
        <g filter="url(#f-letter)">
          <path
            d="M54 15 L54 20 A14 14 0 0 0 40 6 L20 6 A14 14 0 0 0 6 20 L6 62 A14 14 0 0 0 20 76 L40 76 A14 14 0 0 0 54 62 L54 58"
            stroke="url(#gs1)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          {/* Верхний блик */}
          <path
            d="M53 16 L53 20 A13 13 0 0 0 40 7 L20 7 A13 13 0 0 0 7 20 L7 35"
            stroke="url(#gs-hi)" strokeWidth="1.5" strokeLinecap="round" fill="none"
          />
        </g>

        {/* ══════ БУКВА «Г» — объёмная ══════ */}
        <g filter="url(#f-letter)">
          <path
            d="M44 17 L44 20 A4 4 0 0 0 40 16 L20 16 A4 4 0 0 0 16 20 L16 58"
            stroke="url(#gg1)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          {/* Блик */}
          <path
            d="M43 18 L43 20 A3 3 0 0 0 40 17 L20 17 A3 3 0 0 0 17 20 L17 35"
            stroke="#FFD19A" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"
          />
        </g>

        {/* ══════ ТАХЕОМЕТР ══════ */}
        <g filter="url(#f-drop)">
          {/* Корпус */}
          <rect x="21" y="23" width="18" height="26" rx="4" fill="url(#gb)" />
          {/* Фаска верхнего края */}
          <rect x="22" y="23" width="16" height="2.5" rx="1.5" fill="#4A7FAF" opacity="0.5" />
          {/* Фаска левого края */}
          <rect x="21" y="24" width="1.5" height="24" rx="0.75" fill="#4A7FAF" opacity="0.2" />

          {/* Бленда */}
          <g filter="url(#f-inner)">
            <circle cx="30" cy="36" r="9" fill="url(#gb-lens)" />
          </g>
          {/* Оправа — металлическое кольцо */}
          <circle cx="30" cy="36" r="8" stroke="#3A5570" strokeWidth="1" fill="none" />
          {/* Линза */}
          <circle cx="30" cy="36" r="7" fill="url(#gl)" />
          {/* Кольца оправы */}
          <circle cx="30" cy="36" r="6" stroke="#94ACC4" strokeWidth="0.6" fill="none" />
          <circle cx="30" cy="36" r="4" stroke="var(--ds-accent, #1E3A5F)" strokeWidth="1" fill="none" />
          <circle cx="30" cy="36" r="2" stroke="#94ACC4" strokeWidth="0.4" fill="none" opacity="0.5" />
          {/* Блик на линзе — большой */}
          <g filter="url(#f-glow)">
            <ellipse cx="27" cy="33" rx="2.5" ry="1.8" fill="url(#gl-hi)" opacity="0.8" />
          </g>
          {/* Маленький блик */}
          <circle cx="33" cy="39" r="0.8" fill="white" opacity="0.35" />
        </g>

        {/* Трегер */}
        <rect x="19" y="50" width="22" height="4.5" rx="2" fill="url(#gt)" />
        <rect x="19" y="50" width="22" height="1.5" rx="1" fill="#4A7FAF" opacity="0.3" />

        {/* ══════ ШТАТИВ — единая конструкция, масштаб 0.8 от центра верха ══════ */}
        <g transform="translate(30, 56) scale(0.8) translate(-30, -56)" filter="url(#f-letter)">
          {/* Тело — основной градиент */}
          <path
            d="M17 56 L43 56 L43 62 L49 74 L43 74 L38 62 L32 62 L32 75 L28 75 L28 62 L25 62 L19 74 L11 74 L17 62 Z"
            fill="url(#gp)"
          />
          {/* Обводка только площадки */}
          <rect x="17" y="56" width="26" height="6" rx="0" stroke="var(--ds-accent, #1E3A5F)" strokeWidth="0.8" fill="none" />
          {/* Тёмная грань — правый край */}
          <path
            d="M43 56 L43 62 L49 74 L46 74 L41 62 L32 62 L32 75 L31 75 L31 62 L43 62 L43 56"
            fill="#A04D00"
            opacity="0.3"
          />
          {/* Блик — верхний край площадки */}
          <rect x="17" y="56" width="26" height="2" rx="1" fill="#FFD19A" opacity="0.55" />
          {/* Блик — левый край площадки */}
          <rect x="17" y="56" width="1.5" height="6" rx="0.75" fill="#FFD19A" opacity="0.25" />
          {/* Блик на левой ножке */}
          <line x1="20.5" y1="62" x2="15" y2="71" stroke="#FFD19A" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
          {/* Блик на центральной ножке */}
          <line x1="28.5" y1="62" x2="28.5" y2="73" stroke="#FFD19A" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
          {/* Блик на правой ножке */}
          <line x1="43" y1="62" x2="47" y2="72" stroke="#FFD19A" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
        </g>
      </svg>

      {/* ══════ ТЕКСТ ══════ */}
      {!iconOnly && (
        <div
          className="absolute flex flex-col"
          style={{
            left: "60%",
            top: "48%",
            transform: "translateY(-50%)",
            lineHeight: 1.0,
            gap: s * 0.005,
            textAlign: "left",
          }}
        >
          <span
            style={{
              fontFamily: "'Nunito', 'Inter', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: s * 0.2,
              letterSpacing: "0.05em",
              color: "var(--ds-accent)",
              textTransform: "uppercase" as const,
              textShadow: "1px 2px 3px rgba(5,13,24,0.35), 0 0 2px rgba(30,58,95,0.2), -0.5px -0.5px 0 rgba(90,158,214,0.15)",
            }}
          >Служба</span>
          <span
            style={{
              fontFamily: "'Nunito', 'Inter', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: s * 0.2,
              letterSpacing: "0.05em",
              color: "var(--ds-brand-orange)",
              textTransform: "uppercase" as const,
              textShadow: "1px 2px 3px rgba(5,13,24,0.35), 0 0 2px rgba(249,115,22,0.25), -0.5px -0.5px 0 rgba(255,209,154,0.2)",
            }}
          >Геодезии</span>
        </div>
      )}
    </div>
  );
}
