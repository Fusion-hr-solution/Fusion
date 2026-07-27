import dynamic from "next/dynamic";

const CheckInDetailPage = dynamic(() =>
  import("@/components/check-ins/check-in-detail-page").then((module) => module.CheckInDetailPage),
);

export default function Page() {
  return <CheckInDetailPage />;
}
