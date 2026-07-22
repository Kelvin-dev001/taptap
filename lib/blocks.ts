import type { BlockType } from "./profile";

export const BLOCK_DEFS: {
  type: BlockType;
  label: string;
  needsValue: boolean;
  placeholder: string;
}[] = [
  { type: "contact", label: "Save contact (vCard)", needsValue: false, placeholder: "" },
  { type: "call", label: "Call", needsValue: true, placeholder: "+2547XXXXXXXX" },
  { type: "whatsapp", label: "WhatsApp", needsValue: true, placeholder: "+2547XXXXXXXX" },
  { type: "email", label: "Email", needsValue: true, placeholder: "you@business.co.ke" },
  { type: "website", label: "Website", needsValue: true, placeholder: "https://…" },
  { type: "instagram", label: "Instagram", needsValue: true, placeholder: "https://instagram.com/…" },
  { type: "facebook", label: "Facebook", needsValue: true, placeholder: "https://facebook.com/…" },
  { type: "tiktok", label: "TikTok", needsValue: true, placeholder: "https://tiktok.com/@…" },
  { type: "linkedin", label: "LinkedIn", needsValue: true, placeholder: "https://linkedin.com/in/…" },
  { type: "x", label: "X (Twitter)", needsValue: true, placeholder: "https://x.com/…" },
  { type: "directions", label: "Directions", needsValue: true, placeholder: "Address or Maps URL" },
  { type: "google_review", label: "Google review", needsValue: true, placeholder: "https://g.page/r/…" },
  { type: "custom", label: "Custom link", needsValue: true, placeholder: "https://…" },
];

export function defaultLabel(type: BlockType): string {
  return BLOCK_DEFS.find((b) => b.type === type)?.label ?? "Link";
}

function digits(s: string): string {
  return s.replace(/[^\d]/g, "");
}

function ensureScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Build the destination href for a block, or null if it's handled specially (contact). */
export function buildHref(type: BlockType, value: string): string | null {
  const v = (value ?? "").trim();
  switch (type) {
    case "contact":
      return null; // handled via vCard download
    case "call":
      return v ? `tel:${v}` : null;
    case "whatsapp":
      return v ? `https://wa.me/${digits(v)}` : null;
    case "email":
      return v ? `mailto:${v}` : null;
    case "directions":
      if (!v) return null;
      return /^https?:\/\//i.test(v)
        ? v
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    case "website":
    case "instagram":
    case "facebook":
    case "tiktok":
    case "linkedin":
    case "x":
    case "google_review":
    case "custom":
      return v ? ensureScheme(v) : null;
    default:
      return null;
  }
}
