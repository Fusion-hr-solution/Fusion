export const dynamic = "force-dynamic";

// Canonical tenant-foundation orientation, served at `/getting-started` through
// the shell. Legacy `/setup` redirects here; the launchpad reads canonical
// Organization readiness and renders the truthful tenant-state.
export { default } from "@/features/tenant-setup/setup-launchpad";
