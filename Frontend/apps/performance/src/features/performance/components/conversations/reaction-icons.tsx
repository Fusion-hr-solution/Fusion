import type { PraiseReactionIcons } from "@repo/performance-ui";
import { Clapping, Heart, Lightbulb, Party } from "@/lib/icons";

/** Performance's glyphs for the four praise reactions; the shared parts carry none of their own. */
export const REACTION_ICONS: PraiseReactionIcons = {
  Applause: <Clapping />,
  Celebrate: <Party />,
  Insightful: <Lightbulb />,
  ThankYou: <Heart />,
};
