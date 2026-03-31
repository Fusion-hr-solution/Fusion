# feat(ui): Add ModuleLayout, TopLoader, extract EY theme, reorganize primitives

## Summary

Centralizes shared UI infrastructure in `@repo/ui` to eliminate duplication across module apps and ensure visual consistency.

## Changes

### New Components
- **`TopLoader`** — Wraps `nextjs-toploader` with a fixed config (`color="#2d2d2d"`, `height=3`, `showSpinner=false`). Single source of truth — changing it here updates all modules.
- **`ModuleLayout`** — Shared inner layout wrapper that includes `<TopLoader />` + the sidebar/main flex container. Module apps pass their sidebar as a prop instead of duplicating the layout structure.

### EY Brand Theme (`ey-brand.css`)
Expanded from ~30 lines to the full EY design system:
- **Palette variables** — added `--ey-blue-*`, `--ey-teal-500`, `--ey-green-500`, `--ey-orange-500`, `--ey-red-500`
- **shadcn token remapping** — `--primary`, `--background`, `--accent`, `--destructive`, etc. now map to EY brand values
- **Keyframe animations** — `ey-fade-up`, `ey-fade-in`, `ey-scale-in`, `ey-slide-right`, `ey-shimmer`, `ey-pulse-subtle`, `ey-stripe-slide`, `ey-count-pop`
- **Utility classes** — category badges (`.ey-cat-*`), chips (`.ey-chip-*`), strips (`.ey-strip-*`), level dots, animation helpers, staggered grid/list entrance, shimmer skeleton, hero pattern

### Structure Reorganization
Moved all shadcn-generated components into `primitives/` subfolder:

```
components/
├── primitives/          ← shadcn (auto-generated, don't hand-edit)
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── progress.tsx
│   ├── separator.tsx
│   └── tooltip.tsx
├── sidebar/             ← custom
├── module-layout.tsx    ← custom (new)
└── top-loader.tsx       ← custom (new)
```

### Exports (`index.ts`)
Grouped into labeled sections:
- `// ── shadcn primitives` — all primitive re-exports
- `// ── Custom EY components` — sidebar, TopLoader, ModuleLayout
- `// ── Utilities` — `cn`

**No downstream import changes needed** — all apps import from `@repo/ui` barrel export, so the internal restructure is transparent.

## New Dependency
- `nextjs-toploader@^3.9.17` added to `@repo/ui`

## How Module Apps Will Use This (in follow-up PRs)

```tsx
// Before (duplicated in every module)
import NextTopLoader from "nextjs-toploader";
// ...
<NextTopLoader color="#2d2d2d" height={3} showSpinner={false} />
<div className="flex h-screen overflow-hidden">
  <ModuleSidebar />
  <main className="flex-1 overflow-y-auto">{children}</main>
</div>

// After
import { ModuleLayout } from "@repo/ui";
// ...
<ModuleLayout sidebar={<ModuleSidebar />}>
  {children}
</ModuleLayout>
```

## Testing
- `pnpm --filter @repo/ui lint` ✅
- `pnpm --filter @repo/ui type-check` ✅
- `pnpm --filter shell type-check` ✅ (downstream verification)
- Pre-commit hook `turbo lint` across all 12 packages ✅
