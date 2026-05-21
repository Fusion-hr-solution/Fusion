export function buildTenantContextHref(
  href: string,
  tenantId: string | null
): string {
  if (!tenantId) {
    return href;
  }

  const url = new URL(href, "http://localhost");

  if (!url.searchParams.has("tenantId")) {
    url.searchParams.set("tenantId", tenantId);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
