import { CompletionSkeleton } from "@/components/planning-completion/planning-completion-page";

// Segment loading boundary for HR planning completion. Overrides the parent
// campaign-detail skeleton so this route shows its own completion-shaped
// skeleton, matching the page's own loading state.
export default function CompletionLoading() {
  return <CompletionSkeleton />;
}
