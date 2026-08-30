import { RefreshCw, Smartphone, BarChart3 } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal, RevealGroup, RevealItem } from "./reveal";

const POINTS = [
  {
    icon: RefreshCw,
    title: "Always current",
    body: "Update once; every card and code you own updates instantly.",
  },
  {
    icon: Smartphone,
    title: "Works on any phone",
    body: "Tap on NFC phones, scan the QR on the rest.",
  },
  {
    icon: BarChart3,
    title: "Yours to measure",
    body: "Every tap, scan and button press is counted.",
  },
];

export function WhatIsTapTap() {
  return (
    <Section id="what-is-taptap" label="What TapTap is">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal>
          <SectionHeading
            eyebrow="What it is"
            title="One identity behind every touchpoint."
          />
          <div className="mt-6 flex max-w-xl flex-col gap-4 text-body text-foreground-secondary">
            <p>
              A TapTap identity is your business in digital form — your contact details,
              links, WhatsApp, review link, location and more, on one fast page.
            </p>
            <p>
              Put it on a card for your pocket or a stand for your counter. Customers reach
              it by tapping their phone or scanning the code. No app, on their side or yours.
            </p>
            <p>
              Change your links, your offer or your whole page whenever you like.{" "}
              <strong className="font-medium text-foreground">
                The card in your hand never needs reprinting or reprogramming.
              </strong>
            </p>
          </div>
        </Reveal>

        <RevealGroup className="flex flex-col gap-4 lg:pt-8">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs transition-shadow duration-base hover:shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                  <Icon className="h-4.5 w-4.5 text-primary-strong" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-card-title text-foreground">{title}</h3>
                  <p className="mt-1 text-body-sm text-muted">{body}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}
