/**
 * Floating "chat to us on WhatsApp" button.
 *
 * WhatsApp is how business actually gets done here, so this is the highest-value
 * control on a marketing page: a visitor with one question can ask it in three
 * seconds instead of composing an email they will never send.
 *
 * Deliberately NOT on public Tap Profiles (`/[slug]`, `/t/<token>`). Those pages
 * belong to the customer, and putting Hornbill's WhatsApp on them would compete
 * with the business's own WhatsApp button and confuse their visitor about who
 * they are messaging. It is also off the ops console, which is staff-only.
 *
 * Server-rendered plain anchor: no JavaScript, works before hydration, and
 * `wa.me` handles both the app and web fallback itself.
 */
const PHONE = "254759293030";
const MESSAGE = "Hi Hornbill, I'd like to know more about TapTap.";

export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`}
      target="_blank"
      rel="noopener noreferrer"
      /* Sits above the iPhone home indicator and Android gesture bar via
         env(safe-area-inset-bottom), which is why the layout sets
         viewport-fit=cover. */
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-1 ring-black/5 transition-transform duration-fast hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 motion-reduce:transition-none sm:bottom-6 sm:right-6"
    >
      {/* The glyph is decorative; the accessible name comes from the label
          below, so a screen reader hears what it does rather than "link". */}
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z" />
        <path d="M12.04 2.5c-5.23 0-9.48 4.25-9.48 9.48 0 1.67.44 3.3 1.27 4.74L2.5 21.5l4.9-1.28a9.44 9.44 0 0 0 4.64 1.2h.01c5.22 0 9.47-4.25 9.47-9.48 0-2.53-.99-4.91-2.78-6.7a9.4 9.4 0 0 0-6.7-2.74Zm0 17.35h-.01a7.87 7.87 0 0 1-4.01-1.1l-.29-.17-2.98.78.8-2.9-.19-.3a7.85 7.85 0 0 1-1.2-4.18c0-4.34 3.54-7.87 7.88-7.87a7.83 7.83 0 0 1 7.87 7.88c0 4.34-3.53 7.86-7.87 7.86Z" />
      </svg>
      <span className="sr-only">Chat to us on WhatsApp</span>
    </a>
  );
}
