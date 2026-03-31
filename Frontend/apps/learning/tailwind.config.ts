import type { Config } from "tailwindcss";
import sharedConfig from "@repo/ui/tailwind.config";

const config: Config = {
  presets: [sharedConfig as Partial<Config>],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/auth/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ey: {
          grey: {
            50: "hsl(var(--ey-grey-50))",
            100: "hsl(var(--ey-grey-100))",
            200: "hsl(var(--ey-grey-200))",
            300: "hsl(var(--ey-grey-300))",
            400: "hsl(var(--ey-grey-400))",
            500: "hsl(var(--ey-grey-500))",
          },
          yellow: "hsl(var(--ey-yellow))",
          black: "hsl(var(--ey-black))",
          blue: {
            400: "hsl(var(--ey-blue-400))",
            500: "hsl(var(--ey-blue-500))",
            600: "hsl(var(--ey-blue-600))",
          },
          green: {
            500: "hsl(var(--ey-green-500))",
          },
          red: {
            500: "hsl(var(--ey-red-500))",
          },
          orange: {
            500: "hsl(var(--ey-orange-500))",
          },
          teal: {
            500: "hsl(var(--ey-teal-500))",
          },
        },
      },
    },
  },
};

export default config;
