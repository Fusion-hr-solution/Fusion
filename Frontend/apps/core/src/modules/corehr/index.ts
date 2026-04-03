/**
 * CoreHR feature module — self-contained under `modules/corehr` for future
 * extraction into a separate package or micro-frontend.
 */
export type { Organization, OrganizationLifecycle } from "./types/organization";
export {
  OrganizationsProvider,
  useOrganizations,
} from "./context/organizations-context";
export { MOCK_ORGANIZATIONS } from "./data/mock-organizations";
