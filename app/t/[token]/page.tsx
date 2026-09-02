import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createEdgeClient } from "@/lib/supabase/edge";
import { isValidToken } from "@/lib/tags";
import { parseUA } from "@/lib/ua";
import { Button, Card } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import { InactiveNotice } from "@/components/profile/inactive-notice";
import ClaimForm from "./claim-form";

export const dynamic = "force-dynamic";

type TagResolution = {
  status?: string;
  slug?: string | null;
  /** Added by migration 0010 so the tap can be attributed to this card. */
  tag_id?: string | null;
  page_id?: string | null;
};

export default async function TagPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidToken(token)) notFound();

  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("resolve_tag", { p_token: token });
  const result = data as TagResolution | null;
  if (!result) notFound();

  // A lapsed card (D-018). The tap is still logged — people tapping a dead card
  // is exactly what an owner needs to see — then handed to the slug route,
  // which owns the single rendering of the inactive state.
  if (result.status === "expired") {
    if (result.page_id && result.tag_id) {
      const h = await headers();
      const { device, os } = parseUA(h.get("user-agent"));
      const edge = createEdgeClient();
      after(async () => {
        await edge.rpc("log_event", {
          p_page_id: result.page_id,
          p_type: "tap",
          p_device: device,
          p_os: os,
          p_country: h.get("x-vercel-ip-country"),
          p_region: h.get("x-vercel-ip-country-region"),
          p_source: "nfc",
          p_tag_id: result.tag_id,
        });
      });
    }
    if (result.slug) redirect(`/${result.slug}?src=nfc`);
    return <InactiveNotice />;
  }

  if (result.status === "assigned") {
    if (!result.slug) notFound();

    // The tap is logged HERE, because this is the only place that knows which
    // physical card was tapped. The slug route cannot: it sees a URL, not a
    // card. `?src=nfc` tells it the tap is already recorded so it does not
    // count the same interaction twice.
    if (result.page_id && result.tag_id) {
      const h = await headers();
      const { device, os } = parseUA(h.get("user-agent"));
      const country = h.get("x-vercel-ip-country");
      const region = h.get("x-vercel-ip-country-region");
      const edge = createEdgeClient();
      after(async () => {
        await edge.rpc("log_event", {
          p_page_id: result.page_id,
          p_type: "tap",
          p_device: device,
          p_os: os,
          p_country: country,
          p_region: region,
          p_source: "nfc",
          p_tag_id: result.tag_id,
        });
      });
    }

    redirect(`/${result.slug}?src=nfc`);
  }

  // Unassigned → claim flow
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
        <Wordmark subtitle="Business suite" />
        <Card padding="md" className="flex flex-col gap-4">
          <h1 className="text-page-title text-foreground">
            This card isn&rsquo;t set up yet
          </h1>
          <p className="text-body-sm text-muted">
            Sign in, then tap your card again to link it to one of your profiles.
          </p>
          <Button asChild full>
            <Link href="/login">Sign in</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const { data: pages } = await supabase
    .from("smart_pages")
    .select("id, slug, title, status")
    .order("created_at", { ascending: false });

  // A card can only be linked to a page that resolves (D-021). Splitting the
  // list here rather than filtering it means the screen can tell the difference
  // between "you have nothing yet" and "the thing you built is still a draft",
  // which need different next steps.
  const all = (pages ?? []) as PageOption[];

  return (
    <ClaimForm
      token={token}
      pages={all.filter((p) => p.status === "published")}
      drafts={all.filter((p) => p.status !== "published")}
    />
  );
}

type PageOption = {
  id: string;
  slug: string;
  title: string | null;
  status: string | null;
};
