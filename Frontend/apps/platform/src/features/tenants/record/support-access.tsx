/**
 * Shared wording for an empty tenant history.
 *
 * What used to live here — a placeholder for provider-side access to customer
 * content — has been removed. The locked experience forbids presenting an
 * affordance for a workflow that does not exist: it read as something an
 * operator might one day be granted, when in fact Platform gains no route into
 * customer data at all. Administrator recovery, which is the only exception, is
 * real and lives on the Access destination.
 */

/** The absence of tenant history, worded once for the preview and the destination. */
export const NO_EVENTS = {
  title: "No events recorded",
  description: "No tenant history is available for this record.",
} as const;
