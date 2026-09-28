/**
 * Numbers, dates and money, Kenyan conventions (PLAN.md §4.9): "1,284",
 * "31 Dec 2026", "KES 1,000". Screens never format by hand, so switching locale
 * later changes one file.
 */
const LOCALE = "en-KE";

const number = new Intl.NumberFormat(LOCALE);

export function formatNumber(value: number): string {
  return number.format(value);
}
