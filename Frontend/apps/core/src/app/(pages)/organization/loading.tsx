import { PageHeader } from "@repo/ds/shell";
import { Skeleton } from "@repo/ds";

export default function OrganizationLoading() {
  return <div className="p-6"><PageHeader title="Organization" description="The official Organizational Unit hierarchy." /><div className="border-t pt-4"><div className="mb-4 flex gap-3"><Skeleton className="h-9 flex-1" /><Skeleton className="h-9 w-44" /><Skeleton className="h-9 w-28" /></div><div className="grid min-h-[520px] place-items-center bg-muted/10"><div className="space-y-10"><Skeleton className="mx-auto h-24 w-56 rounded-xl" /><div className="flex gap-12"><Skeleton className="h-24 w-56 rounded-xl" /><Skeleton className="h-24 w-56 rounded-xl" /></div></div></div></div></div>;
}
