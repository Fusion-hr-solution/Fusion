import Link from "next/link";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PageEmpty } from "@repo/ds/shell";

/** A Performance address that matches no record renders here, inside the Performance frame. */
export default function PerformanceNotFound() {
  return (
    <PageContainer>
      <PageEmpty
        headingLevel={1}
        title="Nothing here"
        description="This address doesn't match anything in Performance."
        action={
          <Button asChild variant="outline">
            <Link href="/">Go to Overview</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
