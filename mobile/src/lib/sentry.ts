import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { scrubDeep } from "./scrub";

/**
 * Crash reporting (PLAN.md §4.3, moved to M0).
 *
 * The DSN is public by design — it only lets the app send reports — and comes
 * from EXPO_PUBLIC_SENTRY_DSN at build time. Without one, nothing is sent and
 * nothing breaks, so a fresh checkout runs as-is.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: String(Constants.expoConfig?.extra?.variant ?? "development"),
    // Never attach IP addresses, cookies or user details automatically.
    sendDefaultPii: false,
    // A small sample of performance data, mainly for cold-start timing.
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubDeep(event),
    beforeBreadcrumb: (breadcrumb) => scrubDeep(breadcrumb),
  });
}

export { Sentry };
