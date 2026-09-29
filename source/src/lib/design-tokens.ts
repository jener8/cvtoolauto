/** JS mirror of CSS tokens — use for inline styles or charts only; prefer CSS variables in UI. */
export const designTokens = {
  brand: {
    DEFAULT: "#2d7a5f",
    dark: "#164238",
    strong: "#1b5e4a",
    light: "#3d9a7a",
    bg: "#edf7f1",
    text: "#1a2e28",
  },
  crystal: {
    teal: "#14b8a6",
    blue: "#0e7c86",
  },
  surface: {
    page: "#f7f3ec",
    card: "#ffffff",
    muted: "#faf6f0",
    ivory: "#fffdf9",
  },
  text: {
    primary: "#1a2e28",
    muted: "#3d534d",
    subtle: "#5a6e68",
  },
  border: {
    DEFAULT: "#e8e2d6",
    accent: "#cfe8db",
    strong: "#d9d0c4",
  },
  semantic: {
    success: "#1b6b52",
    info: "#0e7490",
    warning: "#9a6700",
    error: "#a84838",
    focus: "#0d9488",
  },
  sectionIcons: {
    careerBrain: "#2d7a5f",
    progress: "#0f9a8a",
    qualifications: "#b45309",
    applications: "#6d28d9",
    interview: "#b4533c",
    resources: "#2563eb",
    settings: "#5a6e68",
  },
  radius: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "18px",
  },
  shadow: {
    sm: "0 1px 3px rgba(26, 46, 40, 0.06)",
    md: "0 4px 20px rgba(26, 46, 40, 0.08)",
    glow: "0 0 0 1px rgba(20, 184, 166, 0.18), 0 8px 24px rgba(27, 94, 74, 0.14)",
  },
} as const

export type DesignTokens = typeof designTokens
