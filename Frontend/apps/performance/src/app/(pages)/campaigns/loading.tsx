import { CampaignListLoading } from "@/components/campaigns/campaigns-page";

// Segment loading boundary for the campaigns list. Matches the page's own
// loading state (header placeholder + card grid) so navigation never flashes
// the generic flat-rows skeleton before the cards.
export default function CampaignsLoading() {
  return <CampaignListLoading />;
}
