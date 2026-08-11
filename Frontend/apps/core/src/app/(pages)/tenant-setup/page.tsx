export const dynamic = "force-dynamic";

// Served at the tenant-level `/setup` through the shell rewrite until Change 3
// owns readiness routing. `/core/setup` is now only a compatibility handoff to
// the permanent Organization workspace.
export { default } from "@/features/tenant-setup/setup-launchpad";
