import { Nfc } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { EmptyState, Alert, MetricCard } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { DeviceCard, type Device, type PageOption } from "@/components/devices/device-card";
import { parseRange, rangeLabel } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = parseRange(range);

  const supabase = await createServerSupabase();
  const [{ data: devicesData, error: devicesError }, { data: pages }] = await Promise.all([
    supabase.rpc("get_devices_overview", { p_days: days }),
    // Published only: a card must never be repointed at a draft, because the
    // slug would not resolve and the failure lands in front of whoever tapped
    // it (D-021). `rebindTagAction` re-checks this server-side.
    supabase
      .from("smart_pages")
      .select("id, slug, title")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);

  if (isMissingSchemaError(devicesError)) {
    return (
      <>
        <PageHeader title="NFC Devices" />
        <MigrationNotice migration="0010_event_source_and_devices.sql" />
      </>
    );
  }

  const devices = (devicesData ?? []) as Device[];
  const pageOptions = (pages ?? []) as PageOption[];

  const active = devices.filter((d) => d.status === "assigned").length;
  const totalTaps = devices.reduce((sum, d) => sum + d.taps, 0);
  const unassigned = devices.filter((d) => d.status === "unassigned").length;

  return (
    <>
      <PageHeader
        title="NFC Devices"
        description="Every card keeps its own permanent link. Repointing one never means re-encoding the chip."
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={Nfc}
          title="No cards claimed yet"
          description="Tap a Hornbill card against your phone, sign in, and it will appear here ready to point at one of your Tap Profiles."
        />
      ) : (
        <>
          <section
            aria-label="Card summary"
            className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            <MetricCard label="Active cards" value={active} />
            <MetricCard
              label="Taps"
              value={totalTaps.toLocaleString()}
              hint={rangeLabel(days).toLowerCase()}
            />
            <MetricCard label="Unassigned" value={unassigned} />
          </section>

          {pageOptions.length === 0 && (
            <Alert tone="warning" className="mb-4" title="No Tap Profiles to point at">
              Create a link first, then come back and point your cards at it.
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                pages={pageOptions}
                rangeDays={days}
              />
            ))}
          </div>

          <p className="mt-4 text-caption text-muted">
            Tap counts include only taps we can attribute to a specific card. Cards tapped
            before this feature was added are not counted.
          </p>
        </>
      )}
    </>
  );
}
