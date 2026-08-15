// Shared types for the Smart Profile engine (page mode).

/**
 * Action types available in Simple Mode.
 *
 * `links.type` is free text with no CHECK constraint, so adding a type needs no
 * migration — only an entry here, a href rule in lib/blocks.ts, and an icon.
 */
export type BlockType =
  | "contact"
  | "call"
  | "whatsapp"
  | "email"
  | "website"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x"
  | "directions"
  | "google_review"
  | "menu"
  | "booking"
  | "mpesa"
  | "custom";

export type Block = {
  id?: string;
  type: BlockType;
  label: string;
  value: string;
  sort_order: number;
  /** Disabled actions stay in the editor but never reach the public page. */
  is_active?: boolean;
};

export type Contact = {
  fullName?: string;
  org?: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
};

export type LeadFormConfig = {
  enabled?: boolean;
  headline?: string;
  buttonLabel?: string;
};

/** Search/social metadata. Stored in config — no migration (audit item B5). */
export type SeoConfig = {
  title?: string;
  description?: string;
};

export type PageConfig = {
  bio?: string;
  avatarUrl?: string;
  /** Wide banner behind the avatar. */
  coverUrl?: string;
  /** Short line under the title, e.g. "Coffee shop · Westlands". */
  tagline?: string;
  contact?: Contact;
  leadForm?: LeadFormConfig;
  seo?: SeoConfig;
};

export type ThemePreset = "light" | "dark" | "brand";

export type Theme = {
  preset?: ThemePreset;
  accent?: string; // brand/button color
  bg?: string;
  text?: string;
};

export type PublishStatus = "draft" | "published";

export type PublicPage = {
  id: string;
  title: string | null;
  mode: "page" | "redirect";
  redirect_url: string | null;
  config: PageConfig;
  theme: Theme;
  links: Block[];
};

export const DEFAULT_THEME: Required<Pick<Theme, "accent" | "bg" | "text">> = {
  accent: "#111827",
  bg: "#ffffff",
  text: "#0a0a0a",
};

export function resolveTheme(theme: Theme | null | undefined): {
  accent: string;
  bg: string;
  text: string;
} {
  const t = theme ?? {};
  if (t.preset === "dark") {
    return { accent: t.accent ?? "#ffffff", bg: "#0a0a0a", text: "#f5f5f5" };
  }
  return {
    accent: t.accent ?? DEFAULT_THEME.accent,
    bg: t.bg ?? DEFAULT_THEME.bg,
    text: t.text ?? DEFAULT_THEME.text,
  };
}

/**
 * Readable text colour for a filled button of the given background.
 *
 * The public page lets owners pick any accent, so the label has to adapt or it
 * will fail contrast on light accents — exactly the trap D-012 identified with
 * white-on-orange (2.80:1). Uses the WCAG relative-luminance threshold.
 */
export function onAccentColor(accent: string): string {
  const hex = accent.replace("#", "").trim();
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#ffffff";

  const channel = (start: number) => {
    const v = parseInt(full.slice(start, start + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);

  // Contrast against white vs against near-black; pick the better one.
  const onWhite = 1.05 / (luminance + 0.05);
  const onBlack = (luminance + 0.05) / 0.05;
  return onBlack >= onWhite ? "#111111" : "#ffffff";
}
