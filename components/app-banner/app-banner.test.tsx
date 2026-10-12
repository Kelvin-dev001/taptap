import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { AndroidAppBanner, DISMISS_KEY } from "./android-app-banner";
import { AppDownload } from "@/app/app/app-download";

const PLAY = "https://play.google.com/store/apps/details?id=ke.co.hornbilltech.taptap";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; TECNO CL8) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

function setAgent(ua: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AndroidAppBanner (PLAN.md §9 W11)", () => {
  it("renders nothing until the app has a listing", () => {
    setAgent(ANDROID);
    const { container } = render(<AndroidAppBanner playUrl={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows only on Android", () => {
    setAgent(IPHONE);
    const { container } = render(<AndroidAppBanner playUrl={PLAY} />);
    expect(container.innerHTML).toBe("");
  });

  it("links to the listing, and a dismissal is remembered", () => {
    setAgent(ANDROID);
    render(<AndroidAppBanner playUrl={PLAY} />);
    expect(screen.getByRole("link", { name: "Get the app" }).getAttribute("href")).toBe(PLAY);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("complementary", { name: "Get the TapTap app" })).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
    cleanup();
    render(<AndroidAppBanner playUrl={PLAY} />);
    expect(screen.queryByRole("link", { name: "Get the app" })).toBeNull();
  });
});

/** Every source file under a folder of app/. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("where the banners go", () => {
  const APP = path.join(__dirname, "../../app");
  const mentions = (file: string) => /app-banner|itunes|app-store"/.test(readFileSync(file, "utf8"));

  it("never on a profile or a card tap — those pages belong to the business", () => {
    for (const file of [...sources(path.join(APP, "[slug]")), ...sources(path.join(APP, "t"))]) {
      expect(mentions(file), file).toBe(false);
    }
    // The root layout would put it on every page, profiles included.
    expect(mentions(path.join(APP, "layout.tsx"))).toBe(false);
  });

  it("on the home page and the dashboard", () => {
    expect(mentions(path.join(APP, "page.tsx"))).toBe(true);
    expect(mentions(path.join(APP, "dashboard/layout.tsx"))).toBe(true);
  });
});

describe("/app", () => {
  it("offers a button per store the app is in", () => {
    render(<AppDownload playUrl={PLAY} appStoreUrl={null} qrDataUrl="data:image/svg+xml,x" />);
    expect(screen.getByRole("link", { name: "Download for Android" }).getAttribute("href")).toBe(PLAY);
    expect(screen.queryByRole("link", { name: "Download for iPhone" })).toBeNull();
    expect(screen.getByAltText(/QR code/)).toBeTruthy();
  });

  it("is a 404 while the app is in no store", async () => {
    vi.doMock("next/navigation", () => ({
      notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
      },
    }));
    const { default: AppPage } = await import("@/app/app/page");
    await expect(AppPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
