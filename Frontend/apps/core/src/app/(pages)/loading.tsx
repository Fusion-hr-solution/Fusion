import { PageContainer, PageHeader, PageLoading } from "@repo/ds/shell";

export default function PagesLoading() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title="Overview" description="Loading the next page." />
      <PageLoading rows={6} label="Loading page..." />
    </PageContainer>
  );
}
