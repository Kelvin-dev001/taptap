import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon.
 *
 * Separate from `icon.tsx` because iOS does not respect transparency or
 * rounding — it applies its own mask to an opaque square, so this ships with
 * the background filled edge to edge and no corner radius of its own.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#141414",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <path
            d="M15.2 5.6c-2.9 0-5.3 2.1-5.7 4.9l-2.9 2.2a.9.9 0 0 0 .2 1.5l1.6.7c.5 2.4 2.6 4.2 5.2 4.2 1 0 1.9-.3 2.7-.7l-.6-1.7a3.6 3.6 0 0 1-2.1.6c-1.9 0-3.4-1.4-3.5-3.3l-.1-.9-1.3-.6 2.2-1.7.1-.6a3.9 3.9 0 0 1 7.7.7c0 .6-.1 1.1-.3 1.6l1.8.6c.3-.7.4-1.4.4-2.2 0-3-2.4-5.3-5.4-5.3Z"
            fill="#f97316"
          />
          <path
            d="M17.4 9.3c1.6 0 2.9.5 2.9 1.2 0 .6-.9 1-2.1 1.1l-4.6.4 3.8-2.7Z"
            fill="#fdba74"
          />
          <circle cx="16.1" cy="9.1" r=".8" fill="#141414" />
        </svg>
      </div>
    ),
    size,
  );
}
