import { cn } from "@/lib/cn";
import { MiniProfile } from "./mini-profile";

/**
 * A phone, drawn in CSS.
 *
 * Decorative: the profile inside is a rendering of what a customer sees, and the
 * hero's copy already says so, so the whole assembly is hidden from assistive
 * tech rather than narrated as if it were a real screenshot.
 */
export function PhoneFrame({
  className,
  screenOn = true,
}: {
  className?: string;
  /** The hero wakes the screen mid-scroll; static contexts render it lit. */
  screenOn?: boolean;
}) {
  return (
    <div aria-hidden="true" className={cn("relative", className)}>
      <div className="relative aspect-[9/19] w-full rounded-[2rem] bg-neutral-900 p-[6px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
        <div className="relative h-full w-full overflow-hidden rounded-[1.65rem] bg-neutral-950">
          {/* Notch */}
          <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-black/70" />

          <div
            className={cn(
              "h-full w-full transition-opacity duration-500",
              screenOn ? "opacity-100" : "opacity-0",
            )}
          >
            <MiniProfile />
          </div>
        </div>
      </div>
    </div>
  );
}
