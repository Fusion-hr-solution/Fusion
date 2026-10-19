import { SeriesRecord } from "@/features/performance/components/one-on-ones/series-record";

/** R7, one 1:1 series: its next meeting first, then past meetings. Only the two people see it. */
export default async function OneOnOneSeriesRoute({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  return <SeriesRecord seriesId={seriesId} />;
}
