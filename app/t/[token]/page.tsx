import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/tags";
import ClaimForm from "./claim-form";

export const dynamic = "force-dynamic";

export default async function TagPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidToken(token)) notFound();

  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("resolve_tag", { p_token: token });
  const result = data as { status?: string; slug?: string | null } | null;
  if (!result) notFound();

  if (result.status === "assigned") {
    if (!result.slug) notFound();
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
