/**
 * Platform administration UI for the Fusion Core app (organizations, invites, shell).
 * Self-contained under `modules/platform-admin` for clearer boundaries and optional future extraction.
 *
 * Data: Identity `api/identity/platform-admin/organizations` + anonymous invite validate/accept.
 */
export type { Organization, OrganizationLifecycle } from "./types/organization";
export {
  OrganizationsProvider,
  useOrganizations,
} from "./context/organizations-context";
export { MOCK_ORGANIZATIONS } from "./data/mock-organizations";
