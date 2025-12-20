/**
 * Predefined color palette for the application
 * 12 colors carefully selected for a modern and elegant interface
 */
export const COLOR_PALETTE = [
  { name: "Dottxt Purple", value: "#A98BFF" }, // Default color
  
  { name: "Notus Pink", value: "#DD05C7" },
  { name: "Yanotela Red", value: "#882626" },
  { name: "Light Red", value: "#FF0000" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#10b981" },
  { name: "Emerald", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Teal", value: "#0891b2" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Dark Blue", value: "#1e40af" },
  
] as const;

export const DEFAULT_COLOR = COLOR_PALETTE[0].value; // Default purple

export type ColorPaletteItem = (typeof COLOR_PALETTE)[number];

