import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createEdgeClient } from "@/lib/supabase/edge";
import { isValidToken } from "@/lib/tags";
import { parseUA } from "@/lib/ua";
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
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">This TapTap card isn’t set up yet</h1>
        <p className="text-neutral-600">
          Sign in, then tap your card again to link it to your smart page.
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-neutral-900 px-5 py-2.5 font-medium text-white hover:bg-neutral-700"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const { data: pages } = await supabase
    .from("smart_pages")
    .select("id, slug, title")
    .order("created_at", { ascending: false });

  return (
    <ClaimForm
      token={token}
      pages={(pages ?? []) as { id: string; slug: string; title: string | null }[]}
    />
  );
}
