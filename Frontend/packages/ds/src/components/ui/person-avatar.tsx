import { cn } from "../../lib/utils"

export type PersonAvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "profile"

const SIZE: Record<PersonAvatarSize, string> = {
  xs: "size-6 text-[0.5625rem]",
  sm: "size-8 text-[0.6875rem]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
  xl: "size-16 text-xl",
  "2xl": "size-[5.5rem] text-[1.75rem]",
  profile: "size-[9.5rem] text-[2.75rem] font-medium",
}

/** Two letters from the display name, deterministic: first and last word. */
export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "—"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase()
}

/**
 * A person's mark: their photo when one is loaded, their initials otherwise. Decorative by default, since the
 * name always sits beside it; pass `label` where the avatar stands alone.
 * `photo` is a displayable address (an object URL for photos that load through the API client).
 */
function PersonAvatar({
  name,
  photo,
  size = "md",
  label,
  className,
}: {
  name: string
  photo?: string | null
  size?: PersonAvatarSize
  label?: string
  className?: string
}) {
  return (
    <span
      data-slot="person-avatar"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-semibold tracking-tight text-muted-foreground tabular-nums select-none",
        SIZE[size],
        className
      )}
    >
      {photo ? (
        <img src={photo} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        personInitials(name)
      )}
    </span>
  )
}

export { PersonAvatar }
