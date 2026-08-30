"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";

/**
 * Use cases, by who you are.
 *
 * Tabs rather than one long list: the reader is exactly one of these three, and
 * making them scroll past the other two is how a landing page loses the person
 * it was written for. Built on the design system's Radix tabs, so keyboard
 * support, roving focus and `aria-selected` come from the primitive rather than
 * being reimplemented here.
 *
 * Every scenario names a person and a specific moment. "Businesses can improve
 * engagement" persuades nobody; Grace at an expo does.
 */
const GROUPS = [
  {
    value: "professionals",
    label: "Professionals",
    audience:
      "CEOs · consultants · salespeople · lawyers · real estate agents · photographers · artists · freelancers · trainers · executives",
    scenarios: [
      {
        title: "The sales rep",
        body: "Grace meets a prospect at an expo. Instead of hunting for a card, she taps her phone. Her details are saved, her WhatsApp is open, and her portfolio is on screen — before the conversation ends. That evening she sees the lead in her dashboard.",
      },
      {
        title: "The realtor",
        body: "James's card opens the listing he's showing, with photos, directions and a booking button. When the property sells, he points the same card at the next one.",
      },
    ],
  },
  {
    value: "smes",
    label: "Small & medium businesses",
    audience:
      "restaurants · cafés · salons & spas · clinics · pharmacies · small hotels · retail shops · car dealers · gyms · workshops · agencies · offices",
    scenarios: [
      {
        title: "The restaurant",
        body: "A stand sits on every table. Guests tap to see the menu, and tap again to leave a Google review before they've paid the bill. Reviews climb; the manager sees which tables generate the most.",
      },
      {
        title: "The salon",
        body: "A stand at reception collects reviews and bookings while clients wait. The owner's card shares her price list and WhatsApp with every walk-in.",
      },
      {
        title: "The clinic",
        body: "Reception has a stand for directions, opening hours and appointment requests — fewer phone calls, fewer missed patients.",
      },
    ],
  },
  {
    value: "organizations",
    label: "Organizations",
    audience:
      "hotels & hotel groups · hospitals · universities & schools · corporates · banks · real estate companies · restaurant chains · property management · tourism companies · large agencies · corporate sales teams",
    scenarios: [
      {
        title: "The hotel",
        body: "Stands in reception, the restaurant, the spa and every room. Each has its own identity, so management sees exactly which touchpoint drives reviews and which needs attention.",
      },
      {
        title: "The corporate sales team",
        body: "Every rep gets a branded card. Contact details stay consistent, branding stays on-message, and leads are captured centrally instead of dying in someone's pocket.",
      },
      {
        title: "The campus",
        body: "Departments, events and staff each get an identity, so visitors always reach current information instead of a printed sheet from last year.",
      },
    ],
  },
];

export function UseCases() {
  return (
    <Tabs defaultValue={GROUPS[0].value} className="mt-10">
      <TabsList className="mx-auto flex w-full max-w-2xl flex-wrap justify-center">
        {GROUPS.map((group) => (
          <TabsTrigger key={group.value} value={group.value}>
            {group.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {GROUPS.map((group) => (
        <TabsContent key={group.value} value={group.value} className="mt-8">
          <p className="mx-auto max-w-3xl text-center text-body-sm text-muted">
            {group.audience}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.scenarios.map((scenario) => (
              <article
                key={scenario.title}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-6 shadow-xs transition-shadow duration-base hover:shadow-md"
              >
                <h3 className="text-card-title text-foreground">{scenario.title}</h3>
                <p className="text-body-sm leading-relaxed text-foreground-secondary">
                  {scenario.body}
                </p>
              </article>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
