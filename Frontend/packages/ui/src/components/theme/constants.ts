/** Theme primitives shared by the provider and the pre-paint script. */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** localStorage key holding the user's explicit theme choice. */
export const THEME_STORAGE_KEY = "ey-theme";
