export function buildTenantContextHref(
  href: string,
  tenantId: string | null,
  tenantSlug?: string | null
): string {
  if (!tenantId && !tenantSlug) {
    return href;
  }

  const url = new URL(href, "http://localhost");

  if (tenantSlug && !url.searchParams.has("tenant")) {
    url.searchParams.set("tenant", tenantSlug);
  } else if (tenantId && !url.searchParams.has("tenantId")) {
    url.searchParams.set("tenantId", tenantId);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
