import dynamic from "next/dynamic";

const PlanApprovalCampaignsPage = dynamic(() =>
  import("@/components/plan-approvals/plan-approvals-pages").then((module) => module.PlanApprovalCampaignsPage),
);

export default function Page() {
  return <PlanApprovalCampaignsPage />;
}
