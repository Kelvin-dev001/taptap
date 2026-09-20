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
import { handleFirstTap } from "@/lib/notifications/notify-first-tap";
import ClaimForm from "./claim-form";

export const dynamic = "force-dynamic";

type TagResolution = {
  status?: string;
  slug?: string | null;
  /** Added by migration 0010 so the tap can be attributed to this card. */
  tag_id?: string | null;
  page_id?: string | null;
  /** Added by 0022, on the `unassigned` branch only: who owns this card. */
  account_id?: string | null;
};

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { token } = await params;
  const { src } = await searchParams;
  if (!isValidToken(token)) notFound();

  // How the card was read. The printed QR on the back carries `?src=qr`; the
  // chip is encoded with the plain URL, so anything else is a tap.
  //
  // This matters more than it looks. Every stock card now shows a QR, and
  // counting a scan as an NFC tap would claim hardware engagement we never had
  // — the fabrication §15 forbids. A scan is a `scan` event with source `qr`, a
  // tap is a `tap` event with source `nfc`, and analytics can tell them apart.
  const viaQr = src === "qr";
  const eventType = viaQr ? "scan" : "tap";
  const eventSource = viaQr ? "qr" : "nfc";

  // `logged=1` tells the slug route the interaction is already recorded. The
  // bare `?src=nfc` meant that on its own until now, and still does — cards in
  // the field carry URLs that predate this, so both must keep working.
  const onward = (slug: string) => `/${slug}?src=${eventSource}&logged=1`;

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
          p_type: eventType,
          p_device: device,
          p_os: os,
          p_country: h.get("x-vercel-ip-country"),
          p_region: h.get("x-vercel-ip-country-region"),
          p_source: eventSource,
          p_tag_id: result.tag_id,
        });
      });
    }
    if (result.slug) redirect(onward(result.slug));
    return <InactiveNotice />;
  }

  if (result.status === "assigned") {
    if (!result.slug) notFound();

    // The interaction is logged HERE, because this is the only place that knows
    // which physical card was involved. The slug route cannot: it sees a URL,
    // not a card. `logged=1` tells it the event is already recorded so it does
    // not count the same interaction twice.
    if (result.page_id && result.tag_id) {
      const h = await headers();
      const { device, os } = parseUA(h.get("user-agent"));
      const country = h.get("x-vercel-ip-country");
      const region = h.get("x-vercel-ip-country-region");
      const edge = createEdgeClient();
      const tagId = result.tag_id;
      after(async () => {
        await edge.rpc("log_event", {
          p_page_id: result.page_id,
          p_type: eventType,
          p_device: device,
          p_os: os,
          p_country: country,
          p_region: region,
          p_source: eventSource,
          p_tag_id: tagId,
        });

        // The first tap after dispatch is the best delivery confirmation there
        // is: the customer is holding the card and it works (D-031). Runs after
        // the redirect, never before it — somebody is standing in front of a
        // customer with a phone against a card, and an email provider having a
        // slow afternoon must not be something either of them can feel.
        //
        // Called on EVERY tap and scan because it is `record_first_tap` that
        // decides whether this one counts, atomically. Deciding here would mean
        // reading the card first, which is a round trip on the hot path to
        // answer a question that is almost always "no".
        await handleFirstTap(tagId);
      });
    }

    redirect(onward(result.slug));
  }

  // A card that has not been sold (D-027).
  //
  // Every stock card prints its QR on the back, so this screen is reachable by
  // anyone who photographs a card in a display case or picks one up off a
  // counter. It offers no claim form, because claiming an unowned card is
  // precisely what D-027 stops — until activation codes exist, a card is joined
  // to its owner by staff at fulfilment and by nobody else.
  //
  // Warm rather than a 404: the person reading this is holding a real card, and
  // telling them it does not exist would be both unhelpful and untrue.
  if (result.status === "unactivated") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
        <Wordmark subtitle="Business suite" />
        <Card padding="md" className="flex flex-col gap-4">
          <h1 className="text-page-title text-foreground">
            This TapTap card hasn&rsquo;t been activated yet
          </h1>
          <p className="text-body-sm text-muted">
            It will start working as soon as the business it belongs to sets it up. If this
            is your card and it arrived like this, get in touch and we will sort it out.
          </p>
          <Button asChild full>
            <Link href="/pricing">Get your own TapTap card</Link>
          </Button>
        </Card>
      </main>
    );
  }

  // Owned, but not pointed at a profile yet → the owner links it.
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

  // Signed in, but not as the owner of this card.
  //
  // `claim_tag` would refuse them anyway, so offering the form would be offering
  // a button that always fails. It also says nothing about who the owner is:
  // someone who found a card on the floor learns that it belongs to somebody,
  // and no more than that.
  const { data: viewer } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (result.account_id && viewer?.account_id !== result.account_id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
        <Wordmark subtitle="Business suite" />
        <Card padding="md" className="flex flex-col gap-4">
          <h1 className="text-page-title text-foreground">
            This card isn&rsquo;t set up yet
          </h1>
          <p className="text-body-sm text-muted">
            It belongs to another account. The business it was issued to needs to link it to
            a profile.
          </p>
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
