import type { Config } from "tailwindcss";
import sharedConfig from "@repo/ui/tailwind.config";

/**
 * Stitch "Executive Console" tokens (CoreHR module). Prefixed with `ch` to avoid
 * clashing with shadcn semantic colors (`primary`, `surface`, etc.).
 */
const config: Config = {
  presets: [sharedConfig as Partial<Config>],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/auth/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        chHeadline: ["var(--font-ch-headline)", "Manrope", "system-ui", "sans-serif"],
        chBody: ["var(--font-ch-body)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        /** Stitch Executive Console radii (tighter than default Tailwind) */
        ch: "0.125rem",
        "ch-md": "0.25rem",
        "ch-lg": "0.5rem",
        "ch-xl": "0.75rem",
      },
      colors: {
        ch: {
          background: "#f9f9f9",
          surface: "#f9f9f9",
          "on-background": "#1a1c1c",
          "on-surface": "#1a1c1c",
          "on-surface-variant": "#4c4732",
          primary: "#6e5d00",
          "on-primary": "#ffffff",
          "primary-container": "#f9d61a",
          "primary-fixed": "#ffe25f",
          "primary-fixed-dim": "#e6c500",
          "on-primary-container": "#6d5d00",
          "on-primary-fixed": "#221b00",
          secondary: "#5f5e5e",
          "on-secondary": "#ffffff",
          "secondary-container": "#e4e2e1",
          "on-secondary-container": "#656464",
          tertiary: "#006972",
          "on-tertiary": "#ffffff",
          "tertiary-container": "#46ecff",
          "on-tertiary-container": "#006872",
          error: "#ba1a1a",
          "on-error": "#ffffff",
          "error-container": "#ffdad6",
          "on-error-container": "#93000a",
          outline: "#7e7760",
          "outline-variant": "#cfc6ab",
          "surface-variant": "#e2e2e2",
          "surface-dim": "#dadada",
          "surface-bright": "#f9f9f9",
          "surface-container": "#eeeeee",
          "surface-container-low": "#f3f3f3",
          "surface-container-lowest": "#ffffff",
          "surface-container-high": "#e8e8e8",
          "surface-container-highest": "#e2e2e2",
        },
      },
    },
  },
};

export default config;
