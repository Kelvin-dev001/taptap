export type UAInfo = { device: string; os: string };

/** Best-effort device/OS from a user-agent string. Deliberately lightweight. */
export function parseUA(ua: string | null | undefined): UAInfo {
  const s = (ua || "").toLowerCase();

  let os = "unknown";
  if (/android/.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/.test(s)) os = "iOS";
  else if (/windows/.test(s)) os = "Windows";
  else if (/mac os x|macintosh/.test(s)) os = "macOS";
  else if (/linux/.test(s)) os = "Linux";

  let device = "desktop";
  if (/ipad|tablet/.test(s)) device = "tablet";
  else if (/mobi|android|iphone|ipod/.test(s)) device = "mobile";

  return { device, os };
}
