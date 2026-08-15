import type { BlockType, PageConfig } from "./profile";

/**
 * Profile templates.
 *
 * A Smart Business Card is NOT a second product — it is the same engine with
 * different defaults and a different emphasis (CLAUDE.md §17). The template is
 * stored in `config.template`, so adding one costs no migration.
 *
 * What actually differs:
 *   - which fields the builder puts first,
 *   - which actions a new profile is seeded with,
 *   - whether the name is followed by a job title or a business tagline.
 * The renderer, the publish path, analytics and NFC binding are identical.
 */
export type ProfileTemplate = "business" | "card";

export type TemplateDef = {
  id: ProfileTemplate;
  label: string;
  description: string;
  /** Heading for the identity section in the builder. */
  identityHeading: string;
  /** Placeholder for the main name field. */
  namePlaceholder: string;
  /**
   * Cards live and die by the contact card, so it is promoted out of the
   * Advanced disclosure and the vCard action is seeded first.
   */
  contactFirst: boolean;
  /** Actions seeded on creation, in order, when a value is available. */
  seedOrder: BlockType[];
};

export const TEMPLATES: Record<ProfileTemplate, TemplateDef> = {
  business: {
    id: "business",
    label: "Business page",
    description:
      "For a shop, restaurant or service. Leads with reviews, WhatsApp and directions.",
    identityHeading: "Your business",
    namePlaceholder: "Java House Westlands",
    contactFirst: false,
    seedOrder: ["google_review", "whatsapp", "call", "directions", "website"],
  },
  card: {
    id: "card",
    label: "Personal card",
    description:
      "For an individual. Leads with saving your contact details to a phone.",
    identityHeading: "Your details",
    namePlaceholder: "Amina Wanjiru",
    contactFirst: true,
    seedOrder: ["contact", "call", "whatsapp", "email", "website"],
  },
};

export const TEMPLATE_ORDER: ProfileTemplate[] = ["business", "card"];

export function templateOf(config: PageConfig | null | undefined): ProfileTemplate {
  // Everything created before templates existed is a business page.
  return config?.template === "card" ? "card" : "business";
}

export function templateDef(template: ProfileTemplate): TemplateDef {
  return TEMPLATES[template] ?? TEMPLATES.business;
}

/**
 * The line under the name.
 *
 * A card shows who the person is — "Sales Director · Hornbill" — built from the
 * vCard fields so it can never disagree with the contact they download. A
 * business page uses its own tagline. An explicit tagline always wins.
 */
export function roleLine(
  config: PageConfig | null | undefined,
): string | undefined {
  const tagline = config?.tagline?.trim();
  if (tagline) return tagline;
  if (templateOf(config) !== "card") return undefined;

  const { title, org } = config?.contact ?? {};
  const parts = [title?.trim(), org?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Business details captured in Settings, used to seed a first profile. */
export type SeedSource = {
  phone?: string;
  whatsapp?: string;
  website?: string;
  googleReviewUrl?: string;
  location?: string;
};

export type SeedBlock = { type: BlockType; label: string; value: string };

/**
 * Build the starting actions for a new profile.
 *
 * Only emits a block when there is a real value behind it — a seeded button
 * with nothing to open is a dead button on a customer's phone. The vCard action
 * is the exception: it needs no value, because it is built from the contact
 * fields at download time.
 */
export function seedBlocks(
  template: ProfileTemplate,
  source: SeedSource,
  labelFor: (type: BlockType) => string,
): SeedBlock[] {
  const values: Partial<Record<BlockType, string | undefined>> = {
    google_review: source.googleReviewUrl,
    whatsapp: source.whatsapp || source.phone,
    call: source.phone,
    website: source.website,
    directions: source.location,
    email: undefined, // captured on the profile itself, not in Settings
  };

  return templateDef(template)
    .seedOrder.map((type) => {
      if (type === "contact") return { type, label: labelFor(type), value: "" };
      const value = values[type]?.trim();
      return value ? { type, label: labelFor(type), value } : null;
    })
    .filter((b): b is SeedBlock => b !== null);
}
