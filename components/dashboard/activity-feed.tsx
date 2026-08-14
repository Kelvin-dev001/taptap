import { MessageCircle, Star, Phone, Mail, MapPin, Contact, UserPlus, MousePointerClick } from "lucide-react";
import { activityPhrase, relativeTime, type ActivityItem } from "@/lib/metrics";
import { EmptyState } from "@/components/ui";

/**
 * What actually happened, most recent first.
 *
 * Every row states an OBSERVED action. A click on a Google review button reads
 * "Review link opened", never "review left" — the reference mockup's phrasing
 * would claim knowledge the platform does not have (CLAUDE.md §15).
 */
function iconFor(item: ActivityItem) {
  if (item.kind === "lead") return UserPlus;
  if (item.type === "download") return Contact;
  const label = item.label.toLowerCase();
  if (label.includes("whatsapp")) return MessageCircle;
  if (label.includes("review")) return Star;
  if (label.includes("call") || label.includes("phone")) return Phone;
  if (label.includes("email") || label.includes("mail")) return Mail;
  if (label.includes("direction") || label.includes("map")) return MapPin;
  return MousePointerClick;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Lead submissions, saved contacts and button clicks will appear here as customers use your profiles."
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const Icon = iconFor(item);
        return (
          <li
            key={`${item.ts}-${i}`}
            className="flex items-start gap-3 border-b border-border py-3 last:border-0 last:pb-0 first:pt-0"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
              <Icon className="h-4 w-4 text-primary-strong" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-sm font-medium text-foreground">
                {activityPhrase(item)}
                {item.kind === "lead" ? `: ${item.label}` : ` — ${item.label}`}
              </span>
              <span className="truncate text-caption text-muted">
                {item.page_title || `/${item.page_slug}`}
                {" · "}
                <time dateTime={item.ts}>{relativeTime(item.ts)}</time>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
