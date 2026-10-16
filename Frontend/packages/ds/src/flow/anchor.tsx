"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from "react";
import { useReactFlow, type Node } from "@xyflow/react";

export interface PendingAnchor {
  id: string;
  x: number;
  y: number;
}

/**
 * The viewport translation that keeps a node on the same screen spot after a relayout moved it
 * from `anchor` to `next` (flow coordinates), at the current zoom.
 */
export function anchorDelta(
  anchor: { x: number; y: number },
  next: { x: number; y: number },
  zoom: number
) {
  return { dx: (anchor.x - next.x) * zoom, dy: (anchor.y - next.y) * zoom };
}

/**
 * Wraps an expand/collapse handler so the toggled node stays put on screen: it remembers the
 * node's position before the relayout, and {@link AnchorViewport} compensates afterwards.
 */
export function useAnchoredToggle<N extends Node>(
  nodesRef: MutableRefObject<N[]>,
  onToggle: (id: string) => void
) {
  const pendingAnchorRef = useRef<PendingAnchor | null>(null);
  const handleToggle = useCallback(
    (id: string) => {
      const current = nodesRef.current.find((node) => node.id === id);
      if (current)
        pendingAnchorRef.current = {
          id,
          x: current.position.x,
          y: current.position.y,
        };
      onToggle(id);
    },
    [nodesRef, onToggle]
  );
  return { pendingAnchorRef, handleToggle };
}

/**
 * Keeps the interacted node spatially anchored across a relayout. A tree layout repositions
 * every visible node on expand or collapse; without compensation the toggled node jumps. This
 * translates the viewport by the node's position delta (zoom preserved), synchronously before paint.
 */
export function AnchorViewport<N extends Node>({
  nodes,
  pendingAnchorRef,
}: {
  nodes: N[];
  pendingAnchorRef: MutableRefObject<PendingAnchor | null>;
}) {
  const flow = useReactFlow();
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    pendingAnchorRef.current = null;
    const next = nodes.find((node) => node.id === anchor.id);
    if (!next) return;
    const viewport = flow.getViewport();
    const { dx, dy } = anchorDelta(anchor, next.position, viewport.zoom);
    if (dx === 0 && dy === 0) return;
    void flow.setViewport({
      x: viewport.x + dx,
      y: viewport.y + dy,
      zoom: viewport.zoom,
    });
  }, [flow, nodes, pendingAnchorRef]);
  return null;
}
