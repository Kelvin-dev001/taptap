"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  Button,
} from "@/components/ui";
import { BLOCK_DEFS, BLOCK_GROUPS } from "@/lib/blocks";
import { BlockIcon } from "@/components/profile/block-icon";
import type { BlockType } from "@/lib/profile";

/**
 * "Add action" picker.
 *
 * Grouped rather than presented as one long list, with the Kenya-first actions
 * (WhatsApp, Google review, M-Pesa, Directions) at the top — CLAUDE.md §22.
 * Progressive disclosure: an owner picks WHAT the action is here, and fills in
 * the detail in the row afterwards, so Simple Mode never shows every setting at
 * once (§12).
 */
export function BlockPicker({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = React.useState(false);

  function choose(type: BlockType) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add action
        </Button>
      </DialogTrigger>

      <DialogContent
        title="Add an action"
        description="Pick what this button should do. You can change the details afterwards."
        className="max-w-lg"
      >
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {BLOCK_GROUPS.map((group) => {
            const items = BLOCK_DEFS.filter((b) => b.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-label uppercase text-muted">{group}</h3>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((def) => (
                    <li key={def.type}>
                      <button
                        type="button"
                        onClick={() => choose(def.type)}
                        className="flex w-full items-start gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-sunken"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft">
                          <BlockIcon
                            type={def.type}
                            className="h-3.5 w-3.5 text-primary-strong"
                          />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-body-sm font-medium text-foreground">
                            {def.label}
                          </span>
                          <span className="text-caption text-muted">{def.description}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
