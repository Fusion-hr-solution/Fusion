export const SETUP_SUMMARY_PATH = "/setup";
export const SETUP_DRAFT_ENTRY_PATH = "/setup/draft-structure";

export type SetupEntryRouteAction = "allow" | "redirect-to-setup-summary";

interface ResolveSetupEntryRouteActionArgs {
  currentPath: string;
  shouldCheckSetupAccess: boolean;
  isSetupLocked: boolean;
}

function isDraftStructurePath(currentPath: string) {
  return (
    currentPath === SETUP_DRAFT_ENTRY_PATH ||
    currentPath.startsWith(`${SETUP_DRAFT_ENTRY_PATH}/`)
  );
}

function isSetupSummaryPath(currentPath: string) {
  return currentPath === SETUP_SUMMARY_PATH;
}

export function isSetupAreaPath(currentPath: string) {
  return isSetupSummaryPath(currentPath) || isDraftStructurePath(currentPath);
}

export function resolveSetupEntryRouteAction({
  currentPath,
  shouldCheckSetupAccess,
  isSetupLocked,
}: ResolveSetupEntryRouteActionArgs): SetupEntryRouteAction {
  if (!shouldCheckSetupAccess || !isSetupLocked) {
    return "allow";
  }

  if (isSetupAreaPath(currentPath)) {
    return "allow";
  }

  return "redirect-to-setup-summary";
}

export function shouldAutoActivateSetup(
  canStartSetup: boolean | null | undefined
) {
  return !!canStartSetup;
}
