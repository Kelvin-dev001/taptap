"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Printer, Image as ImageIcon, RotateCcw } from "lucide-react";
import { Button, Alert, Badge, buttonVariants } from "@/components/ui";
import { PROOF_STATUS_META, isProofStatus } from "@/lib/proof";
import { cn } from "@/lib/cn";
import { resendProofAction, type OpsResult } from "@/app/admin/order-actions";

const initial: OpsResult = {};

export type ProofRow = {
  id: string;
  unit_index: number;
  proof_status: string | null;
  proof_note: string | null;
  page_slug: string | null;
  page_title: string | null;
  page_status: string | null;
  approved_at: string | null;
};

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" loading={pending} loadingText="Sending…">
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Send back for approval
    </Button>
  );
}

/**
 * Where each Premium front has got to, and how to print it (D-029).
 *
 * Printing is offered only once the customer has approved, because an approved
 * proof is the only version anyone agreed to. The print surfaces still render
 * an unapproved proof — staff sometimes need to look — but they say loudly that
 * it is not approved, rather than being hidden and worked around.
 */
export function OrderProofs({ orderId, units }: { orderId: string; units: ProofRow[] }) {
  const [state, action] = useActionState(resendProofAction, initial);

  if (units.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {units.map((unit) => {
        const status = isProofStatus(unit.proof_status) ? unit.proof_status : "pending";
        const meta = PROOF_STATUS_META[status];
        const approved = status === "approved";

        return (
          <div key={unit.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body-sm font-medium text-foreground">
                Card {unit.unit_index}
              </span>
              <Badge variant={meta.tone === "info" ? "brand" : meta.tone} dot>
                {meta.label}
              </Badge>
            </div>

            <p className="text-caption text-muted">
              {unit.page_title || (unit.page_slug ? `/${unit.page_slug}` : "No profile chosen")}
              {unit.page_status && unit.page_status !== "published" ? " · DRAFT" : ""}
              {unit.approved_at
                ? ` · approved ${new Date(unit.approved_at).toLocaleDateString()}`
                : ""}
            </p>

            {unit.proof_note && status === "revision_requested" && (
              <Alert tone="warning" title="Customer asked for">
                {unit.proof_note}
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/print/proof?unit=${unit.id}`}
                prefetch={false}
                target="_blank"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print front
              </Link>
              <Link
                href={`/api/proof/${unit.id}`}
                prefetch={false}
                target="_blank"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                300dpi PNG
              </Link>

              {status === "revision_requested" && (
                <form action={action}>
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="orderId" value={orderId} />
                  <ResendButton />
                </form>
              )}
            </div>

            {!approved && (
              <p className="text-caption text-muted">
                Not approved yet. Anything printed now is a version the customer has not agreed
                to.
              </p>
            )}
          </div>
        );
      })}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </div>
  );
}
