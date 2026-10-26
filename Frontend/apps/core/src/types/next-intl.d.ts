import type { DsMessages } from "@repo/ds/i18n";
import type { AuthMessages } from "@repo/auth/i18n";
import type { CoreMessages } from "../i18n/messages";

// Message keys are type-checked against the English catalogues: Core HR's, @repo/ds's and @repo/auth's.
declare module "next-intl" {
  interface AppConfig {
    Messages: CoreMessages & DsMessages & AuthMessages;
  }
}
