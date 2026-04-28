/**
 * Resolve a backend asset path to a full URL.
 * In dev the frontend and backend run on different ports.
 */
export function resolveAssetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const origin = base.replace(/\/api\/?$/, "");
  return origin ? `${origin}${path}` : path;
}

export function isEmbedUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.com/i.test(url);
}

export function toEmbedUrl(url: string): string {
  const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>");
}
