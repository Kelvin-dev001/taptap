"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, and only in production.
 *
 * In development a worker caches the dev build and then serves it after the
 * dev server restarts, which produces "my change did nothing" bugs that cost
 * far more than the offline support is worth while iterating. Any worker
 * registered by an earlier session is actively unregistered here so a developer
 * cannot get stuck.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => undefined);
      return;
    }

    // After load, so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is an enhancement; failing to register must never
        // surface to the user.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
