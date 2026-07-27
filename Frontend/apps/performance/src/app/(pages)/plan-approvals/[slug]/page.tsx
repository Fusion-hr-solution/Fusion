import dynamic from "next/dynamic";

const PlanApprovalWorkspacePage = dynamic(() =>
  import("@/components/plan-approvals/plan-approvals-pages").then((module) => module.PlanApprovalWorkspacePage),
);

export default function Page() {
  return <PlanApprovalWorkspacePage />;
}
