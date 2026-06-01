import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function DepartmentsPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Departments"
        description="This route is not part of the current Core workflow."
        size="compact"
      />
      <Card size="sm">
        <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Use the active workspaces instead.
          </p>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-primary">
            <Link
              href="/employees"
              className="inline-flex items-center gap-1.5"
            >
              Employees
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/organizations"
              className="inline-flex items-center gap-1.5"
            >
              Organizations
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
