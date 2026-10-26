import type { DsMessages } from "@repo/ds/i18n";
import type { AuthMessages } from "@repo/auth/i18n";
import type messages from "../../messages/en.json";

// Message keys are type-checked against the English catalogues: the shell's, @repo/ds's and @repo/auth's.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages & DsMessages & AuthMessages;
  }
}
