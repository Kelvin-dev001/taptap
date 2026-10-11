import type { TFunction } from "i18next";
import type { KeyboardTypeOptions } from "react-native";
import { BLOCK_DEFS, BLOCK_GROUPS, blockDef } from "@taptap/core/blocks";
import { actionValueProblem, isBlockType } from "@taptap/core/draft";
import { checkPhone } from "@taptap/core/phone";
import type { BlockType } from "@taptap/core/profile";

/**
 * Action types for the app's screens: lib/blocks.ts decides what exists and
 * how each one behaves; the words come from en.json so they can be translated
 * (PLAN.md §4.9).
 */

export function actionLabel(t: TFunction, type: string): string {
  return isBlockType(type) ? t(`blocks.${type}.label`) : t("blocks.unknown");
}

export function actionDescription(t: TFunction, type: BlockType): string {
  return t(`blocks.${type}.description`);
}

export function actionPlaceholder(t: TFunction, type: BlockType): string {
  return t(`blocks.${type}.placeholder`);
}

type Group = (typeof BLOCK_GROUPS)[number];
const GROUP_KEYS = {
  "Popular in Kenya": "blockGroups.popular",
  Contact: "blockGroups.contact",
  Social: "blockGroups.social",
  Business: "blockGroups.business",
} as const satisfies Record<Group, string>;

/** The picker's sections, Kenya-first as on the web (CLAUDE.md §22). */
export function actionGroups(t: TFunction): { title: string; types: BlockType[] }[] {
  return BLOCK_GROUPS.map((group) => ({
    title: t(GROUP_KEYS[group]),
    types: BLOCK_DEFS.filter((d) => d.group === group).map((d) => d.type),
  }));
}

const KEYBOARDS: Record<string, KeyboardTypeOptions> = {
  tel: "phone-pad",
  url: "url",
  email: "email-address",
};

export function actionKeyboard(type: BlockType): KeyboardTypeOptions {
  return KEYBOARDS[blockDef(type)?.inputMode ?? ""] ?? "default";
}

export function actionNeedsValue(type: BlockType): boolean {
  return blockDef(type)?.needsValue ?? true;
}

export type ActionProblem =
  | "editor.action.valueMissing"
  | "editor.action.valueInvalid"
  | "editor.action.phoneInvalid"
  | "editor.action.phoneShort"
  | "editor.action.phoneLong";

/**
 * What stops an action being saved from the app, or null. Stricter than the
 * server (lib/draft.ts), which also accepts an empty value for an action still
 * being filled in on the web: here an action is only added once it works.
 */
export function actionProblem(type: BlockType, value: string): ActionProblem | null {
  const v = value.trim();
  if (!actionNeedsValue(type)) return null;
  if (!v) return "editor.action.valueMissing";
  if (type === "call" || type === "whatsapp") {
    const phone = checkPhone(v);
    if (phone.ok) return null;
    if (phone.reason === "tooShort") return "editor.action.phoneShort";
    if (phone.reason === "tooLong") return "editor.action.phoneLong";
    return "editor.action.phoneInvalid";
  }
  return actionValueProblem(type, v) ? "editor.action.valueInvalid" : null;
}
