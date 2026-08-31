import { RefreshCw, Smartphone, BarChart3 } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal, RevealGroup, RevealItem } from "./reveal";

const POINTS = [
  {
    icon: RefreshCw,
    title: "Change it whenever you like",
    body: "Update your page once and every card and code you own catches up straight away.",
  },
  {
    icon: Smartphone,
    title: "Works on every phone",
    body: "Newer phones just tap. Everyone else scans the QR code with their camera.",
  },
  {
    icon: BarChart3,
    title: "You see what happens",
    body: "Every tap, scan and button press is counted and waiting in your dashboard.",
  },
];

export function WhatIsTapTap() {
  return (
    <Section id="what-is-taptap" label="What TapTap is">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal>
          <SectionHeading
            eyebrow="What it is"
            title="Your whole business, on one page."
          />
          <div className="mt-6 flex max-w-xl flex-col gap-4 text-body text-foreground-secondary">
            <p>
              Think of it as your business in digital form. Your phone number, your WhatsApp,
              your review link, your location and anything else you want people to reach, all
              on one page that loads fast.
            </p>
            <p>
              Put it on a card for your pocket or a stand for your counter. Customers tap
              their phone on it or scan the code. Nobody downloads anything.
            </p>
            <p>
              Changed your number? Running a new offer? Update it in seconds.{" "}
              <strong className="font-medium text-foreground">
                The card in your hand never has to be reprinted.
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
