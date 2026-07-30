export function buildShellUrl(pathname: string): URL {
  const configuredShellUrl = process.env.NEXT_PUBLIC_SHELL_URL;
  const origin =
    configuredShellUrl ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000");

  return new URL(pathname, origin);
}
