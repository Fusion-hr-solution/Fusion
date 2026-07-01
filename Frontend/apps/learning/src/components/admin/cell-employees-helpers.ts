export function progressBarColor(pct: number) {
  if (pct >= 80) return "bg-[hsl(var(--ey-green-500))]";
  if (pct >= 40) return "bg-[hsl(var(--ey-orange-500))]";
  return "bg-[hsl(var(--ey-red-500))]";
}

export function avatarColor(name: string): string {
  const colors: string[] = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-cyan-500",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx] ?? "bg-blue-500";
}

export function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
