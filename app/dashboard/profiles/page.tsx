import Link from "next/link";
import { IdCard, ExternalLink, Pencil, ChartNoAxesColumn, Users, QrCode } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, Badge, EmptyState, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/cn";
import CreateProfileForm from "./create-profile-form";

export const dynamic = "force-dynamic";

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  mode: "page" | "redirect";
  redirect_url: string | null;
  is_active: boolean;
};

export default async function ProfilesPage() {
  // Auth is enforced once in app/dashboard/layout.tsx.
  const supabase = await createServerSupabase();
  const { data: pages } = await supabase
    .from("smart_pages")
    .select("id, slug, title, mode, redirect_url, is_active")
    .order("created_at", { ascending: false });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const rows = (pages ?? []) as PageRow[];

  return (
    <>
      <PageHeader
        title="Tap Profiles"
        description="Each profile is a permanent link that any NFC card or QR code can point to."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="flex flex-col gap-3" aria-labelledby="existing-heading">
          <h2 id="existing-heading" className="text-section-title text-foreground">
            Your links
          </h2>

          {rows.length === 0 ? (
            <EmptyState
              icon={IdCard}
              title="No links yet"
              description="Create your first link and point it at a Google review, WhatsApp, or a full smart page."
            />
          ) : (
            rows.map((p) => (
              <Card key={p.id} padding="sm" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <a
                      href={`${base}/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-card-title text-foreground hover:text-primary-strong"
                    >
                      {p.title || `/${p.slug}`}
                    </a>
                    <span className="truncate text-caption text-muted">
                      {base ? `${base.replace(/^https?:\/\//, "")}/${p.slug}` : `/${p.slug}`}
                    </span>
                  </div>
                  <Badge variant={p.is_active ? "success" : "neutral"} dot>
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <p className="truncate text-caption text-muted">
                  {p.mode === "redirect" ? `Redirects to ${p.redirect_url}` : "Smart page"}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <ProfileAction href={`/dashboard/profiles/${p.id}/edit`} icon={Pencil}>
                    Edit
                  </ProfileAction>
                  <ProfileAction
                    href={`/dashboard/profiles/${p.id}/analytics`}
                    icon={ChartNoAxesColumn}
                  >
                    Analytics
                  </ProfileAction>
                  <ProfileAction href={`/dashboard/profiles/${p.id}/leads`} icon={Users}>
                    Leads
                  </ProfileAction>
                  <ProfileAction href={`/api/qr/${p.slug}`} icon={QrCode}>
                    QR code
                  </ProfileAction>
                  <a
                    href={`${base}/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-caption text-foreground-secondary transition-colors duration-fast hover:bg-surface-sunken hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Open
                    <span className="sr-only">{p.title || p.slug} in a new tab</span>
                  </a>
                </div>
              </Card>
            ))
          )}
        </section>

        <Card padding="md" className="lg:sticky lg:top-20">
          <h2 className="mb-4 text-section-title text-foreground">Create a link</h2>
          <CreateProfileForm />
        </Card>
      </div>
    </>
  );
}

/**
 * A link that looks like a ghost button. Uses `buttonVariants` rather than
 * wrapping <Button>, so the rendered element stays an anchor — these navigate,
 * and a <button> would be the wrong role (the mistake UI-0 logged as A5).
 */
function ProfileAction({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2 text-caption")}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}
