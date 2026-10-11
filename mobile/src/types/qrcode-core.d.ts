// qrcode's encoder, imported on its own (src/features/profile/qr.ts). The
// package ships no types for its internals; this is the part the app uses.
declare module "qrcode/lib/core/qrcode" {
  export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

  export function create(
    text: string,
    options?: { errorCorrectionLevel?: ErrorCorrectionLevel; version?: number },
  ): {
    version: number;
    modules: { size: number; get(row: number, col: number): number | boolean };
  };
}
