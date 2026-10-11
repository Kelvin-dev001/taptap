/**
 * Sharing a profile (PLAN.md §6 Home: WhatsApp first).
 *
 * `wa.me/?text=` opens WhatsApp's own "send to…" picker with the message filled
 * in, or WhatsApp Web where the app is missing — no package queries needed, so
 * no extra Android permissions or manifest entries.
 */
export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
