/**
 * The public activation surface's vocabulary and rules, kept out of the
 * component so they can be tested without rendering and so every state has one
 * definition rather than a string written twice.
 */

export type ActivationEntryState =
  | "account_creation"
  | "invalid"
  | "expired"
  | "revoked"
  | "superseded"
  | "already_accepted"
  | "existing_account";

export interface PasswordRequirements {
  minimumLength: number;
  requiresDigit: boolean;
  requiresLowercase: boolean;
  requiresUppercase: boolean;
  requiresSymbol: boolean;
}

export interface ActivationEntry {
  state: ActivationEntryState;
  tenantName: string | null;
  invitedEmail: string | null;
  expiresAt: string | null;
  passwordRequirements: PasswordRequirements | null;
}

export interface ActivationFieldError {
  field: string;
  message: string;
}

/** Every way the page can stop, including the three the entry state cannot reach. */
export type ActivationOutcome =
  | ActivationEntryState
  | "session_unavailable"
  /**
   * The service revalidates under a lock, so an invitation revoked, replaced or
   * expired between rendering the form and submitting it refuses here rather
   * than at entry. It is terminal: treating it as a retryable failure told the
   * recipient to try again at a link that will never work again.
   */
  | "not_activatable"
  | "unavailable";

export interface TerminalState {
  title: string;
  detail: string;
  /** The one real recovery, when one exists. */
  action?: { label: string; href: string };
}

/**
 * What each stopping point says.
 *
 * Every one of these states the recipient can do nothing about alone, so each
 * says what happened, whether an account or access was created, and who to go
 * to. None of them names a service, a status code or an identifier.
 */
export function terminalState(outcome: ActivationOutcome): TerminalState {
  switch (outcome) {
    case "expired":
      return {
        title: "This invitation has expired",
        detail:
          "No account was created. Ask the organization that invited you to send a new invitation.",
      };

    case "revoked":
      return {
        title: "This invitation was cancelled",
        detail:
          "No account was created. Ask the organization that invited you to send a new invitation.",
      };

    case "superseded":
      return {
        title: "This invitation was replaced",
        detail:
          "A newer invitation was sent. Open the most recent message, or ask the organization that invited you to send it again.",
      };

    case "already_accepted":
      return {
        title: "This invitation has already been used",
        detail: "The administrator account for this organization already exists.",
        action: { label: "Sign in", href: "/auth/signin" },
      };

    case "existing_account":
      return {
        title: "An account already exists for this address",
        detail:
          "This invitation creates a new administrator account, so it cannot use an address that is already registered. Ask the organization that invited you to send the invitation to a different address.",
      };

    case "session_unavailable":
      return {
        // Activation committed. Saying anything that implies otherwise would
        // send the recipient back to repeat work that already succeeded.
        title: "Your administrator account was created",
        detail: "Sign in to continue.",
        action: { label: "Sign in", href: "/auth/signin" },
      };

    default:
      return {
        title: "This invitation link does not work",
        detail:
          "No account was created. Ask the organization that invited you to send a new invitation.",
      };
  }
}

export interface PasswordCheck {
  label: string;
  satisfied: boolean;
}

/**
 * The requirements as checkable state rather than a sentence, so the recipient
 * can see which one is outstanding while typing instead of after submitting.
 */
export function passwordChecks(
  password: string,
  requirements: PasswordRequirements | null
): PasswordCheck[] {
  if (!requirements) return [];

  const checks: PasswordCheck[] = [
    {
      label: `${requirements.minimumLength} characters or more`,
      satisfied: password.length >= requirements.minimumLength,
    },
  ];

  if (requirements.requiresUppercase) {
    checks.push({ label: "An uppercase letter", satisfied: /[A-Z]/.test(password) });
  }
  if (requirements.requiresLowercase) {
    checks.push({ label: "A lowercase letter", satisfied: /[a-z]/.test(password) });
  }
  if (requirements.requiresDigit) {
    checks.push({ label: "A number", satisfied: /[0-9]/.test(password) });
  }
  if (requirements.requiresSymbol) {
    checks.push({
      label: "A symbol",
      satisfied: /[^a-zA-Z0-9]/.test(password),
    });
  }

  return checks;
}

export interface ActivationForm {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

/**
 * Client-side checks only where the client is the authority. The password policy
 * itself is the service's, which is why only the confirmation mismatch and empty
 * fields are decided here — anything stricter would be a second policy free to
 * disagree with the one that actually applies.
 */
export function validateForm(
  form: ActivationForm,
  requirements: PasswordRequirements | null
): ActivationFieldError[] {
  const errors: ActivationFieldError[] = [];

  if (!form.firstName.trim()) {
    errors.push({ field: "firstName", message: "Enter your first name." });
  }
  if (!form.lastName.trim()) {
    errors.push({ field: "lastName", message: "Enter your last name." });
  }
  if (!form.password) {
    errors.push({ field: "password", message: "Choose a password." });
  } else if (passwordChecks(form.password, requirements).some((check) => !check.satisfied)) {
    errors.push({ field: "password", message: "This password does not meet the requirements." });
  }
  if (form.password && form.confirmPassword !== form.password) {
    errors.push({ field: "confirmPassword", message: "This does not match the password above." });
  }

  return errors;
}

export function errorFor(
  errors: ActivationFieldError[],
  field: string
): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}

/**
 * The tenant's initials, as an identity aid beside its name.
 *
 * Two letters from the first and last significant word, one when there is only
 * one word. Purely presentational: it never stands in for the tenant name, which
 * is always shown in full next to it.
 */
export function monogramFor(tenantName: string | null): string {
  const words = (tenantName ?? "")
    .split(/[\s\-_/]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

/**
 * The expiry as a date the recipient can act on. Falls back to nothing rather
 * than to an invented value.
 */
export function formatExpiry(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

/**
 * Removes the credential from the address bar once it has been read.
 *
 * The raw credential is reusable until the invitation is accepted, and it would
 * otherwise sit in browser history, in a screen share, and in anything the
 * recipient copies out of the address bar.
 */
export function scrubbedUrl(href: string): string | null {
  try {
    const url = new URL(href);
    if (!url.searchParams.has("credential")) return null;
    url.searchParams.delete("credential");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
