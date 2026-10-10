import { useCallback, useEffect, useState } from "react";

/**
 * Seconds until something may be done again. Supabase sends at most one email
 * a minute to the same address (`max_frequency`), so "Send a new code" waits
 * out that minute instead of failing.
 */
export const RESEND_SECONDS = 60;

export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (remaining === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const start = useCallback((seconds: number = RESEND_SECONDS) => {
    const started = Date.now();
    setNow(started);
    setUntil(started + seconds * 1000);
  }, []);

  return { remaining, start };
}
