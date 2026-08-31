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
      {/* `container-type: inline-size` is what lets MiniProfile size itself in
          cqw and stay proportional at any frame width, instead of needing a
          breakpoint for every piece of text inside it. */}
      <div
        className="relative aspect-[9/19] w-full rounded-[1.75rem] bg-neutral-900 p-[5px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 sm:rounded-[2rem] sm:p-[6px]"
        style={{ containerType: "inline-size" }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[1.5rem] bg-neutral-950 sm:rounded-[1.65rem]">
          {/* Notch */}
          <div className="absolute left-1/2 top-[3px] z-10 h-1 w-[28%] -translate-x-1/2 rounded-full bg-black/70" />

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
