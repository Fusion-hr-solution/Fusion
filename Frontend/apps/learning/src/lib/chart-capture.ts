/**
 * Rasterises the recharts SVG charts inside a container to PNG (base64, no data: prefix) so they can
 * be POSTed to the report PDF export and embedded server-side (ADR 0007). Charts that fail to
 * rasterise are skipped — the PDF then falls back to tables only rather than erroring.
 */
export async function captureSvgChartsAsPng(container: HTMLElement | null): Promise<string[]> {
  if (!container || typeof window === "undefined") return [];

  const svgs = Array.from(container.querySelectorAll("svg"));
  const out: string[] = [];
  for (const svg of svgs) {
    const png = await svgToPng(svg);
    if (png) out.push(png);
  }
  return out;
}

function svgToPng(svg: SVGSVGElement): Promise<string | null> {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const xml = new XMLSerializer().serializeToString(clone);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 2; // render at 2× for a crisp PDF image
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl.split(",")[1] ?? null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
