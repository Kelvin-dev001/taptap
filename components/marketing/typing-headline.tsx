import { cn } from "@/lib/cn";

/**
 * The headline, typed out — with no JavaScript at all.
 *
 * The whole string is in the DOM from the first server byte and each character
 * is wrapped in a span that a CSS animation fades in on a stagger. A screen
 * reader announces the heading normally, a crawler indexes it, and nothing
 * about the effect depends on a bundle arriving.
 *
 * That last part is the reason this is CSS. The previous version drove the
 * stagger with `motion`, which writes `style="opacity:0"` onto every character
 * in the SERVER output — so the most important line on the site stayed
 * invisible until the animation runtime had downloaded, parsed and hydrated.
 * On a mid-range Android over mobile data that reads as a page that will not
 * load. A stylesheet is render-blocking, so the CSS version cannot be late.
 *
 * `white-space: pre-wrap` on the wrapper does two jobs: it stops the spaces
 * between character spans collapsing while half the line is still transparent,
 * and unlike a non-breaking space it still lets the headline wrap onto a second
 * line, which it must do on a 360px screen.
 *
 * Reduced motion is handled in globals.css, where the animation is removed and
 * the characters fall back to their default opacity — no client-side check, so
 * this stays a Server Component.
 */
export function TypingHeadline({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const characters = Array.from(text);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {characters.map((character, index) => (
        <span
          key={`${character}-${index}`}
          className="type-char"
          style={{ "--type-i": index } as React.CSSProperties}
        >
          {character}
        </span>
      ))}

      {/* Decorative: it blinks a few times as the line lands, then retires
          rather than sitting beside finished text forever. */}
      <span
        aria-hidden="true"
        className="type-caret ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.06em] rounded-sm bg-primary align-middle"
        style={{ "--type-i": characters.length } as React.CSSProperties}
      />
    </span>
  );
}
