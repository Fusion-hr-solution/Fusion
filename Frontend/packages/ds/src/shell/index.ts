// @repo/ds/shell — shared Platform, Core, and Performance product shell
// (sidebar, app frame, and page-layout kit).

export { ModuleSidebar } from "./module-sidebar";
export { FUSION_MODULES, filterModulesByEntitlement } from "./modules";
export { ShellUserPanel } from "./shell-user-panel";
export type {
  ShellUserPanelProps,
  ShellUserPanelLink,
} from "./shell-user-panel";
export { AppShell } from "./app-shell";
export type { AppShellProps } from "./app-shell";
export { ThemeProvider, ThemeToggle } from "./theme";
export { LanguageSwitcher } from "./language-switcher";
export { TopBar } from "./top-bar";
export type { TopBarProps } from "./top-bar";
export { AppBreadcrumb } from "./app-breadcrumb";
export type { AppBreadcrumbProps } from "./app-breadcrumb";
export { PageContainer, PageHeader, PageToolbar } from "./page";
export type {
  PageContainerProps,
  PageHeaderProps,
  PageToolbarProps,
} from "./page";
export { TableFilterToolbar } from "./table-filter-toolbar";
export {
  PageEmpty,
  PageError,
  PageListSkeleton,
  PageLoading,
  PagePermissionNotice,
  PageSkeleton,
} from "./page-states";
export type {
  PageErrorProps,
  PageListSkeletonProps,
  PageLoadingProps,
  PageSkeletonProps,
} from "./page-states";
export {
  InvitationTransactionFrame,
  InvitationTransactionLoading,
  InvitationTransactionTerminalFrame,
  InvitationWordmark,
} from "./invitation-transaction";
export { AsyncButton } from "./async-button";
export { StatusBadge } from "./status-badge";
export type { StatusBadgeProps, StatusTone } from "./status-badge";
export {
  KpiStat,
  KpiGrid,
  DashboardSection,
  DashboardPanel,
} from "./dashboard";
export type { KpiStatProps, DashboardSectionProps } from "./dashboard";
export {
  DonutChart,
  BarChartMini,
  ColumnChart,
  ProgressMeter,
  CHART_PALETTE,
  CHART_TONES,
} from "./charts";
export type { DonutDatum } from "./charts";
export type {
  ShellNavItem,
  ShellNavSection,
  ShellModule,
  ModuleSidebarProps,
} from "./types";
