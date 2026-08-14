"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, CornerDownLeft } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";

export type PaletteProfile = { id: string; slug: string; title: string | null };

type Entry = { id: string; label: string; sub?: string; href: string; group: string };

/**
 * ⌘K search over the workspace: real Tap Profiles plus the navigation
 * destinations. It only ever searches data the account actually has — an empty
 * workspace shows nothing rather than invented suggestions.
 *
 * Implemented as a combobox with aria-activedescendant: focus stays in the
 * input while the arrow keys move a virtual cursor, which is the pattern screen
 * readers expect and keeps typing uninterrupted.
 */
export function CommandPalette({ profiles }: { profiles: PaletteProfile[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const listId = React.useId();

  const entries = React.useMemo<Entry[]>(() => {
    const nav: Entry[] = NAV_ITEMS.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      href: n.href,
      group: "Go to",
    }));
    const pages: Entry[] = profiles.map((p) => ({
      id: `page:${p.id}`,
      label: p.title || `/${p.slug}`,
      sub: `/${p.slug}`,
      href: `/dashboard/profiles/${p.id}/edit`,
      group: "Tap Profiles",
    }));
    return [...pages, ...nav];
  }, [profiles]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 8);
    return entries
      .filter((e) => `${e.label} ${e.sub ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [entries, query]);

  // Cursor resets where the query changes (below), not in an effect — an effect
  // here would render once with a stale highlight before correcting itself.
  function updateQuery(value: string) {
    setQuery(value);
    setCursor(0);
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    setQuery("");
    router.push(entry.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  }

  let lastGroup = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3",
            "text-body-sm text-muted transition-colors duration-fast hover:border-border-strong",
            "w-full max-w-xs",
          )}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="hidden rounded border border-border bg-surface-sunken px-1.5 py-0.5 text-[10px] text-muted sm:inline">
            ⌘K
          </kbd>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2",
            "overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
            "data-[state=open]:animate-scale-in",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search the workspace</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Find a Tap Profile or jump to a section. Use the arrow keys to move and Enter to open.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {/* autoFocus is correct here: the dialog exists to be typed into,
                and Radix restores focus to the trigger on close. */}
            <input
              autoFocus
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search profiles and sections…"
              aria-label="Search profiles and sections"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results[cursor] ? `${listId}-${results[cursor].id}` : undefined}
              className="h-12 w-full bg-transparent text-body text-foreground outline-none placeholder:text-muted"
            />
          </div>

          <ul id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-body-sm text-muted">
                Nothing matches “{query}”.
              </li>
            )}
            {results.map((entry, i) => {
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;
              return (
                <React.Fragment key={entry.id}>
                  {showGroup && (
                    <li aria-hidden="true" className="px-2.5 pb-1 pt-2 text-caption text-muted">
                      {entry.group}
                    </li>
                  )}
                  <li
                    id={`${listId}-${entry.id}`}
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-body-sm",
                      i === cursor ? "bg-surface-sunken text-foreground" : "text-foreground-secondary",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    {entry.sub && <span className="shrink-0 text-caption text-muted">{entry.sub}</span>}
                    {i === cursor && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
