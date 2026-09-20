"use client";

import * as React from "react";
import { useActionState } from "react";
import { Nfc, Check, TriangleAlert, Lock, LockOpen } from "lucide-react";
import { Button, Input, Field, Alert, Badge, Card, SwitchField } from "@/components/ui";
import { parseScan, chipUrlFor, encodeBlockedReason } from "@/lib/stock";
import {
  encodeCardAction,
  lookupCardAction,
  type EncodeResult,
  type EncodableCard,
} from "@/app/admin/encode-actions";
import { ScanButton, useBrowserApi } from "@/components/ops/scanning";

const initial: EncodeResult = {};

/** Where the write got to. Each step can fail, and each fails differently. */
type Phase =
  | { at: "idle" }
  | { at: "writing" }
  | { at: "verifying" }
  | { at: "locking" }
  | { at: "written"; readBack: string; locked: boolean }
  | { at: "failed"; message: string };

/**
 * Writing a blank chip, verifying it, and locking it (Sprint 8b, H).
 *
 * The order of operations is the whole design, because the last step is
 * irreversible. Write, then read back and compare, and only then lock. Locking
 * first — or locking without reading back — turns a chip that took a mangled
 * write into a permanently dead card that looks perfectly fine until a customer
 * taps it.
 *
 * The card in hand identifies ITSELF. Staff scan the QR printed on its back or
 * type its serial, and we write that card's own token. Working down a list in
 * serial order would be faster and wrong: blanks are physically
 * indistinguishable except for the serial printed on them, so "the next one"
 * is not a thing anyone can pick up reliably.
 *
 * Chrome on Android only, which is what the workshop uses. Everywhere else this
 * says so and stops, rather than rendering controls that cannot work.
 */
export function Encoder({
  batchCode,
  siteUrl,
  canEncode,
}: {
  batchCode: string;
  /** Recomputed on the server for the write; shown so staff can see it. */
  siteUrl: string;
  /** False on any deployment that is not the live site. */
  canEncode: boolean;
}) {
  const nfcSupported = useBrowserApi("NDEFReader");
  const [state, action] = useActionState(encodeCardAction, initial);

  const [scanned, setScanned] = React.useState("");
  const [card, setCard] = React.useState<EncodableCard | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>({ at: "idle" });
  // Off by default. Test mode writes and verifies but does not lock, so a card
  // can be reused while staff learn the flow — useful exactly once per person,
  // and dangerous if it were the default, because an unlocked card ships
  // rewritable by anyone with a phone.
  const [testMode, setTestMode] = React.useState(false);

  // Clear the bench after a successful record, so the next card starts clean
  // rather than inheriting the last one's state. Adjusted during render rather
  // than in an effect (the cascading-render pattern the lint rule objects to).
  const [seenSuccess, setSeenSuccess] = React.useState(state.success);
  if (state.success !== seenSuccess) {
    setSeenSuccess(state.success);
    if (state.success) {
      setCard(null);
      setScanned("");
      setPhase({ at: "idle" });
    }
  }

  async function lookup(raw: string) {
    setLookupError(null);
    setCard(null);
    setPhase({ at: "idle" });

    const parsed = parseScan(raw);
    if (parsed.kind === "unknown") {
      setLookupError("That is not a card. Scan the QR on the back or type the serial.");
      return;
    }

    const found = await lookupCardAction(raw);
    if (!found) {
      setLookupError(
        parsed.kind === "serial"
          ? `No card with serial ${parsed.serial}. Check the digits.`
          : "That card is not in the system. It may be from a batch that was never received.",
      );
      return;
    }
    setCard(found);
  }

  /**
   * Write, read back, compare, lock.
   *
   * Every failure stops the sequence where it happened and says which step it
   * was, because the recovery differs: a failed write is a retry, a mismatch is
   * a defective chip, and a failed lock leaves a working but rewritable card
   * that must be recorded honestly rather than claimed as locked.
   */
  async function writeChip(target: EncodableCard) {
    const expected = chipUrlFor(siteUrl, target.token);
    setPhase({ at: "writing" });

    try {
      const Reader = (window as unknown as {
        NDEFReader: new () => {
          write: (m: { records: { recordType: string; data: string }[] }) => Promise<void>;
          scan: () => Promise<void>;
          makeReadOnly?: () => Promise<void>;
          onreading:
            | ((e: { message: { records: { recordType: string; data?: DataView }[] } }) => void)
            | null;
        };
      }).NDEFReader;

      const writer = new Reader();
      await writer.write({ records: [{ recordType: "url", data: expected }] });

      // --- Read back. The point of the whole exercise. ------------------------
      setPhase({ at: "verifying" });
      const readBack = await new Promise<string | null>((resolve) => {
        const reader = new Reader();
        const timer = setTimeout(() => resolve(null), 10_000);
        reader
          .scan()
          .then(() => {
            reader.onreading = (event) => {
              for (const record of event.message.records) {
                if (record.recordType !== "url" || !record.data) continue;
                clearTimeout(timer);
                resolve(new TextDecoder().decode(record.data));
                return;
              }
              clearTimeout(timer);
              resolve(null);
            };
          })
          .catch(() => {
            clearTimeout(timer);
            resolve(null);
          });
      });

      if (readBack === null) {
        setPhase({
          at: "failed",
          message: "Could not read the chip back. Hold it still and try again. Do not lock it.",
        });
        return;
      }
      if (readBack.trim() !== expected) {
        setPhase({
          at: "failed",
          message: `The chip reads "${readBack}" but should carry "${expected}". Write it off as defective rather than shipping it.`,
        });
        return;
      }

      // --- Lock. Irreversible. ------------------------------------------------
      let locked = false;
      if (!testMode) {
        setPhase({ at: "locking" });
        const locker = new Reader();
        if (typeof locker.makeReadOnly === "function") {
          try {
            await locker.makeReadOnly();
            locked = true;
          } catch {
            // Recorded as unlocked rather than failing the card. The chip works;
            // it is simply rewritable, and the shelf has to know which is which.
            locked = false;
          }
        }
      }

      setPhase({ at: "written", readBack, locked });

      // Record it. The form carries the read-back so the server can refuse a
      // write it can see did not land.
      const fd = new FormData();
      fd.set("tagId", target.id);
      fd.set("readBack", readBack);
      fd.set("locked", String(locked));
      React.startTransition(() => action(fd));
    } catch {
      setPhase({
        at: "failed",
        message: "The chip would not take the write. Move it on the phone and try again.",
      });
    }
  }

  if (!canEncode) {
    return (
      <Alert tone="danger" title="Encoding is disabled on this deployment">
        A chip encoded from anywhere but the live site is locked to the wrong URL for the
        life of the card. Open this page on {" "}
        <span className="font-medium">the production site</span> to encode.
      </Alert>
    );
  }

  if (!nfcSupported) {
    return (
      <Alert tone="warning" title="This browser cannot write NFC chips">
        Web NFC needs <span className="font-medium">Chrome on Android</span>, over HTTPS.
        Open this page on the workshop phone.
      </Alert>
    );
  }

  const blocked = card ? encodeBlockedReason(card) : null;

  return (
    <div className="flex flex-col gap-4">
      <SwitchField
        label="Test mode"
        description="Writes and verifies without locking, so the card can be reused. Never ship a card encoded in test mode."
        checked={testMode}
        onCheckedChange={setTestMode}
      />

      <Card padding="md" className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">1. Which card are you holding?</h2>
        <p className="text-body-sm text-muted">
          Scan the QR on the back, or type the serial printed under it. Batch {batchCode}.
        </p>

        <ScanButton onResult={(v) => { setScanned(v); void lookup(v); }} label="Scan the card" />

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Serial" className="w-44">
            <Input
              value={scanned}
              onChange={(e) => setScanned(e.target.value)}
              placeholder="S-000123"
              autoComplete="off"
            />
          </Field>
          <Button type="button" size="sm" variant="secondary" onClick={() => void lookup(scanned)}>
            Find card
          </Button>
        </div>

        {lookupError && <Alert tone="danger">{lookupError}</Alert>}
      </Card>

      {card && (
        <Card padding="md" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-section-title text-foreground">
              2. Write {card.serial ?? "this card"}
            </h2>
            {card.variant && <Badge variant="neutral">{card.variant}</Badge>}
          </div>

          <p className="break-all rounded-lg bg-surface-sunken px-3 py-2 font-mono text-caption text-foreground">
            {chipUrlFor(siteUrl, card.token)}
          </p>

          {blocked ? (
            <Alert tone="warning">{blocked}</Alert>
          ) : (
            <>
              <Button
                type="button"
                onClick={() => void writeChip(card)}
                disabled={phase.at === "writing" || phase.at === "verifying" || phase.at === "locking"}
                loading={phase.at === "writing" || phase.at === "verifying" || phase.at === "locking"}
                loadingText={
                  phase.at === "verifying"
                    ? "Reading it back…"
                    : phase.at === "locking"
                      ? "Locking…"
                      : "Hold the card to the phone…"
                }
              >
                <Nfc className="h-4 w-4" aria-hidden="true" />
                Write and lock
              </Button>

              {phase.at === "written" && (
                <Alert tone={phase.locked ? "success" : "warning"}>
                  <span className="flex items-center gap-1.5">
                    {phase.locked ? (
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {phase.locked
                      ? "Written, verified and locked."
                      : "Written and verified, but NOT locked. This card is still rewritable."}
                  </span>
                </Alert>
              )}

              {phase.at === "failed" && (
                <Alert tone="danger" title="Stopped before locking">
                  <span className="flex items-start gap-1.5">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {phase.message}
                  </span>
                </Alert>
              )}
            </>
          )}

        </Card>
      )}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && (
        <Alert tone="success">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {state.success}
          </span>
        </Alert>
      )}
    </div>
  );
}
