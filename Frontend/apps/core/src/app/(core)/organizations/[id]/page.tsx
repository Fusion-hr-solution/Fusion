"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrganizationDetailView } from "@/modules/platform-admin/components/organization-detail-view";
import { useOrganizations } from "@/modules/platform-admin/context/organizations-context";

export default function OrganizationDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? decodeURIComponent(params.id) : "";
  const { getById, ensureOrganization } = useOrganizations();
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void ensureOrganization(id).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, ensureOrganization]);

  const org = getById(id);

  if (detailLoading && !org) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center font-chBody text-ch-secondary">
        Loading organization…
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-lg py-8 text-center font-chBody">
        <h1 className="font-chHeadline text-2xl font-bold text-ch-on-surface">
          Organization not found
        </h1>
        <p className="mt-2 text-ch-secondary">
          No organization exists for this address. Check the link or return to
          the directory.
        </p>
        <Link
          href="/organizations"
          className="mt-6 inline-block font-semibold text-ch-primary underline"
        >
          Back to organizations
        </Link>
      </div>
    );
  }

  return <OrganizationDetailView org={org} />;
}
