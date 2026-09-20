import {
  fitProof,
  PRINT_WIDTH_PX,
  PRINT_HEIGHT_PX,
  CR80_SAFE_MM,
  CR80_WIDTH_MM,
  type ProofFields,
} from "@/lib/proof";

/**
 * The Premium card front.
 *
 * ONE renderer, used by three things: the live preview the customer approves,
 * the print page staff send to the card printer, and the 300dpi PNG. That is
 * the point — if the preview and the print came from different code, the
 * customer would be approving something other than what gets made, and they
 * would only find out when it arrived.
 *
 * Written in the subset of CSS that Satori understands, because `next/og`
 * renders it for the PNG: flexbox only, inline styles only, explicit dimensions,
 * no CSS grid and no class names. That constraint costs nothing here and buys
 * the guarantee above.
 *
 * Always rendered at the full 1011 × 638 print size. Callers that need it
 * smaller scale it with a transform, so the layout is identical at every size
 * rather than reflowing.
 *
 * No Hornbill branding, by decision (D-029). The back of the card carries our
 * QR and wordmark; the front belongs to the customer.
 */
export function CardFront({ fields }: { fields: ProofFields }) {
  const fitted = fitProof(fields);

  // The safe margin in print pixels: nothing important goes within 3mm of the
  // edge, because card printers drift and a clipped name is a reprint.
  const safe = Math.round((CR80_SAFE_MM / CR80_WIDTH_MM) * PRINT_WIDTH_PX);
  const pad = safe * 2;

  return (
    <div
      style={{
        width: PRINT_WIDTH_PX,
        height: PRINT_HEIGHT_PX,
        display: "flex",
        flexDirection: "row",
        background: "#ffffff",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* The customer's accent, as a spine down the leading edge. A full-bleed
          block rather than a thin rule: it survives the printer's drift, and it
          is the one part of the card that is unmistakably theirs. */}
      <div
        style={{
          width: safe * 2,
          height: "100%",
          background: fields.accent,
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          paddingLeft: pad,
          paddingRight: pad,
          paddingTop: pad,
          paddingBottom: pad,
        }}
      >
        {fields.logoUrl ? (
          <div style={{ display: "flex", marginBottom: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fields.logoUrl}
              alt=""
              width={132}
              height={132}
              style={{ width: 132, height: 132, objectFit: "contain" }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            fontSize: fitted.name.size * 2,
            fontWeight: 700,
            color: "#0f0f0f",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {fitted.name.text}
        </div>

        {fitted.title ? (
          <div
            style={{
              display: "flex",
              fontSize: fitted.title.size * 2,
              color: "#404040",
              marginTop: 16,
              lineHeight: 1.25,
            }}
          >
            {fitted.title.text}
          </div>
        ) : null}

        {fitted.org ? (
          <div
            style={{
              display: "flex",
              fontSize: fitted.org.size * 2,
              color: "#737373",
              marginTop: 10,
              lineHeight: 1.25,
            }}
          >
            {fitted.org.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
