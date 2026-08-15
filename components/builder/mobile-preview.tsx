"use client";

import * as React from "react";
import { Smartphone, Tablet } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, Badge } from "@/components/ui";
import { ProfileView } from "@/components/profile/profile-view";
import type { PublicPage } from "@/lib/profile";
import { cn } from "@/lib/cn";

/**
 * Live preview inside a device frame.
 *
 * Renders the same ProfileView the public page uses, in "preview" mode so
 * nothing navigates or is tracked. It updates straight from editor state — no
 * save, no reload, no iframe.
 */
export function MobilePreview({
  page,
  dirty,
  className,
}: {
  page: PublicPage;
  /** Shows whether the preview is ahead of what the public currently sees. */
  dirty: boolean;
  className?: string;
}) {
  const [device, setDevice] = React.useState<"phone" | "tablet">("phone");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-card-title text-foreground">Live preview</h2>
          <Badge variant={dirty ? "warning" : "success"} dot>
            {dirty ? "Unsaved changes" : "Matches saved"}
          </Badge>
        </div>

        <Tabs value={device} onValueChange={(v) => setDevice(v as "phone" | "tablet")}>
          <TabsList aria-label="Preview device">
            <TabsTrigger value="phone" aria-label="Phone preview">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            </TabsTrigger>
            <TabsTrigger value="tablet" aria-label="Tablet preview">
              <Tablet className="h-3.5 w-3.5" aria-hidden="true" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div
        className={cn(
          "mx-auto w-full overflow-hidden rounded-[2rem] border-[6px] border-surface-inverse bg-white shadow-lg transition-all duration-slow ease-standard",
          device === "phone" ? "max-w-[320px]" : "max-w-[460px]",
        )}
      >
        {/* Device chrome — decorative, so it stays out of the a11y tree. */}
        <div
          aria-hidden="true"
          className="flex h-6 items-center justify-center bg-surface-inverse"
        >
          <span className="h-1.5 w-16 rounded-full bg-white/25" />
        </div>

        <div className="h-[520px] overflow-y-auto">
          <ProfileView page={page} mode="preview" />
        </div>
      </div>

      <p className="text-center text-caption text-muted">
        Preview only — links do not open here.
      </p>
    </div>
  );
}
