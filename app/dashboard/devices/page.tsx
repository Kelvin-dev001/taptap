import { Nfc } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, Badge, EmptyState, Button, Select, Alert } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { rebindTagAction, setTagStatusAction } from "./actions";

export const dynamic = "force-dynamic";

type Tag = {
  id: string;
  token: string;
  status: string;
  smart_page_id: string | null;
};
type PageOpt = { id: string; slug: string; title: string | null };

export default async function DevicesPage() {
  const supabase = await createServerSupabase();

  const [{ data: tags }, { data: pages }] = await Promise.all([
    supabase
      .from("nfc_tags")
      .select("id, token, status, smart_page_id")
      .order("created_at", { ascending: false }),
    supabase.from("smart_pages").select("id, slug, title").order("created_at", { ascending: false }),
  ]);

  const tagRows = (tags ?? []) as Tag[];
  const pageOpts = (pages ?? []) as PageOpt[];
  const pageName = (id: string | null) => {
    const p = pageOpts.find((x) => x.id === id);
    return p ? p.title || `/${p.slug}` : "Not linked";
  };

  return (
    <>
      <PageHeader
        title="NFC Devices"
        description="Tap a new card to claim it. Cards keep the same permanent URL — repointing one never requires re-encoding the chip."
      />

      {tagRows.length === 0 ? (
        <EmptyState
          icon={Nfc}
          title="No cards claimed yet"
          description="Tap a Hornbill card against your phone, sign in, and it will appear here ready to point at one of your Tap Profiles."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tagRows.map((tg) => (
            <Card key={tg.id} padding="sm" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-card-title text-foreground">
                    Card ···{tg.token.slice(-6)}
                  </span>
                  <span className="truncate text-caption text-muted">
                    Points to {pageName(tg.smart_page_id)}
                  </span>
                </div>
                <Badge
                  variant={
                    tg.status === "assigned"
                      ? "success"
                      : tg.status === "disabled"
                        ? "danger"
                        : "neutral"
                  }
                  dot
                >
                  {tg.status === "assigned"
                    ? "Active"
                    : tg.status === "disabled"
                      ? "Disabled"
                      : "Unassigned"}
                </Badge>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <form action={rebindTagAction} className="flex flex-1 flex-wrap items-end gap-2">
                  <input type="hidden" name="tagId" value={tg.id} />
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-body-sm font-medium text-foreground">Point this card to</span>
                    <Select name="pageId" required defaultValue={tg.smart_page_id ?? ""}>
                      {pageOpts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title || `/${p.slug}`}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button type="submit" variant="secondary">
                    Repoint
                  </Button>
                </form>

                <form action={setTagStatusAction}>
                  <input type="hidden" name="tagId" value={tg.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={tg.status === "disabled" ? "assigned" : "disabled"}
                  />
                  <Button type="submit" variant={tg.status === "disabled" ? "secondary" : "ghost"}>
                    {tg.status === "disabled" ? "Enable card" : "Disable card"}
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tagRows.length > 0 && pageOpts.length === 0 && (
        <Alert tone="warning" className="mt-4" title="No Tap Profiles to point at">
          Create a link first, then come back and repoint your card.
        </Alert>
      )}
    </>
  );
}
