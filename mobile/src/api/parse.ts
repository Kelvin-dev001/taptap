import { Sentry } from "@/lib/sentry";
import { ShapeIssue, type Check } from "./shape";

/**
 * A server answer that does not have the shape this app version expects
 * (PLAN.md §4.5). Installed apps stay old for months while the database moves
 * on; this turns a changed shape into an error state instead of a crash.
 */
export class ResponseShapeError extends Error {
  constructor(readonly source: string) {
    super(`Unexpected response shape from ${source}`);
    this.name = "ResponseShapeError";
  }
}

/**
 * Checks `data`. A mismatch is reported to Sentry by source name and field
 * path only — never the values, which are customer data.
 */
export function parseResponse<T>(check: Check<T>, data: unknown, source: string): T {
  try {
    return check(data, "");
  } catch (error) {
    if (!(error instanceof ShapeIssue)) throw error;
    Sentry.captureException(new ResponseShapeError(source), { extra: { path: error.path } });
    throw new ResponseShapeError(source);
  }
}
