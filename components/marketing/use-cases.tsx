"use client";

// Deep import: see the note in nav.tsx. This is the page's other client
// component, so the same barrel cost applies.
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
    shortLabel: "Individuals",
    audience:
      "CEOs · consultants · salespeople · lawyers · real estate agents · photographers · artists · freelancers · trainers · executives",
    scenarios: [
      {
        title: "The sales rep",
        body: "Grace meets someone at an expo. No digging through her bag for a card that ran out an hour ago. She taps her phone, and by the time they finish talking her number is saved, WhatsApp is open and her work is on the screen. That evening the lead is sitting in her dashboard.",
      },
      {
        title: "The realtor",
        body: "James hands his card to everyone who walks through the house he is showing. It opens that exact listing, with the photos, the directions and a button to book a second viewing. When it sells, he points the same card at the next one.",
      },
    ],
  },
  {
    value: "smes",
    label: "Small & medium businesses",
    shortLabel: "Businesses",
    audience:
      "restaurants · cafés · salons & spas · clinics · pharmacies · small hotels · retail shops · car dealers · gyms · workshops · agencies · offices",
    scenarios: [
      {
        title: "The restaurant",
        body: "There is a stand on every table. Guests tap to read the menu, then tap again to leave a review while the food is still good in their memory, before the bill even arrives. The manager can see which tables bring in the most.",
      },
      {
        title: "The salon",
        body: "A stand at reception picks up reviews and bookings while clients are waiting anyway. The owner keeps a card in her apron for walk-ins who want the price list and her WhatsApp.",
      },
      {
        title: "The clinic",
        body: "Reception keeps a stand for directions, opening hours and appointment requests. The phone rings less and fewer patients get lost on the way.",
      },
    ],
  },
  {
    value: "organizations",
    label: "Organizations",
    shortLabel: "Organizations",
    audience:
      "hotels & hotel groups · hospitals · universities & schools · corporates · banks · real estate companies · restaurant chains · property management · tourism companies · large agencies · corporate sales teams",
    scenarios: [
      {
        title: "The hotel",
        body: "Stands in reception, the restaurant, the spa and every room. Each one has its own page, so management can see at a glance which part of the hotel is bringing in reviews and which one has gone quiet.",
      },
      {
        title: "The corporate sales team",
        body: "Every rep carries a branded card. Everyone's details look the same, the branding stays right, and the leads land in one place instead of dying in somebody's jacket pocket.",
      },
      {
        title: "The campus",
        body: "Departments, events and staff each get their own page, so visitors always land on something current instead of a notice printed last year.",
      },
    ],
  },
];

export function UseCases() {
  return (
    <Tabs defaultValue={GROUPS[0].value} className="mt-10">
      <TabsList className="mx-auto flex w-full max-w-2xl justify-center">
        {GROUPS.map((group) => (
          <TabsTrigger
            key={group.value}
            value={group.value}
            className="min-w-0 flex-1 px-2 sm:flex-none sm:px-3"
          >
            <span className="truncate sm:hidden">{group.shortLabel}</span>
            <span className="hidden truncate sm:inline">{group.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {GROUPS.map((group) => (
        <TabsContent key={group.value} value={group.value} className="mt-8">
          <p className="mx-auto max-w-3xl text-balance text-center text-caption text-muted sm:text-body-sm">
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
