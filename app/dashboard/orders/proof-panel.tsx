"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Check, Pencil, TriangleAlert } from "lucide-react";
import { Button, Alert, Badge, Field, Select, Textarea } from "@/components/ui";
import {
  PROOF_STATUS_META,
  isProofStatus,
  fitProof,
  PRINT_WIDTH_PX,
  PRINT_HEIGHT_PX,
  type ProofFields,
} from "@/lib/proof";
import { CardFront } from "@/components/proof/card-front";
import {
  setProofPageAction,
  approveProofAction,
  requestRevisionAction,
  type ProofResult,
} from "./proof-actions";

const initial: ProofResult = {};

export type ProofUnit = {
  id: string;
  unit_index: number;
  proof_status: string | null;
  proof_page_id: string | null;
  proof_note: string | null;
  page_status: string | null;
  /** Rendered from the live profile, or from the frozen snapshot once approved. */
  fields: ProofFields | null;
  /** True once approved: what is shown is the snapshot, not the live profile. */
  frozen: boolean;
};

export type ProfileOption = { id: string; slug: string; title: string | null; published: boolean };

function SubmitButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} loadingText={busy}>
      {label}
    </Button>
  );
}

/**
 * The customer approving the front of their Premium card (D-029).
 *
 * Shown at the real proportions of the card, scaled down rather than reflowed,
 * because a proof that does not look like the object is not a proof. The
 * preview and the print output come from one component, so what is approved
 * here is what comes out of the printer.
 *
 * Approval is deliberately a little effortful: it freezes the design, and the
 * next thing that happens is somebody printing onto plastic.
 */
export function ProofPanel({
  units,
  profiles,
}: {
  units: ProofUnit[];
  profiles: ProfileOption[];
}) {
  if (units.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-3">
      <div>
        <h3 className="text-body-sm font-medium text-foreground">
          {units.length === 1 ? "The front of your card" : "The fronts of your cards"}
        </h3>
        <p className="text-caption text-muted">
          Printed from your Tap Profile. Nothing is printed until you approve it.
        </p>
      </div>
      {units.map((unit) => (
        <ProofUnitRow
          key={unit.id}
          unit={unit}
          profiles={profiles}
          showIndex={units.length > 1}
        />
      ))}
    </div>
  );
}

function ProofUnitRow({
  unit,
  profiles,
  showIndex,
}: {
  unit: ProofUnit;
  profiles: ProfileOption[];
  showIndex: boolean;
}) {
  const [chooseState, choose] = useActionState(setProofPageAction, initial);
  const [approveState, approve] = useActionState(approveProofAction, initial);
  const [reviseState, revise] = useActionState(requestRevisionAction, initial);
  const [asking, setAsking] = React.useState(false);

  const status = isProofStatus(unit.proof_status) ? unit.proof_status : "pending";
  const meta = PROOF_STATUS_META[status];
  const published = unit.page_status === "published";
  const fitted = unit.fields ? fitProof(unit.fields) : null;

  const result = chooseState.error
    ? chooseState
    : approveState.error
      ? approveState
      : reviseState.error
        ? reviseState
        : chooseState.success
          ? chooseState
          : approveState.success
            ? approveState
            : reviseState;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body-sm font-medium text-foreground">
          {showIndex ? `Card ${unit.unit_index}` : "Your card"}
        </span>
        <Badge variant={meta.tone === "info" ? "brand" : meta.tone}>{meta.customerLabel}</Badge>
      </div>

      {unit.fields ? (
        <>
          {/* Scaled, never reflowed: the layout is identical to the print. */}
          <div
            className="overflow-hidden rounded-lg border border-border shadow-sm"
            style={{ width: 320, height: Math.round((320 / PRINT_WIDTH_PX) * PRINT_HEIGHT_PX) }}
          >
            <div
              style={{
                width: PRINT_WIDTH_PX,
                height: PRINT_HEIGHT_PX,
                transform: `scale(${320 / PRINT_WIDTH_PX})`,
                transformOrigin: "top left",
              }}
            >
              <CardFront fields={unit.fields} />
            </div>
          </div>

          {fitted?.anyTruncated && (
            <Alert tone="warning">
              <span className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Some text was too long for the card and has been shortened. Edit your profile if
                you would rather it read differently.
              </span>
            </Alert>
          )}
        </>
      ) : (
        <p className="text-body-sm text-muted">{meta.description}.</p>
      )}

      {unit.frozen && (
        <p className="text-caption text-muted">
          This is the version you approved. Editing your profile from now on will not change the
          printed card.
        </p>
      )}

      {unit.proof_note && status === "revision_requested" && (
        <Alert tone="info" title="You asked for">
          {unit.proof_note}
        </Alert>
      )}

      {/* Choosing a profile. Also offered when changes were requested, since the
          usual fix is a different profile or an edited one. */}
      {status !== "approved" && (
        <form action={choose} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="unitId" value={unit.id} />
          <Field
            label={unit.proof_page_id ? "Use a different profile" : "Which profile goes on it"}
            className="min-w-[14rem] flex-1"
          >
            <Select name="pageId" defaultValue={unit.proof_page_id ?? ""} required>
              <option value="" disabled>
                Choose a profile
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || `/${p.slug}`}
                  {p.published ? "" : " (draft)"}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton label="Use this" busy="Saving…" />
        </form>
      )}

      {status === "awaiting_approval" && unit.proof_page_id && (
        <div className="flex flex-col gap-2">
          {!published && (
            <Alert tone="warning">
              Publish this profile before approving. A card that opens an unpublished page
              arrives dead.{" "}
              <Link href="/dashboard/profiles" className="underline">
                Go to profiles
              </Link>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <form action={approve}>
              <input type="hidden" name="unitId" value={unit.id} />
              <Button type="submit" size="sm" disabled={!published}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Approve this front
              </Button>
            </form>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAsking((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Request changes
            </Button>
          </div>

          {asking && (
            <form action={revise} className="flex flex-col gap-2">
              <input type="hidden" name="unitId" value={unit.id} />
              <Field label="What needs to change" required>
                <Textarea name="note" rows={2} required />
              </Field>
              <div>
                <SubmitButton label="Send" busy="Sending…" />
              </div>
            </form>
          )}
        </div>
      )}

      {result.error && <Alert tone="danger">{result.error}</Alert>}
      {result.success && <Alert tone="success">{result.success}</Alert>}
    </div>
  );
}
