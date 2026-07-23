// Shared types for the Smart Profile engine (page mode).

export type BlockType =
  | "contact"
  | "call"
  | "whatsapp"
  | "email"
  | "website"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "x"
  | "directions"
  | "google_review"
  | "custom";

export type Block = {
  id?: string;
  type: BlockType;
  label: string;
  value: string;
  sort_order: number;
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

export type PageConfig = {
  bio?: string;
  avatarUrl?: string;
  contact?: Contact;
  leadForm?: LeadFormConfig;
};

export type ThemePreset = "light" | "dark" | "brand";

export type Theme = {
  preset?: ThemePreset;
  accent?: string; // brand/button color
  bg?: string;
  text?: string;
};

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
