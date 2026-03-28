export interface ColorPreset {
  key: string;
  label: string;
  bg: string;
  bgLight: string;
  text: string;
  badgeClass: string;
  bgClass: string;
}

export const COLOR_PALETTE: ColorPreset[] = [
  { key: "blue",       label: "Синий",           bg: "#93c5fd", bgLight: "#dbeafe", text: "#1e3a8a", badgeClass: "bg-blue-300 text-blue-900",     bgClass: "bg-blue-300" },
  { key: "red",        label: "Красный",         bg: "#fca5a5", bgLight: "#fecaca", text: "#7f1d1d", badgeClass: "bg-red-300 text-red-900",       bgClass: "bg-red-300" },
  { key: "green",      label: "Зелёный",         bg: "#86efac", bgLight: "#bbf7d0", text: "#14532d", badgeClass: "bg-green-300 text-green-900",   bgClass: "bg-green-300" },
  { key: "yellow",     label: "Жёлтый",          bg: "#fde047", bgLight: "#fef9c3", text: "#713f12", badgeClass: "bg-yellow-300 text-yellow-900", bgClass: "bg-yellow-300" },
  { key: "yellow_muted", label: "Тусклый жёлтый", bg: "#e8d44d", bgLight: "#f5eeb3", text: "#5c4d0a", badgeClass: "bg-yellow-300 text-yellow-900", bgClass: "bg-yellow-300" },
  { key: "purple",     label: "Фиолетовый",      bg: "#c084fc", bgLight: "#e9d5ff", text: "#3b0764", badgeClass: "bg-purple-400 text-purple-950", bgClass: "bg-purple-400" },
  { key: "orange",     label: "Оранжевый",       bg: "#fdba74", bgLight: "#fed7aa", text: "#7c2d12", badgeClass: "bg-orange-300 text-orange-900", bgClass: "bg-orange-300" },
  { key: "teal",       label: "Бирюзовый",       bg: "#5eead4", bgLight: "#99f6e4", text: "#134e4a", badgeClass: "bg-teal-300 text-teal-900",     bgClass: "bg-teal-300" },
  { key: "amber",      label: "Янтарный",        bg: "#fbbf24", bgLight: "#fde68a", text: "#78350f", badgeClass: "bg-amber-400 text-amber-900",   bgClass: "bg-amber-400" },
  { key: "emerald",    label: "Изумрудный",      bg: "#6ee7b7", bgLight: "#a7f3d0", text: "#064e3b", badgeClass: "bg-emerald-300 text-emerald-900", bgClass: "bg-emerald-300" },
  { key: "pink",       label: "Розовый",         bg: "#f9a8d4", bgLight: "#fbcfe8", text: "#831843", badgeClass: "bg-pink-300 text-pink-900",     bgClass: "bg-pink-300" },
  { key: "cyan",       label: "Голубой",         bg: "#67e8f9", bgLight: "#a5f3fc", text: "#164e63", badgeClass: "bg-cyan-300 text-cyan-900",     bgClass: "bg-cyan-300" },
  { key: "indigo",     label: "Индиго",          bg: "#a5b4fc", bgLight: "#c7d2fe", text: "#1e1b4b", badgeClass: "bg-indigo-300 text-indigo-900", bgClass: "bg-indigo-300" },
  { key: "rose",       label: "Алый",            bg: "#fda4af", bgLight: "#fecdd3", text: "#881337", badgeClass: "bg-rose-300 text-rose-900",     bgClass: "bg-rose-300" },
  { key: "light_red",  label: "Светло-красный",  bg: "#fecaca", bgLight: "#fee2e2", text: "#991b1b", badgeClass: "bg-red-200 text-red-800",       bgClass: "bg-red-200" },
  { key: "pistachio",  label: "Фисташковый",     bg: "#c6e4a0", bgLight: "#e2f0d0", text: "#2d5016", badgeClass: "bg-lime-200 text-lime-800",     bgClass: "bg-lime-200" },
  { key: "light_gray", label: "Светло-серый",    bg: "#e5e7eb", bgLight: "#f3f4f6", text: "#374151", badgeClass: "bg-gray-200 text-gray-700",     bgClass: "bg-gray-200" },
  { key: "lime",       label: "Лаймовый",        bg: "#bef264", bgLight: "#d9f99d", text: "#365314", badgeClass: "bg-lime-300 text-lime-900",     bgClass: "bg-lime-300" },
  { key: "fuchsia",    label: "Фуксия",          bg: "#e879f9", bgLight: "#f0abfc", text: "#4a044e", badgeClass: "bg-fuchsia-400 text-fuchsia-950", bgClass: "bg-fuchsia-400" },
  { key: "sky",        label: "Небесный",        bg: "#7dd3fc", bgLight: "#bae6fd", text: "#0c4a6e", badgeClass: "bg-sky-300 text-sky-900",       bgClass: "bg-sky-300" },
  { key: "violet",     label: "Лиловый",         bg: "#c4b5fd", bgLight: "#ddd6fe", text: "#2e1065", badgeClass: "bg-violet-300 text-violet-900", bgClass: "bg-violet-300" },
  { key: "gray",       label: "Серый",           bg: "#d1d5db", bgLight: "#e5e7eb", text: "#1f2937", badgeClass: "bg-gray-300 text-gray-800",     bgClass: "bg-gray-300" },
];

const PALETTE_MAP = new Map(COLOR_PALETTE.map((c) => [c.key, c]));

export function getColorPreset(key: string): ColorPreset {
  return PALETTE_MAP.get(key) || COLOR_PALETTE[COLOR_PALETTE.length - 1]; // fallback → gray
}
