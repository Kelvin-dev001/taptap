import type { BadgeTone } from "@/ui/badge";
import type { ProfileStatus } from "./model";

/** The badge colour for each status; the word beside it carries the meaning. */
export const STATUS_TONE: Record<ProfileStatus, BadgeTone> = {
  live: "success",
  unpublished: "warning",
  draft: "neutral",
  inactive: "danger",
  off: "neutral",
};
