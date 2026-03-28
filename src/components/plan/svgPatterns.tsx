import { COLOR_PALETTE } from "@/constants/colorPalette";

/**
 * SVG <defs> с паттернами штриховки для каждого цвета статуса.
 * Использование: fill="url(#hatch-blue)" на полигоне.
 */
export default function StatusHatchPatterns() {
  return (
    <defs>
      {COLOR_PALETTE.map((preset) => (
        <pattern
          key={preset.key}
          id={`hatch-${preset.key}`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill={preset.bgLight} />
          <line x1="0" y1="0" x2="0" y2="8" stroke={preset.bg} strokeWidth="4" />
        </pattern>
      ))}
    </defs>
  );
}
