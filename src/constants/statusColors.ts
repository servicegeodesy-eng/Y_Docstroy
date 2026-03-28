import type { CSSProperties } from "react";
import { getColorPreset } from "./colorPalette";

/**
 * Стиль бейджа статуса с gradient-заполнением по прогрессу.
 * @param colorKey — ключ цвета из палитры (например "blue", "green")
 * @param progress — процент выполнения (0–100) или null
 *
 * Если progress == null — обычный статический фон.
 * Если progress задан — gradient: цветная часть = progress%, остальное — светлее.
 * Если progress < 100 — красный контур (border).
 */
export function getStatusStyle(colorKey: string, progress: number | null): CSSProperties {
  const preset = getColorPreset(colorKey);
  if (progress == null) {
    return { background: preset.bg, color: preset.text };
  }
  const p = Math.max(0, Math.min(100, progress));
  const style: CSSProperties = {
    background: `linear-gradient(to right, ${preset.bg} ${p}%, ${preset.bgLight} ${p}%)`,
    color: preset.text,
  };
  if (p < 100) {
    style.border = "1.5px solid #ef4444";
  }
  return style;
}

/** Tailwind-классы для бейджа по ключу цвета */
export function getStatusBadgeClass(colorKey: string): string {
  return getColorPreset(colorKey).badgeClass;
}

/** Tailwind-класс фона по ключу цвета */
export function getStatusBgClass(colorKey: string): string {
  return getColorPreset(colorKey).bgClass;
}
