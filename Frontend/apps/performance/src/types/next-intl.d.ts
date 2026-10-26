import type { DsMessages } from "@repo/ds/i18n";
import type { AuthMessages } from "@repo/auth/i18n";
import type { PerformanceUiMessages } from "@repo/performance-ui/i18n";
import type { PerformanceMessages } from "../i18n/messages";

// Message keys are type-checked against the English catalogues: Performance's, @repo/ds's, @repo/auth's and @repo/performance-ui's.
declare module "next-intl" {
  interface AppConfig {
    Messages: PerformanceMessages & DsMessages & AuthMessages & PerformanceUiMessages;
  }
}
