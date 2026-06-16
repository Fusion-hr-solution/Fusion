import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a money amount in the platform's single currency (TND). */
export function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(amount)} TND`;
}
