"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogFooter, DialogClose, Button, buttonVariants } from "@/components/ui";
import { BUNDLED_MONTHS, HARDWARE_PRICE_KES, formatKes } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * One dialog for every action a draft cannot do yet.
 *
 * Publish, share, download the QR and claim a card all arrive here, because
 * they all have the same answer and maintaining four explanations means three of
 * them eventually going stale. The `reason` prop is the only part that varies,
 * and it comes from `publishBlockedReason` so the wording is decided in one
 * tested place rather than at each call site.
 *
 * Deliberately not framed as an upsell. Nothing is being withheld to create
 * pressure: the page genuinely has no card pointing at it, and the dialog says
 * what buying one does rather than what not buying one costs.
 */
export function ActivateDialog({
  open,
  onOpenChange,
  reason,
  title = "Activate to publish",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From publishBlockedReason(). Falls back to the first-purchase wording. */
  reason?: string | null;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={
          reason ??
          "This profile is not live yet. Activate it with a Smart Card or Smart Stand to publish it."
        }
      >
        <ul className="flex flex-col gap-2 text-body-sm text-foreground-secondary">
          <li>Your page goes live at your own link, and your card points at it.</li>
          <li>Enquiry capture and the full report switch on.</li>
          <li>
            From {formatKes(HARDWARE_PRICE_KES.card)}, including {BUNDLED_MONTHS} months.
          </li>
        </ul>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Keep editing</Button>
          </DialogClose>
          <Link href="/dashboard/checkout" className={cn(buttonVariants())}>
            Activate
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
