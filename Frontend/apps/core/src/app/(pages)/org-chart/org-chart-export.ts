import {
  getNodesBounds,
  getViewportForBounds,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { toPng } from "html-to-image";

const MAX_DIMENSION = 4096;

/**
 * Rasterise the *whole* graph (not just the visible viewport) to a PNG data URL by fitting
 * all nodes into a computed image bound. Follows the React Flow image-export recipe.
 */
export async function exportFlowToPng(
  instance: ReactFlowInstance<Node, Edge>,
  viewportElement: HTMLElement,
  backgroundColor: string
): Promise<string | null> {
  const nodes = instance.getNodes();
  if (nodes.length === 0) return null;

  const bounds = getNodesBounds(nodes);
  const width = Math.min(Math.round(bounds.width + 160), MAX_DIMENSION);
  const height = Math.min(Math.round(bounds.height + 160), MAX_DIMENSION);
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 0.12);

  return toPng(viewportElement, {
    backgroundColor,
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

/** Open the rendered chart in a new window and trigger the browser print/Save-as-PDF dialog. */
export function printDataUrl(dataUrl: string, title: string): void {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${title}</title>` +
      `<style>@page{margin:12mm}html,body{margin:0;padding:0}img{display:block;width:100%;height:auto}</style>` +
      `</head><body><img src="${dataUrl}" alt="${title}" onload="window.focus();window.print();" /></body></html>`
  );
  win.document.close();
}
