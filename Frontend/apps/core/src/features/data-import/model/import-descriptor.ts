/**
 * Shared vocabulary for the Import on-ramp — the single surface both the Organization
 * (structure) and Workforce (people) imports land on. Each domain supplies one static
 * descriptor; the surface itself is domain-agnostic and presentational. This is what lets
 * two flows that always did the same job — pick an as-of date, bring in an XLSX/CSV,
 * resolve sheet/header clarifications, resume unfinished work — finally share one UI.
 */

export type ImportDateMeaning = "today" | "scheduled" | "past";

export type ImportDateConfig = {
  /** Business meaning of the date, e.g. "Effective date" / "Workforce as of". */
  label: string;
  /** Stable input id (deep-integration + tests depend on it). */
  inputId: string;
  /** Whether a future date is allowed. Workforce forbids it (use Hire instead). */
  allowFuture: boolean;
  /** Consequence stated plainly when a non-today date is chosen. */
  consequence: (formattedDate: string, meaning: ImportDateMeaning) => string;
  /** Refusal shown when a future date is chosen and `allowFuture` is false. */
  futureRefusal?: string;
};

/** Copy for the staged upload → interpret → review hand-off animation. */
export type ImportProcessingCopy = {
  /** Headline shown for each phase. */
  headlines: { uploading: string; interpreting: string; ready: string };
  /** The interpretation checklist, in order: first line = upload, last = review hand-off, middle =
   *  interpret steps that tick off one by one. Needs at least three entries. */
  steps: string[];
};

export type ImportOnrampConfig = {
  title: string;
  back: { href: string; label: string };
  date: ImportDateConfig;
  /** Three-beat journey shown as the dropzone's wayfinding caption. */
  journey: [string, string, string];
  /** Workforce needs a header-row clarification step; Organization does not. */
  hasHeaderStep: boolean;
  /** When present, the intake plays the staged processing hand-off instead of a bare spinner. */
  processing?: ImportProcessingCopy;
  copy: {
    /** aria-label for the hidden file input. */
    fileInputLabel: string;
    /** aria-label for the drop region. */
    dropAreaLabel: string;
    /** Prompt shown when a workbook has several sheets. */
    sheetPrompt: string;
    /** Label for the template affordance. */
    templateLabel: string;
  };
};

export const workforceOnrampConfig: ImportOnrampConfig = {
  title: "Import workforce",
  back: { href: "/people", label: "Back to People" },
  date: {
    label: "Workforce as of",
    inputId: "workforce-import-date",
    allowFuture: false,
    consequence: (date) =>
      `Fusion establishes these work details from ${date} and treats them as current until you record a later change.`,
    futureRefusal:
      "Workforce Import is for people already employed as of the selected date. Use Hire for future employees.",
  },
  journey: ["Add your file", "Understand columns", "Review & establish"],
  hasHeaderStep: true,
  processing: {
    headlines: {
      uploading: "Reading your file",
      interpreting: "Understanding your workforce",
      ready: "Opening your review",
    },
    steps: [
      "Reading the file",
      "Detecting the layout",
      "Understanding your columns",
      "Resolving organizations & reporting",
      "Preparing your review",
    ],
  },
  copy: {
    fileInputLabel: "Choose a workforce source file",
    dropAreaLabel: "Workforce source drop area",
    sheetPrompt: "Which sheet contains your workforce?",
    templateLabel: "Download Fusion template",
  },
};

export const organizationOnrampConfig: ImportOnrampConfig = {
  title: "Import structure",
  back: { href: "/organization", label: "Back to Structure" },
  date: {
    label: "Effective date",
    inputId: "organization-import-date",
    allowFuture: true,
    consequence: (date, meaning) =>
      meaning === "scheduled"
        ? `Fusion applies this structure on ${date}.`
        : `Fusion records this structure as effective from ${date}.`,
  },
  journey: ["Add your file", "Review structure", "Commit"],
  hasHeaderStep: false,
  processing: {
    headlines: {
      uploading: "Reading your file",
      interpreting: "Interpreting your organization",
      ready: "Opening your review",
    },
    steps: [
      "Reading the file",
      "Detecting the layout",
      "Mapping your columns",
      "Resolving organization types",
      "Assembling the hierarchy",
      "Preparing your review",
    ],
  },
  copy: {
    fileInputLabel: "Choose an organization source file",
    dropAreaLabel: "Organization source drop area",
    sheetPrompt: "Which sheet contains the organization structure?",
    templateLabel: "Download Fusion template",
  },
};

export function importDateMeaning(value: string, today: string): ImportDateMeaning {
  if (value === today) return "today";
  return value > today ? "scheduled" : "past";
}
