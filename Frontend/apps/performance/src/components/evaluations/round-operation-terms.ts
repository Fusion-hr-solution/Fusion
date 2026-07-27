/**
 * Wording for HR's mid-round corrections on a launched evaluation round.
 *
 * One terminology source so the roster, the dialogs, and the activity trail read the same. Says
 * what happens to the work, never how the system is implemented.
 */
export const roundOperationTerms = {
  cancel: "Cancel",
  saving: "Saving…",
  columnLabel: "Manage",

  exclude: {
    trigger: (name: string) => `Remove ${name} from this round`,
    title: "Remove from this round?",
    description: (name: string) =>
      `${name}'s outstanding evaluation work leaves their reviewer's queue. Anything already recorded is kept.`,
    reasonLabel: "Why are they leaving the round?",
    reasonPlaceholder: "e.g. Left the company mid-cycle",
    confirm: "Remove from round",
    success: "Removed from this round",
  },

  reassign: {
    trigger: (name: string) => `Change who reviews ${name}`,
    title: "Change the reviewer",
    description: (name: string) =>
      `${name}'s manager assessment moves to the new reviewer, with any saved draft carried over.`,
    reviewerIdLabel: "New reviewer",
    reviewerNameLabel: "Reviewer name",
    reasonLabel: "Why is the reviewer changing?",
    reasonPlaceholder: "e.g. Original reviewer left the team",
    confirm: "Change reviewer",
    success: "Reviewer changed",
  },
} as const;
