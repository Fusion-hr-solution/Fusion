import dynamic from "next/dynamic";

const CampaignListPage = dynamic(() =>
  import("@/components/campaigns/campaigns-page").then((module) => module.CampaignListPage),
);

export default function CampaignsRoute() {
  return <CampaignListPage />;
}
