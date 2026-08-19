import type { BlockType } from "./profile";

export type BlockDef = {
  type: BlockType;
  label: string;
  /** Shown in the picker so an owner knows what the action does. */
  description: string;
  needsValue: boolean;
  placeholder: string;
  /** Groups the picker; keeps Simple Mode from being one long list. */
  group: "Popular in Kenya" | "Contact" | "Social" | "Business";
  /** Input hint for mobile keyboards. */
  inputMode?: "tel" | "url" | "email" | "text";
};

export const BLOCK_DEFS: BlockDef[] = [
  // Popular in Kenya — the actions that drive the wedge (CLAUDE.md §22)
  {
    type: "whatsapp",
    label: "WhatsApp",
    description: "Open a chat with your business",
    needsValue: true,
    placeholder: "+2547XXXXXXXX",
    group: "Popular in Kenya",
    inputMode: "tel",
  },
  {
    type: "google_review",
    label: "Google review",
    description: "Send customers to leave a review",
    needsValue: true,
    placeholder: "https://g.page/r/…",
    group: "Popular in Kenya",
    inputMode: "url",
  },
  {
    type: "mpesa",
    label: "Pay with M-Pesa",
    description: "Show your paybill or till number",
    needsValue: true,
    placeholder: "Till 123456 or Paybill 987654",
    group: "Popular in Kenya",
  },
  {
    type: "directions",
    label: "Directions",
    description: "Open your location in Maps",
    needsValue: true,
    placeholder: "Address or Maps URL",
    group: "Popular in Kenya",
  },

  // Contact
  {
    type: "contact",
    label: "Save contact (vCard)",
    description: "Save your details to a phone",
    needsValue: false,
    placeholder: "",
    group: "Contact",
  },
  {
    type: "call",
    label: "Call",
    description: "Start a phone call",
    needsValue: true,
    placeholder: "+2547XXXXXXXX",
    group: "Contact",
    inputMode: "tel",
  },
  {
    type: "email",
    label: "Email",
    description: "Open a new email",
    needsValue: true,
    placeholder: "you@business.co.ke",
    group: "Contact",
    inputMode: "email",
  },
  {
    type: "website",
    label: "Website",
    description: "Link to your site",
    needsValue: true,
    placeholder: "https://…",
    group: "Contact",
    inputMode: "url",
  },

  // Social
  {
    type: "instagram",
    label: "Instagram",
    description: "Your Instagram profile",
    needsValue: true,
    placeholder: "https://instagram.com/…",
    group: "Social",
    inputMode: "url",
  },
  {
    type: "facebook",
    label: "Facebook",
    description: "Your Facebook page",
    needsValue: true,
    placeholder: "https://facebook.com/…",
    group: "Social",
    inputMode: "url",
  },
  {
    type: "tiktok",
    label: "TikTok",
    description: "Your TikTok profile",
    needsValue: true,
    placeholder: "https://tiktok.com/@…",
    group: "Social",
    inputMode: "url",
  },
  {
    type: "youtube",
    label: "YouTube",
    description: "Your channel or a video",
    needsValue: true,
    placeholder: "https://youtube.com/@…",
    group: "Social",
    inputMode: "url",
  },
  {
    type: "linkedin",
    label: "LinkedIn",
    description: "Your company or personal page",
    needsValue: true,
    placeholder: "https://linkedin.com/in/…",
    group: "Social",
    inputMode: "url",
  },
  {
    type: "x",
    label: "X (Twitter)",
    description: "Your X profile",
    needsValue: true,
    placeholder: "https://x.com/…",
    group: "Social",
    inputMode: "url",
  },

  // Business
  {
    type: "menu",
    label: "Menu",
    description: "Link to a menu or price list",
    needsValue: true,
    placeholder: "https://… (or a PDF link)",
    group: "Business",
    inputMode: "url",
  },
  {
    type: "booking",
    label: "Book an appointment",
    description: "Link to your booking page",
    needsValue: true,
    placeholder: "https://calendly.com/…",
    group: "Business",
    inputMode: "url",
  },
  {
    type: "custom",
    label: "Custom link",
    description: "Anything else",
    needsValue: true,
    placeholder: "https://…",
    group: "Business",
    inputMode: "url",
  },
];

export const BLOCK_GROUPS = [
  "Popular in Kenya",
  "Contact",
  "Social",
  "Business",
] as const;

export function blockDef(type: BlockType): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.type === type);
}

export function defaultLabel(type: BlockType): string {
  return blockDef(type)?.label ?? "Link";
}

function digits(s: string): string {
  return s.replace(/[^\d]/g, "");
}

/**
 * Default country for phone numbers entered in local (trunk) format.
 *
 * Kenya today (§22). Named rather than inlined because the billing architecture
 * is meant to extend to other African markets, and this is the value that has to
 * move with it — at which point it belongs on the account, not in a constant.
 */
export const DEFAULT_COUNTRY_CODE = "254";

/**
 * Normalise a phone number to international format, digits only.
 *
 * Every Kenyan writes their number as `0722…`, and wa.me rejects it: it requires
 * a full international number with no leading zero, so `wa.me/0722…` renders a
 * "phone number is invalid" page rather than a chat. Nothing warned about this —
 * a business would print cards, hand them out, and never learn the button was
 * dead. It shipped on a real customer's card before it was caught.
 *
 * The trunk `0` is a national prefix standing in for the country code, so
 * replacing it is the correct transformation, not a guess. Numbers already in
 * international form (`+254…`, `254…`) are left alone.
 */
export function toInternational(value: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const d = digits(value);
  if (!d) return "";
  // Already international: either written with + or already carrying the code.
  if (value.trim().startsWith("+") || d.startsWith(countryCode)) return d;
  // Local/trunk format — swap the leading 0 for the country code.
  if (d.startsWith("0")) return `${countryCode}${d.slice(1)}`;
  // Anything else (a bare subscriber number) gets the code prefixed.
  return `${countryCode}${d}`;
}

function ensureScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Build the destination href for a block, or null when the block is handled
 * some other way (vCard download, M-Pesa instructions).
 */
export function buildHref(type: BlockType, value: string): string | null {
  const v = (value ?? "").trim();
  switch (type) {
    case "contact":
      return null; // handled via vCard download
    case "mpesa":
      // A till/paybill is not a URL. Kenyan phones cannot be handed a payment
      // deep link generically, so the page shows the number to enter — we never
      // pretend a payment was initiated, let alone completed.
      return null;
    case "call":
      return v ? `tel:${v}` : null;
    case "whatsapp":
      // wa.me needs international format with no leading zero — see toInternational.
      return v ? `https://wa.me/${toInternational(v)}` : null;
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
    case "youtube":
    case "linkedin":
    case "x":
    case "google_review":
    case "menu":
    case "booking":
    case "custom":
      return v ? ensureScheme(v) : null;
    default:
      return null;
  }
}

/** True when the block opens something rather than acting in-page. */
export function isNavigational(type: BlockType): boolean {
  return type !== "contact" && type !== "mpesa";
}
