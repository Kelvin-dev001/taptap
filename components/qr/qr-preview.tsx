"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { Button, Tabs, TabsList, TabsTrigger, Field, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

const PRINT_SIZES = [
  { value: "512", label: "Small — 512px" },
  { value: "1024", label: "Medium — 1024px" },
  { value: "2048", label: "Large — 2048px" },
];

/**
 * QR preview with format and size controls.
 *
 * The preview and the download hit the same endpoint, so what is on screen is
 * exactly what gets saved. SVG is offered because a printed QR at sticker or
 * A6 size will look ragged from a raster but stays sharp from a vector.
 */
export function QrPreview({
  slug,
  token,
  label,
  className,
}: {
  slug: string;
  /** When set, the QR encodes the permanent /t/<token> card URL. */
  token?: string;
  label: string;
  className?: string;
}) {
  const [format, setFormat] = React.useState<"png" | "svg">("png");
  const [size, setSize] = React.useState("1024");

  const query = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ format, size, ...extra });
    if (token) params.set("token", token);
    return `/api/qr/${encodeURIComponent(slug)}?${params.toString()}`;
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-center rounded-xl border border-border bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={query({ size: "512" })}
          alt={`QR code for ${label}`}
          width={180}
          height={180}
          className="h-[180px] w-[180px]"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm font-medium text-foreground">Format</span>
          <Tabs value={format} onValueChange={(v) => setFormat(v as "png" | "svg")}>
            <TabsList aria-label="QR format">
              <TabsTrigger value="png">PNG</TabsTrigger>
              <TabsTrigger value="svg">SVG</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {format === "png" && (
          <Field label="Size" className="min-w-[10rem] flex-1">
            <Select value={size} onChange={(e) => setSize(e.target.value)}>
              {PRINT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {format === "svg" && (
        <p className="text-caption text-muted">
          Vector — stays sharp at any printed size. Best for stickers, stands and menus.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={query({ download: "1" })} download>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download {format.toUpperCase()}
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a
            href={`/print/qr?slug=${encodeURIComponent(slug)}${
              token ? `&token=${encodeURIComponent(token)}` : ""
            }&label=${encodeURIComponent(label)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print sheet
          </a>
        </Button>
      </div>
    </div>
  );
}
