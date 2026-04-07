/**
 * Normalizes core app paths by removing the /core prefix.
 * 
 * @param pathname - The full pathname (e.g., "/core/organizations")
 * @returns The normalized path without /core prefix (e.g., "/organizations")
 * 
 * @example
 * normalizeCorePath("/core/organizations") // "/organizations"
 * normalizeCorePath("/core") // "/"
 * normalizeCorePath("/organizations") // "/organizations"
 */
export function normalizeCorePath(pathname: string): string {
  return pathname.replace(/^\/core(?=\/|$)/, "") || "/";
}
