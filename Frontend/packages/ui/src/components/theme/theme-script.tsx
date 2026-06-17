import { THEME_STORAGE_KEY } from "./constants";

/**
 * Renders a tiny synchronous script that sets the `dark` class and
 * `color-scheme` on <html> BEFORE the browser paints, so the page never
 * flashes the wrong theme. Render it once, as early as possible (first child
 * of <body>), in any app that adopts the theme. Resolution matches
 * {@link ThemeProvider}: an explicit stored choice wins; otherwise the OS
 * `prefers-color-scheme` decides.
 */
export function ThemeScript({
  storageKey = THEME_STORAGE_KEY,
}: {
  storageKey?: string;
}) {
  const js = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
    storageKey
  )});var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s==="dark"||((s==="system"||!s)&&m);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

  return (
    <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: js }} />
  );
}
