import { describe, it, expect } from "vitest";
import { isMissingSchemaError } from "./schema-guard";

/**
 * Migrations are applied by hand, so a deploy can run ahead of the schema.
 * Distinguishing "the column is not there yet" from "the row is not there"
 * is what stops the UI telling an owner their live page has vanished.
 */
describe("isMissingSchemaError", () => {
  it("recognises a missing column", () => {
    expect(isMissingSchemaError({ code: "42703", message: 'column "status" does not exist' })).toBe(
      true,
    );
  });

  it("recognises a missing function", () => {
    expect(isMissingSchemaError({ code: "42883" })).toBe(true);
  });

  it("recognises PostgREST schema-cache misses", () => {
    expect(isMissingSchemaError({ code: "PGRST202" })).toBe(true);
    expect(isMissingSchemaError({ code: "PGRST204" })).toBe(true);
  });

  it("falls back to the message when no code is given", () => {
    expect(
      isMissingSchemaError({ message: 'function public.get_dashboard_overview does not exist' }),
    ).toBe(true);
  });

  it("ignores ordinary errors, which must not be mistaken for a pending migration", () => {
    expect(isMissingSchemaError(null)).toBe(false);
    expect(isMissingSchemaError(undefined)).toBe(false);
    expect(isMissingSchemaError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isMissingSchemaError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingSchemaError({ message: "row does not exist" })).toBe(false);
  });
});
