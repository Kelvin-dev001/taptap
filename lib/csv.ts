/** Build a CSV string, quoting values that contain commas, quotes, or newlines. */
export function toCsv(
  headers: string[],
  rows: (string | null | undefined)[][],
): string {
  const esc = (v: string | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const row of rows) lines.push(row.map(esc).join(","));
  return lines.join("\r\n");
}
