import {
  IdCard,
  Nfc,
  UserPlus,
  MessageCircle,
  PhoneCall,
  Star,
  MapPin,
  Globe,
  Inbox,
  BarChart3,
  Layers,
  Palette,
} from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal, RevealGroup, RevealItem } from "./reveal";

/**
 * Every item here is a capability that actually ships. "Analytics" says *which
 * card* rather than "devices", because `by_device` in the product is per-card
 * attribution and phone type is captured but never shown — and the per-card
 * number is the more useful claim anyway.
 */
const FEATURES = [
  {
    icon: IdCard,
    title: "Your digital identity",
    body: "Logo, name, bio and every link that matters, on one page.",
  },
  { icon: Nfc, title: "NFC + QR", body: "Tap or scan; both point to the same identity." },
  {
    icon: UserPlus,
    title: "Save contact (vCard)",
    body: "One tap puts you in their phonebook, spelled correctly.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    body: "Opens a chat with you, ready to type.",
  },
  {
    icon: PhoneCall,
    title: "Call & email",
    body: "One tap to reach you, no typing errors.",
  },
  {
    icon: Star,
    title: "Google Reviews",
    body: "Send happy customers straight to your review page.",
  },
  { icon: MapPin, title: "Directions", body: "Opens your exact location in Google Maps." },
  {
    icon: Globe,
    title: "Website & socials",
    body: "Instagram, Facebook, TikTok, LinkedIn and more.",
  },
  {
    icon: Inbox,
    title: "Lead capture",
    body: "Collect names and numbers, and export them any time.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "See taps, scans, top buttons, which card, and your busiest times.",
  },
  {
    icon: Layers,
    title: "Multiple identities",
    body: "A card per staff member, a stand per table or branch.",
  },
  { icon: Palette, title: "Your branding", body: "Your logo and colours, not ours." },
];

export function Features() {
  return (
    <Section id="features" label="Features">
      <Reveal>
        <SectionHeading
          eyebrow="Features"
          title="Everything your customers need, in one place."
          align="center"
        />
      </Reveal>

      <RevealGroup
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        stagger={0.04}
      >
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <RevealItem key={title}>
            <div className="group h-full rounded-xl border border-border bg-surface p-5 shadow-xs transition-[box-shadow,transform] duration-base hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft transition-colors duration-base group-hover:bg-primary-100">
                <Icon className="h-4 w-4 text-primary-strong" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-card-title text-foreground">{title}</h3>
              <p className="mt-1 text-body-sm text-muted">{body}</p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
