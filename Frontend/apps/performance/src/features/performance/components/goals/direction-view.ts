export type DirectionView = "map" | "list";

/**
 * Which view of Organization direction to show (S-15). Map is the default for everyone; List, the
 * authoring workspace, only for direction authority. Asking for List without it falls back to Map.
 */
export function resolveDirectionView(requested: string | null, canList: boolean): DirectionView {
  return canList && requested === "list" ? "list" : "map";
}
