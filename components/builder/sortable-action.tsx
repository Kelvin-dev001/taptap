"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronDown } from "lucide-react";
import { Switch, IconButton, Input, Field } from "@/components/ui";
import { BlockIcon } from "@/components/profile/block-icon";
import { blockDef, defaultLabel } from "@/lib/blocks";
import type { Block } from "@/lib/profile";
import { cn } from "@/lib/cn";

export type EditorBlock = Block & { key: string };

/**
 * One draggable action row.
 *
 * dnd-kit rather than the HTML5 drag API because the latter cannot be operated
 * from a keyboard at all — it would fail WCAG 2.1.1 outright. The drag handle
 * here is a real button: focus it, press Space, move with the arrow keys, and
 * dnd-kit announces each move through its live region.
 *
 * Detail inputs stay collapsed until opened, so a page of ten actions is a
 * readable list rather than thirty visible fields (§12, progressive disclosure).
 */
export function SortableAction({
  block,
  expanded,
  onToggleExpanded,
  onChange,
  onRemove,
}: {
  block: EditorBlock;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<EditorBlock>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.key });

  const def = blockDef(block.type);
  const enabled = block.is_active !== false;
  const detailId = `action-detail-${block.key}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-surface",
        isDragging
          ? "z-10 border-primary shadow-lg"
          : "border-border shadow-xs",
        !enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${block.label || defaultLabel(block.type)}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <BlockIcon type={block.type} className="h-4 w-4 text-primary-strong" />
        </span>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={detailId}
          className="flex min-w-0 flex-1 flex-col items-start rounded text-left"
        >
          <span className="w-full truncate text-body-sm font-medium text-foreground">
            {block.label || defaultLabel(block.type)}
          </span>
          <span className="w-full truncate text-caption text-muted">
            {block.value || def?.placeholder || "Not set"}
          </span>
        </button>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-fast",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />

        <Switch
          checked={enabled}
          onCheckedChange={(v) => onChange({ is_active: v })}
          aria-label={`Show ${block.label || defaultLabel(block.type)} on the page`}
        />

        <IconButton label={`Remove ${block.label || defaultLabel(block.type)}`} variant="danger" onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      {expanded && (
        <div id={detailId} className="flex flex-col gap-3 border-t border-border p-3">
          <Field label="Button label">
            <Input
              value={block.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder={defaultLabel(block.type)}
            />
          </Field>

          {def?.needsValue && (
            <Field
              label={block.type === "mpesa" ? "Till or paybill number" : "Destination"}
              hint={
                block.type === "mpesa"
                  ? "Shown on the page for customers to enter. TapTap does not process the payment."
                  : undefined
              }
            >
              <Input
                value={block.value}
                inputMode={def.inputMode}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder={def.placeholder}
              />
            </Field>
          )}
        </div>
      )}
    </li>
  );
}
