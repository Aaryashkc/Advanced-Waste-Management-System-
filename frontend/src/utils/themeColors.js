const FALLBACK_COLORS = {
  primary: "#354f52",
  primaryHover: "#2d4a4e",
  primaryDark: "#315b5f",
  primaryDeep: "#2f3e46",
  surface: "#f5f1e8",
  surfaceWarm: "#f5f3ee",
  surfaceSoft: "#f7f5ef",
  ink: "#202128",
  inkStrong: "#1f2e30",
  inkMuted: "#4a5568",
  success: "#10b981",
  successStrong: "#22c55e",
  info: "#3b82f6",
  sky: "#0ea5e9",
  indigo: "#6366f1",
  warning: "#f59e0b",
  orange: "#f97316",
  danger: "#ef4444",
  dangerStrong: "#dc2626",
  violet: "#8b5cf6",
  purple: "#a855f7",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  pink: "#ec4899",
  lime: "#84cc16",
  greenSoft: "#4ade80",
  yellow: "#eab308",
  muted: "#9ca3af",
  chartText: "#2d3748",
  chartMuted: "#4a5568",
  chartDarkText: "#dfe9e6",
  chartDarkMuted: "#b6c3bf",
  chartGrid: "#e2e8f0",
  white: "#ffffff",
  black: "#000000",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
};

const TOKEN_NAMES = {
  primary: "--app-primary",
  primaryHover: "--app-primary-hover",
  primaryDark: "--app-primary-dark",
  primaryDeep: "--app-primary-deep",
  surface: "--app-surface",
  surfaceWarm: "--app-surface-warm",
  surfaceSoft: "--app-surface-soft",
  ink: "--app-ink",
  inkStrong: "--app-ink-strong",
  inkMuted: "--app-ink-muted",
  success: "--app-success",
  successStrong: "--app-success-strong",
  info: "--app-info",
  sky: "--app-sky",
  indigo: "--app-indigo",
  warning: "--app-warning",
  orange: "--app-orange",
  danger: "--app-danger",
  dangerStrong: "--app-danger-strong",
  violet: "--app-violet",
  purple: "--app-purple",
  cyan: "--app-cyan",
  teal: "--app-teal",
  pink: "--app-pink",
  lime: "--app-lime",
  greenSoft: "--app-green-soft",
  yellow: "--app-yellow",
  muted: "--app-muted",
  chartText: "--app-chart-text",
  chartMuted: "--app-chart-muted",
  chartDarkText: "--app-chart-dark-text",
  chartDarkMuted: "--app-chart-dark-muted",
  chartGrid: "--app-chart-grid",
  white: "--app-white",
  black: "--app-black",
  gray50: "--app-gray-50",
  gray100: "--app-gray-100",
  gray200: "--app-gray-200",
  gray300: "--app-gray-300",
  gray400: "--app-gray-400",
  gray500: "--app-gray-500",
  gray600: "--app-gray-600",
  gray700: "--app-gray-700",
  gray800: "--app-gray-800",
  gray900: "--app-gray-900",
  slate50: "--app-slate-50",
  slate100: "--app-slate-100",
  slate200: "--app-slate-200",
  slate300: "--app-slate-300",
  slate400: "--app-slate-400",
  slate500: "--app-slate-500",
  slate600: "--app-slate-600",
  slate700: "--app-slate-700",
  slate800: "--app-slate-800",
  slate900: "--app-slate-900",
};

function cssToken(name) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function themeColor(name) {
  return cssToken(TOKEN_NAMES[name]) || FALLBACK_COLORS[name] || FALLBACK_COLORS.primary;
}

export function alpha(hexColor, opacity) {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return hexColor;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function appPalette() {
  return Object.fromEntries(Object.keys(TOKEN_NAMES).map((name) => [name, themeColor(name)]));
}
