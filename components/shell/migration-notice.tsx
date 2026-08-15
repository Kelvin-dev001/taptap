import { Alert } from "@/components/ui";

/**
 * Shown when the deployed code expects schema that has not been applied yet.
 * Names the exact file so the fix is one copy-paste into the Supabase SQL
 * editor, and reassures the owner that nothing has been lost.
 */
export function MigrationNotice({ migration }: { migration: string }) {
  return (
    <Alert tone="warning" title="A database update is pending">
      This screen needs changes from{" "}
      <code className="rounded bg-surface-sunken px-1">{migration}</code>. Run it in the
      Supabase SQL editor and reload — your profiles, cards and analytics are unaffected.
    </Alert>
  );
}
