import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Radius roles (tokens.css) must merge like built-in radii, so `rounded-control rounded-full` resolves
// to one corner instead of keeping both classes (which also left squircle shape on circles).
const RADIUS_ROLES = ["detail", "control", "control-sm", "surface", "menu", "inset", "nested"];

const twMerge = extendTailwindMerge({ extend: { theme: { radius: RADIUS_ROLES } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
