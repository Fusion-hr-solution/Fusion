// Types
export type {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
  AuthUser,
  AuthState,
  StoredAuth,
} from "./types";

// Auth service
export {
  login,
  register,
  refreshToken,
  logout,
  persistAuth,
  loadAuth,
  clearAuth,
} from "./auth-service";

// Auth context & hook
export { AuthProvider, useAuth } from "./auth-context";
export type { AuthContextValue } from "./auth-context";
export {
  PLATFORM_ADMIN_ROLE,
  HR_ADMIN_ROLE,
  MANAGER_ROLE,
  EMPLOYEE_ROLE,
  hasAnyRole,
  canAccessPlatform,
  hasCorePermission,
  canViewTenantAdministration,
  canManageTenantAdministration,
  hasAnyCorePermission,
  canAccessCoreSetup,
  canAccessCoreSettings,
  canManageCoreSettings,
  canSeeCoreSetupNavigation,
  canSeeCoreSettingsNavigation,
  canAccessCorePeople,
  canManageCoreEmployees,
  canImportCoreEmployees,
  canManageCoreReporting,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  canSeeCorePeopleNavigation,
  canSeeOwnCoreProfileNavigation,
  canSeeCoreTeamNavigation,
  canAccessCoreOrgChart,
  canSeeCoreOrgChartNavigation,
  canViewCoreOrganization,
  canManageCoreOrganization,
  canAccessCoreOverview,
  canAccessCoreAccess,
  canManageCoreAccess,
  canSeeCoreAccessNavigation,
  canViewCoreAccessProfiles,
  canManageCoreAccessProfiles,
} from "./roles";
export {
  resolveCustomerWorkspaceAccessState,
  hasModuleEntitlement,
  CUSTOMER_MODULES,
} from "./customer-workspace-access";
export type { CustomerModule } from "./customer-workspace-access";
export type { CustomerWorkspaceAccessState } from "./customer-workspace-access";
export {
  getTrustedShellOrigin,
  sanitizeInternalReturnPath,
  resolveDefaultProductDestination,
  resolvePostSignInDestination,
} from "./routing";

// Components
export {
  SidebarUserPanel,
  getSidebarAccountLabel,
} from "./components/sidebar-user-panel";
export { SignInPage } from "./components/signin-page";
export type { SignInPageProps } from "./components/signin-page";
export { SignUpPage } from "./components/signup-page";
export type { SignUpPageProps } from "./components/signup-page";
