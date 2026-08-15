/**
 * Lead workflow vocabulary.
 *
 * A lead is a SUBMISSION, not a person (D-015). The contact fields are a record
 * of what someone actually sent; only `status` and `note` belong to the owner.
 */

export const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Lead = {
  id: string;
  smart_page_id: string;
  page_title: string | null;
  page_slug: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
  status: LeadStatus;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  /** Other submissions sharing this phone or email. 0 for a first-time enquiry. */
  repeat_count: number;
};

export type LeadCounts = {
  all: number;
  by_status: Partial<Record<LeadStatus, number>>;
};

export const STATUS_META: Record<
  LeadStatus,
  { label: string; description: string; tone: "info" | "warning" | "success" | "neutral" }
> = {
  new: {
    label: "New",
    description: "Not contacted yet",
    tone: "info",
  },
  contacted: {
    label: "Contacted",
    description: "You have reached out",
    tone: "warning",
  },
  won: {
    label: "Won",
    description: "Became a customer",
    tone: "success",
  },
  lost: {
    label: "Lost",
    description: "Did not go ahead",
    tone: "neutral",
  },
};

export function isLeadStatus(value: string | null | undefined): value is LeadStatus {
  return LEAD_STATUSES.includes((value ?? "") as LeadStatus);
}

export function parseLeadStatus(value: string | undefined): LeadStatus | undefined {
  return isLeadStatus(value) ? value : undefined;
}

/** Best available name for a submission that may have left the name blank. */
export function leadDisplayName(lead: Pick<Lead, "name" | "phone" | "email" | "company">): string {
  return (
    lead.name?.trim() ||
    lead.phone?.trim() ||
    lead.email?.trim() ||
    lead.company?.trim() ||
    "Unnamed enquiry"
  );
}

/**
 * Normalise a Kenyan number for wa.me, which wants digits with a country code
 * and no plus. Local 07…/01… numbers are the common case in a Kenyan lead form,
 * and sending those to WhatsApp unchanged produces a dead link.
 */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (/^254\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  // Already international, or a format we should not guess at — pass it through
  // rather than mangling a valid foreign number.
  return digits.length >= 10 ? digits : null;
}

export type ContactChannel = {
  kind: "call" | "whatsapp" | "email";
  label: string;
  href: string;
};

/** The ways an owner can actually reach this lead, given what they submitted. */
export function contactChannels(lead: Pick<Lead, "phone" | "email">): ContactChannel[] {
  const channels: ContactChannel[] = [];
  const phone = lead.phone?.trim();
  const email = lead.email?.trim();

  if (phone) {
    channels.push({ kind: "call", label: phone, href: `tel:${phone}` });
    const wa = whatsappNumber(phone);
    if (wa) {
      channels.push({ kind: "whatsapp", label: "WhatsApp", href: `https://wa.me/${wa}` });
    }
  }
  if (email) {
    channels.push({ kind: "email", label: email, href: `mailto:${email}` });
  }
  return channels;
}

/**
 * Client-side search across the fields an owner would actually search by.
 * Deliberately not a database query: the list is already loaded and capped, so
 * a round trip per keystroke would be slower and no more correct.
 */
export function matchesQuery(lead: Lead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [lead.name, lead.phone, lead.email, lead.company, lead.message, lead.page_title]
    .filter(Boolean)
    .some((field) => (field as string).toLowerCase().includes(q));
}

/** Windows offered on the customers screen. Wider than analytics — leads age slower. */
export const LEAD_RANGES = [30, 90, 365] as const;
export type LeadRange = (typeof LEAD_RANGES)[number];

export function parseLeadRange(value: string | undefined): LeadRange {
  const n = Number(value);
  return (LEAD_RANGES as readonly number[]).includes(n) ? (n as LeadRange) : 90;
}

export function leadRangeLabel(days: LeadRange): string {
  return days === 30 ? "Last 30 days" : days === 90 ? "Last 3 months" : "Last year";
}
