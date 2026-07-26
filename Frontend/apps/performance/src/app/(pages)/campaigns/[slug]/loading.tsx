import { CampaignPageSkeleton } from "@/components/campaigns/campaigns-page";

// Segment loading boundary for a single campaign (setup runway / launched
// workspace). Overrides the parent campaigns list skeleton so the detail route
// shows its own campaign-shaped skeleton, not the list grid.
export default function CampaignDetailLoading() {
  return <CampaignPageSkeleton />;
}
