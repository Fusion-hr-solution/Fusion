import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "./messages";

export type { Say };

/** A namespace of Performance's catalogue in English: the default `say` of pure helpers that word things. */
export function english(namespace: string): Say {
  return englishSay(englishMessages, namespace);
}
