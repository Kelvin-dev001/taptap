"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Users, Search, History, StickyNote } from "lucide-react";
import { Card, EmptyState, Input, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { StatusBadge } from "./status-badge";
import { LeadDetail } from "./lead-detail";
import {
  LEAD_STATUSES,
  STATUS_META,
  matchesQuery,
  leadDisplayName,
  type Lead,
  type LeadCounts,
  type LeadStatus,
} from "@/lib/leads";
import { relativeTime } from "@/lib/metrics";
import { cn } from "@/lib/cn";

/**
 * The lead inbox.
 *
 * Status filtering lives in the URL so a view is shareable and survives a
 * refresh; free-text search stays local because the list is already loaded and
 * capped, and a round trip per keystroke would be slower without being more
 * correct.
 */
export function LeadInbox({
  leads,
  counts,
  activeStatus,
}: {
  leads: Lead[];
  counts: LeadCounts;
  activeStatus?: LeadStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Lead | null>(null);
  const [open, setOpen] = React.useState(false);

  const visible = React.useMemo(
    () => leads.filter((l) => matchesQuery(l, query)),
    [leads, query],
  );

  function setStatusFilter(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("status");
    else params.set("status", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function openLead(lead: Lead) {
    setSelected(lead);
    setOpen(true);
  }

  // Keep the open drawer showing fresh data after a status change refreshes the
  // server component, rather than the snapshot captured when it was opened.
  const current = selected ? (leads.find((l) => l.id === selected.id) ?? selected) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeStatus ?? "all"} onValueChange={setStatusFilter}>
          <TabsList aria-label="Filter by status">
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            {LEAD_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {STATUS_META[s].label} ({counts.by_status[s] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, message…"
            aria-label="Search leads"
            className="pl-9"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={leads.length === 0 ? "No leads in this period" : "Nothing matches your search"}
          description={
            leads.length === 0
              ? "Turn on lead capture in a profile's editor and submissions will land here."
              : "Try a different name, number or word from the message."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((lead) => {
            const name = leadDisplayName(lead);
            return (
              <li key={lead.id}>
                <Card padding="none" interactive className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => openLead(lead)}
                    className="flex w-full flex-col gap-1.5 p-3 text-left"
                    aria-label={`Open enquiry from ${name}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-card-title text-foreground">{name}</span>
                        {lead.repeat_count > 0 && (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 text-caption text-primary-strong"
                            title={`${lead.repeat_count} previous enquiries from this contact`}
                          >
                            <History className="h-3 w-3" aria-hidden="true" />
                            {lead.repeat_count}
                          </span>
                        )}
                        {lead.note && (
                          <StickyNote
                            className="h-3 w-3 shrink-0 text-muted"
                            aria-label="Has a note"
                          />
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={lead.status} />
                        <time
                          dateTime={lead.created_at}
                          className="text-caption text-muted"
                        >
                          {relativeTime(lead.created_at)}
                        </time>
                      </span>
                    </div>

                    {lead.message && (
                      <p className={cn("line-clamp-2 text-body-sm text-foreground-secondary")}>
                        {lead.message}
                      </p>
                    )}

                    <span className="flex flex-wrap items-center gap-x-3 text-caption text-muted">
                      {lead.phone && <span>{lead.phone}</span>}
                      {lead.email && <span className="truncate">{lead.email}</span>}
                      <span className="truncate">{lead.page_title || `/${lead.page_slug}`}</span>
                    </span>
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Keyed so opening a different lead remounts with its own draft note.
          Kept mounted after close so the drawer can animate out. */}
      {current && (
        <LeadDetail key={current.id} lead={current} open={open} onOpenChange={setOpen} />
      )}
    </div>
  );
}
