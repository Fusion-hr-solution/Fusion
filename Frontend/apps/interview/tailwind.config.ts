import type { Config } from "tailwindcss";
import sharedConfig from "@repo/ui/tailwind.config";

const config: Config = {
  presets: [sharedConfig as Partial<Config>],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
