import { Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

/**
 * An illustration of the analytics screen.
 *
 * Every number here is invented, so it is labelled as an example twice — once
 * in the badge on the panel and once beneath it. §15 draws a hard line between
 * measuring and claiming, and a marketing page showing plausible figures with
 * no label is the most common way that line gets crossed.
 *
 * The bars are proportions, not data. They exist to show the shape of the
 * screen a customer would get.
 */
const TOP_ACTIONS = [
  { label: "WhatsApp", share: 100 },
  { label: "Save contact", share: 74 },
  { label: "Google review", share: 58 },
  { label: "Directions", share: 31 },
  { label: "Instagram", share: 18 },
];

const SOURCES = [
  { label: "NFC tap", share: 62 },
  { label: "QR scan", share: 27 },
  { label: "Direct link", share: 11 },
];

export function AnalyticsPreview() {
  return (
    <Section id="analytics" label="Analytics" tone="sunken">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <SectionHeading eyebrow="Analytics" title="Know what's actually working." />
          <div className="mt-6 flex max-w-xl flex-col gap-4 text-body text-foreground-secondary">
            <p>
              Most marketing is a guess. TapTap counts every interaction — how many people
              tapped, what they pressed, which phone they used and when they came.
            </p>
            <p>
              See which stand earns the most reviews, which staff card brings in leads, and
              which link nobody touches. Then change it — instantly, without reprinting
              anything.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-label uppercase tracking-[0.06em] text-muted">
                Last 30 days
              </p>
              <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-caption text-muted">
                Example
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Taps & scans", "1,284"],
                ["Clicked something", "742"],
                ["Contacts saved", "196"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-surface-sunken p-3">
                  <p className="text-caption text-muted">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <Bars title="Most-clicked actions" rows={TOP_ACTIONS} />
            <Bars title="How visitors arrived" rows={SOURCES} />
          </div>

          <p className="mt-3 text-caption text-muted">
            Illustration only. The figures above are made up to show the layout — your
            dashboard shows your own numbers.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

function Bars({ title, rows }: { title: string; rows: { label: string; share: number }[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-caption text-muted">{title}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-caption text-foreground-secondary">
              {row.label}
            </span>
            <span
              aria-hidden="true"
              className="h-2 rounded-full bg-primary"
              style={{ width: `${row.share}%` }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
