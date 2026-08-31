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
    title: "Your own page",
    body: "Your logo, your name and every link that matters, all in one place.",
  },
  { icon: Nfc, title: "NFC + QR", body: "Tap it or scan it. Both take people to the same page." },
  {
    icon: UserPlus,
    title: "Saved to their phone",
    body: "One press and you are in their contacts, with your name spelled right.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    body: "Opens a chat with you, ready for them to type.",
  },
  {
    icon: PhoneCall,
    title: "Call and email",
    body: "They reach you in one press, with nothing typed wrong.",
  },
  {
    icon: Star,
    title: "Google reviews",
    body: "Send a happy customer straight to your review page while they are still smiling.",
  },
  { icon: MapPin, title: "Directions", body: "Opens Google Maps and walks them to your door." },
  {
    icon: Globe,
    title: "Website and socials",
    body: "Instagram, Facebook, TikTok, LinkedIn and anywhere else you post.",
  },
  {
    icon: Inbox,
    title: "Collect enquiries",
    body: "Take names and numbers on your page, and download the lot whenever you want.",
  },
  {
    icon: BarChart3,
    title: "Real numbers",
    body: "Taps, scans, the buttons people press, which card, and the hours you are busiest.",
  },
  {
    icon: Layers,
    title: "As many as you need",
    body: "A card for each of your staff, a stand for each table or branch.",
  },
  { icon: Palette, title: "Your look", body: "Your logo and your colours on the page, not ours." },
];

export function Features() {
  return (
    <Section id="features" label="Features">
      <Reveal>
        <SectionHeading
          eyebrow="Features"
          title="Everything a customer might want, one press away."
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
