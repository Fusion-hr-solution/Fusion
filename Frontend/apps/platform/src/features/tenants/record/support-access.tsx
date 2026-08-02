"use client";

import { LifeBuoy } from "lucide-react";
import { CapabilityList, UnavailableAction } from "../availability";
import { SupportingSurface } from "./record-ui";

/**
 * Provider-side access to a customer's own content is a governed capability
 * that does not exist yet.
 *
 * Its place is held on every destination that will eventually carry it, so the
 * record does not have to be rearranged when it arrives — and nothing about it
 * is simulated: no request, no approval, no session, no expiry. One component
 * so the three placements cannot come to describe it differently.
 */
export function SupportAccessPanel({ id }: { id: string }) {
  return (
    <SupportingSurface
      id={id}
      title="Support access"
      description="Customer-approved, scoped, time-limited provider access."
      icon={LifeBuoy}
      action={<UnavailableAction label="Request support access" icon={LifeBuoy} />}
    >
      <CapabilityList items={["Customer approval", "Scoped access", "Time limit"]} />
    </SupportingSurface>
  );
}

/** The absence of tenant history, worded once for the preview and the destination. */
export const NO_EVENTS = {
  title: "No events recorded",
  description: "No tenant history is available for this record.",
} as const;
