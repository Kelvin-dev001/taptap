import type { Contact } from "./profile";

function esc(s: string): string {
  return s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
}

/** Build a vCard 3.0 string from contact fields. */
export function buildVCard(contact: Contact, fallbackName?: string): string {
  const fn = contact.fullName || fallbackName || "Contact";
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(fn)}`];
  if (contact.org) lines.push(`ORG:${esc(contact.org)}`);
  if (contact.title) lines.push(`TITLE:${esc(contact.title)}`);
  if (contact.phone) lines.push(`TEL;TYPE=CELL:${esc(contact.phone)}`);
  if (contact.email) lines.push(`EMAIL:${esc(contact.email)}`);
  if (contact.website) lines.push(`URL:${esc(contact.website)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}
