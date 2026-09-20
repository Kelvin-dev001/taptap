"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera } from "lucide-react";
import { Button, Alert } from "@/components/ui";

/**
 * Browser-native scanning primitives, shared by the ops surfaces.
 *
 * Extracted from `assign-cards.tsx` when the encode page (Sprint 8b) needed the
 * same camera. Two copies of a control that holds a camera open is the kind of
 * duplication that ends with one of them forgetting to release it.
 */

const noopSubscribe = () => () => {};

/**
 * Does this browser have the API?
 *
 * `useSyncExternalStore` rather than an effect that calls setState. The answer
 * never changes for the life of the page, so there is nothing to subscribe to —
 * what this buys is a server snapshot of `false` and a client snapshot read
 * during render, which is hydration-safe and does not trigger the cascading
 * re-render that setState-in-an-effect does.
 */
export function useBrowserApi(name: string): boolean {
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
export function ScanButton({
  onResult,
  label = "Scan QR",
}: {
  onResult: (value: string) => void;
  label?: string;
}) {
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
          {label}
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
