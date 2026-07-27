/**
 * Wording for the template preview.
 *
 * The preview's only job is to answer "what will the participant see?" — so it must never leave
 * ambiguity about *which* version of the template it is showing.
 */
export const templatePreviewTerms = {
  showingSavedTitle: "Showing the saved version",
  showingSaved:
    "You have unsaved edits. Save them to preview what the participant will actually see.",
  unsavedOnly: "Save this template to preview it as a participant will see it.",
  failed: "Could not load the preview.",
  retry: "Try again",
} as const;
