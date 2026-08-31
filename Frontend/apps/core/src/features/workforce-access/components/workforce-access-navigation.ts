export function peopleProfilePath(
  stableEmployeeKey: string,
  options?: { action?: "work-email"; returnTo?: "/core/workforce-access" }
): string {
  const search = new URLSearchParams();
  if (options?.action) search.set("action", options.action);
  if (options?.returnTo) search.set("returnTo", options.returnTo);
  const query = search.toString();
  return `/core/people/${encodeURIComponent(stableEmployeeKey)}${query ? `?${query}` : ""}`;
}
