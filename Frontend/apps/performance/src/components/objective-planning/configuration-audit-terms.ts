/**
 * Wording for the configuration change history.
 *
 * The stored action is an internal name; this maps it to what a person actually did. Unknown
 * actions degrade to a spaced-out form so a newly recorded action stays readable instead of
 * rendering as a code word.
 */
const ACTION_LABELS: Record<string, string> = {
  ObjectivePlanningConfigurationApplied: "Objective planning updated",
  PlatformPerformanceConfigurationApplied: "Platform limits updated",
  TenantObjectivePolicyCreated: "Objective policy created",
  TenantObjectivePolicyUpdated: "Objective policy updated",
  PlatformObjectiveBaselineUpdated: "Platform baseline updated",
  PlatformGuardrailsUpdated: "Platform guardrails updated",
};

export const configurationAuditTerms = {
  title: "Change history",
  loading: "Loading history…",
  failed: "Could not load the change history.",
  retry: "Try again",
  empty: "No configuration changes recorded yet.",
  count: (total: number) => `${total} ${total === 1 ? "change" : "changes"}`,
  by: (actor: string) => `by ${actor}`,
  /** No actor recorded: the platform did it, not a person. */
  bySystem: "automatically",
  /** Marks an entry that changed the platform for every tenant, not just this one. */
  platformScope: "Platform-wide",
  pageOf: (page: number, total: number) => `${page} / ${total}`,
  newer: "Newer",
  older: "Older",

  action: (action: string): string =>
    ACTION_LABELS[action] ?? action.replace(/([A-Z])/g, " $1").trim(),
} as const;
