import dynamic from "next/dynamic";

const MyObjectiveCampaignsPage = dynamic(() =>
  import("@/components/my-objectives/my-objectives-pages").then((module) => module.MyObjectiveCampaignsPage),
);

export default function Page() {
  return <MyObjectiveCampaignsPage />;
}
