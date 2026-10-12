/**
 * Where to download the TapTap app (docs/mobile/PLAN.md §9 W11–W12).
 *
 * Both stay null until the apps are published (M8). While they are null the
 * download banners render nothing and `/app` is a 404, so nothing points at a
 * listing that does not exist yet. Publishing is filling these in:
 *
 *  - PLAY_STORE_URL: https://play.google.com/store/apps/details?id=ke.co.hornbilltech.taptap
 *  - APP_STORE_ID: the numeric id App Store Connect gives the app record.
 */
export const PLAY_STORE_URL: string | null = null;
export const APP_STORE_ID: string | null = null;

export function appStoreUrl(id: string | null = APP_STORE_ID): string | null {
  return id ? `https://apps.apple.com/app/id${id}` : null;
}
