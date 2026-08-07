export const dynamic = "force-dynamic";

// Served at the canonical tenant-level `/setup` through the shell rewrite. It
// lives under a distinct Core path so `/core/setup` stays the Core HR structure
// workspace it has always been.
export { default } from "@/features/tenant-setup/setup-launchpad";
