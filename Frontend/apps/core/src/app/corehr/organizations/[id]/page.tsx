"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { OrganizationDetailView } from "@/modules/corehr/components/organization-detail-view";
import { useOrganizations } from "@/modules/corehr/context/organizations-context";

export default function OrganizationDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { getById } = useOrganizations();
  const org = getById(decodeURIComponent(id));

  if (!org) {
    return (
      <div className="mx-auto max-w-lg p-12 text-center font-chBody">
        <h1 className="font-chHeadline text-2xl font-bold text-ch-on-surface">
          Organization not found
        </h1>
        <p className="mt-2 text-ch-secondary">
          No organization exists for this address. Check the link or return to
          the directory.
        </p>
        <Link
          href="/corehr/organizations"
          className="mt-6 inline-block font-semibold text-ch-primary underline"
        >
          Back to organizations
        </Link>
      </div>
    );
  }

  return <OrganizationDetailView org={org} />;
}
