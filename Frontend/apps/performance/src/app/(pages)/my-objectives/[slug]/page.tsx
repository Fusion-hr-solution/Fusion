import dynamic from "next/dynamic";

const MyObjectiveWorkspacePage = dynamic(() =>
  import("@/components/my-objectives/my-objectives-pages").then((module) => module.MyObjectiveWorkspacePage),
);

export default function Page() {
  return <MyObjectiveWorkspacePage />;
}
