import dynamic from "next/dynamic";

const CampaignDraftPage = dynamic(() =>
  import("@/components/campaigns/campaigns-page").then((module) => module.CampaignDraftPage),
);

export default function CampaignDraftRoute() {
  return <CampaignDraftPage />;
}
