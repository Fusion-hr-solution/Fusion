import { notFound } from "next/navigation";

/** Unmatched Performance addresses resolve to the in-frame not-found state rather than the bare root page. */
export default function MissingPerformancePage() {
  notFound();
}
