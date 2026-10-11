import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { qrPath } from "./qr";

/**
 * A QR code drawn on the phone, crisp at any size and available offline.
 * Always dark on white, whatever the app's theme: scanners need the contrast,
 * and an inverted code fails on many phone cameras.
 */
export function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const { size: modules, d } = useMemo(() => qrPath(value), [value]);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Rect x={0} y={0} width={modules} height={modules} fill="#ffffff" />
      <Path d={d} fill="#111111" />
    </Svg>
  );
}
