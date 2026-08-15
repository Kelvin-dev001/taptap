import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Detects "the database has not caught up with the code" errors.
 *
 * Migrations are applied by hand in the Supabase SQL editor, so a deploy can
 * legitimately run ahead of the schema. When it does, a query for a missing
 * column returns an error and the row comes back null — which reads exactly
 * like "this page does not exist". Telling an owner their live profile is gone
 * is far worse than telling them a migration is pending.
 *
 * Codes:
 *   42703   undefined_column
 *   42883   undefined_function
 *   PGRST202 function not found in the PostgREST schema cache
 *   PGRST204 column not found in the PostgREST schema cache
 */
const SCHEMA_ERROR_CODES = new Set(["42703", "42883", "PGRST202", "PGRST204"]);

export function isMissingSchemaError(
  error: PostgrestError | { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code && SCHEMA_ERROR_CODES.has(error.code)) return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") &&
    (message.includes("column") || message.includes("function"))
  );
}
