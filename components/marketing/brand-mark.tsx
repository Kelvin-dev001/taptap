import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The Hornbill mark.
 *
 * The supplied artwork is a 554×554 JPEG with a cream field and no alpha
 * channel, so it cannot simply be dropped onto a white or charcoal surface —
 * it would show as a cream tile. Cropping tightly to the circular mark and
 * masking to a circle removes the field: what cream remains reads as a
 * deliberate disc behind the bird rather than a mistake.
 *
 * Replace `hornbill-mark.jpg` with a transparent SVG or PNG when one exists and
 * the scale below can drop to 1.
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/hornbill-mark.jpg"
        alt=""
        width={554}
        height={554}
        /* The mark occupies roughly the central 62% of the square; 1.6 pushes
           the cream border outside the circle. */
        className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 scale-[1.6] object-cover"
        priority
      />
    </span>
  );
}

/** Mark plus name, for the marketing nav and footer. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={34} />
      <span className="text-body font-semibold tracking-tight text-foreground">
        Hornbill TapTap
      </span>
    </span>
  );
}
