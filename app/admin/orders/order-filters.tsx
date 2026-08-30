"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select, Field } from "@/components/ui";
import { ORDER_STATUSES, ORDER_STATUS_META } from "@/lib/orders";

/**
 * Filters live in the URL, following the convention the lead inbox set: a view
 * is then shareable ("look at TT041"), survives a refresh, and can be linked to
 * from the overview's metric tiles.
 *
 * Search is debounced rather than submitted, because typing a customer's name
 * and waiting for a button is not how anyone uses a search box — but each
 * keystroke hitting the database is not either.
 */
export function OrderFilters({
  status,
  paid,
  q,
}: {
  status?: string;
  paid?: string;
  q?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(q ?? "");

  const push = React.useCallback(
    (over: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(over)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Any filter change invalidates the current page number.
      next.delete("page");
      const qs = next.toString();
      router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
    },
    [router, searchParams],
  );

  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (query === current) return;
    const timer = setTimeout(() => push({ q: query || undefined }), 300);
    return () => clearTimeout(timer);
  }, [query, push, searchParams]);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field label="Search" className="min-w-[14rem] flex-1">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number, business, contact…"
            aria-label="Search orders"
            className="pl-9"
          />
        </div>
      </Field>

      <Field label="Stage" className="w-48">
        <Select
          value={status ?? ""}
          onChange={(e) => push({ status: e.target.value || undefined })}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_META[s].label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Payment" className="w-40">
        <Select
          value={paid ?? ""}
          onChange={(e) => push({ paid: e.target.value || undefined })}
          aria-label="Filter by payment"
        >
          <option value="">Any</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Not paid</option>
        </Select>
      </Field>
    </div>
  );
}
