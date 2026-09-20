"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Nfc, Undo2, Check } from "lucide-react";
import { Button, Input, Field, Alert, Badge } from "@/components/ui";
import { assignCardAction, unassignCardAction, type OpsResult } from "@/app/admin/order-actions";

const initial: OpsResult = {};

export type AssignableUnit = {
  id: string;
  unit_index: number;
  serial: string | null;
  variant: string | null;
  boundAt: string | null;
};

/**
 * Scanning printed cards onto an order (D-026).
 *
 * Three ways in, because a workshop is not a laboratory. The camera is fastest
 * and is what staff will use nine times out of ten. Tapping the chip is the only
 * way to identify a LEGACY card, which was encoded before anything was printed
 * on the back. Typing the serial always works, and is what is left when the
 * light is bad, the camera is busy, or the phone is someone else's.
 *
 * The typed path is not a fallback bolted on at the end — it is the one that is
 * always rendered, with the other two added when the browser admits to
 * supporting them. A scanner that silently does nothing on an unsupported device
 * is worse than no scanner, because the staff member does not know whether to
 * wait.
 */
export function AssignCards({
  orderId,
  units,
  locked,
}: {
  orderId: string;
  units: AssignableUnit[];
  /** Once it is in the post, nothing here can change what is in the parcel. */
  locked: boolean;
}) {
  const bound = units.filter((u) => u.serial).length;

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col divide-y divide-border">
        {units.map((unit) => (
          <li key={unit.id} className="py-3 first:pt-0 last:pb-0">
            <UnitRow orderId={orderId} unit={unit} total={units.length} locked={locked} />
          </li>
        ))}
      </ol>

      {units.length > 0 && (
        <p className="text-caption text-muted" aria-live="polite">
          {bound} of {units.length} {units.length === 1 ? "card" : "cards"} assigned.
          {bound < units.length && " Every card must be scanned before this can be packed."}
        </p>
      )}
    </div>
  );
}

function UnitRow({
  orderId,
  unit,
  total,
  locked,
}: {
  orderId: string;
  unit: AssignableUnit;
  total: number;
  locked: boolean;
}) {
  const [assignState, assign] = useActionState(assignCardAction, initial);
  const [unassignState, unassign] = useActionState(unassignCardAction, initial);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const label = `Unit ${unit.unit_index} of ${total}`;

  if (unit.serial) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            <span className="font-mono">{unit.serial}</span>
            {unit.variant && <Badge variant="neutral">{unit.variant}</Badge>}
          </p>
          <p className="text-caption text-muted">{label}</p>
        </div>

        {!locked && (
          <form action={unassign}>
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="orderId" value={orderId} />
            <UndoButton />
          </form>
        )}

        {unassignState.error && (
          <Alert tone="danger" className="w-full">
            {unassignState.error}
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={assign} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="unitId" value={unit.id} />
        <input type="hidden" name="orderId" value={orderId} />

        <Field label={label} hint="Scan the QR, tap the chip, or type the serial" className="flex-1 min-w-[12rem]">
          <Input
            ref={inputRef}
            name="scanned"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="S-000123"
            autoComplete="off"
            spellCheck={false}
            disabled={locked}
          />
        </Field>

        <AssignButton disabled={locked || !value.trim()} />
      </form>

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <ScanButton onResult={(v) => { setValue(v); inputRef.current?.focus(); }} />
          <TapButton onResult={(v) => { setValue(v); inputRef.current?.focus(); }} />
        </div>
      )}

      {assignState.error && <Alert tone="danger">{assignState.error}</Alert>}
    </div>
  );
}

function AssignButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} loadingText="Assigning…" disabled={disabled}>
      Assign
    </Button>
  );
}

function UndoButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" loading={pending} loadingText="Undoing…">
      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
      Undo
    </Button>
  );
}

/**
 * Does this browser have the API?
 *
 * `useSyncExternalStore` rather than an effect that calls setState. The answer
 * never changes for the life of the page, so there is nothing to subscribe to —
 * what this buys is a server snapshot of `false` and a client snapshot read
 * during render, which is hydration-safe and does not trigger the cascading
 * re-render that setState-in-an-effect does.
 */
const noopSubscribe = () => () => {};

function useBrowserApi(name: string): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => name in window,
    // On the server there is no window, and guessing "supported" would render a
    // control that vanishes on hydration.
    () => false,
  );
}

/**
 * Camera scanning through the browser's own BarcodeDetector.
 *
 * No library. Staff fulfil on Android Chrome, where this is native, and adding a
 * scanning dependency to serve a browser nobody here uses would be a permanent
 * bundle cost for a hypothetical (§3: any dependency needs a justification).
 *
 * The button renders only where the API exists, so it is never a control that
 * does nothing.
 */
function ScanButton({ onResult }: { onResult: (value: string) => void }) {
  const supported = useBrowserApi("BarcodeDetector");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Whatever happens — a scan, an error, the panel closing, the staff member
  // navigating away — the camera light goes out. A page that keeps a camera open
  // after it has finished with it is a page nobody trusts twice.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = (window as unknown as {
        BarcodeDetector: new (o: { formats: string[] }) => {
          detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
        };
      }).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            onResult(codes[0].rawValue);
            stop();
            return;
          }
        } catch {
          // A frame that will not decode is normal. Keep looking.
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setError("Could not open the camera. Type the serial instead.");
      stop();
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2">
      {!scanning ? (
        <Button type="button" size="sm" variant="secondary" onClick={start}>
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          Scan QR
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <video
            ref={videoRef}
            className="w-full max-w-xs rounded-lg border border-border"
            muted
            playsInline
          />
          <Button type="button" size="sm" variant="secondary" onClick={stop}>
            Stop scanning
          </Button>
        </div>
      )}
      {error && <Alert tone="warning">{error}</Alert>}
    </div>
  );
}

/**
 * Reading the chip over Web NFC.
 *
 * The only way to identify a LEGACY card: those were minted and encoded before
 * anything was printed on the back, so they carry no QR and no serial to read.
 * Chrome on Android over HTTPS, which is what the workshop uses.
 */
function TapButton({ onResult }: { onResult: (value: string) => void }) {
  const supported = useBrowserApi("NDEFReader");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    setError(null);
    setReading(true);
    try {
      const Reader = (window as unknown as {
        NDEFReader: new () => {
          scan: () => Promise<void>;
          onreading: ((e: { message: { records: { recordType: string; data?: DataView }[] } }) => void) | null;
        };
      }).NDEFReader;
      const reader = new Reader();
      await reader.scan();
      reader.onreading = (event) => {
        for (const record of event.message.records) {
          if (record.recordType !== "url" || !record.data) continue;
          const url = new TextDecoder().decode(record.data);
          onResult(url);
          setReading(false);
          return;
        }
        setError("That chip carries no card URL.");
        setReading(false);
      };
    } catch {
      setError("Could not read the chip. Type the serial instead.");
      setReading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={read} disabled={reading}>
        <Nfc className="h-3.5 w-3.5" aria-hidden="true" />
        {reading ? "Hold the card to the phone…" : "Tap card"}
      </Button>
      {error && <Alert tone="warning">{error}</Alert>}
    </div>
  );
}
