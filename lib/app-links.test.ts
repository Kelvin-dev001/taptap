import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANDROID_APPS,
  APP_LINK_HOST,
  APP_LINKS,
  appRouteForUrl,
  appRouteForWebPath,
  appleAppSiteAssociation,
  assetLinks,
} from "./app-links";
import { RESERVED_SLUGS } from "./reserved-slugs";

const URL_BASE = `https://${APP_LINK_HOST}`;

describe("which links open the app (PLAN.md §15 M6)", () => {
  it.each([
    ["/t/abc123XYZ", "a card tap"],
    ["/mama-njeris-kitchen", "a profile link"],
    ["/dashboard/billing", "renewal email: payment stays on the web (D-036)"],
    ["/dashboard/orders", "dispatch email: orders live on the web"],
    ["/dashboard/profiles/123/edit", "anything deeper under the dashboard"],
    ["/auth/confirm", "sign-in links stay in the browser that asked for them"],
    ["/", "the home page"],
    ["/login", "sign-in"],
    ["/account/delete", "web deletion"],
  ])("never %s (%s)", (webPath) => {
    expect(appRouteForWebPath(webPath)).toBeNull();
  });

  it("opens only exact paths — no wildcard reaches the files", () => {
    for (const link of APP_LINKS) expect(link.web).not.toMatch(/[*?]/);
    const aasa = appleAppSiteAssociation("TEAM123456")!;
    for (const c of aasa.applinks.details[0].components) expect(c["/"]).not.toMatch(/[*?]/);
  });

  it("claims only paths under a reserved slug, so no business can ever own one", () => {
    for (const link of APP_LINKS) {
      const first = link.web.split("/")[1];
      expect(RESERVED_SLUGS.has(first)).toBe(true);
    }
  });

  it("claims exactly the dashboard links our emails send", () => {
    const sent = new Set<string>();
    for (const file of ["lead-email.ts", "first-tap-email.ts", "dispatch-email.ts", "renewal-email.ts"]) {
      const source = readFileSync(path.join(__dirname, "notifications", file), "utf8");
      for (const m of source.matchAll(/\}(\/dashboard[a-z/-]*)`/g)) sent.add(m[1]);
    }
    expect(sent).toEqual(new Set(["/dashboard", "/dashboard/customers", "/dashboard/analytics", "/dashboard/orders", "/dashboard/billing"]));
    // Every claimed link is one an email sends; billing and orders are not claimed.
    for (const link of APP_LINKS) expect(sent.has(link.web)).toBe(true);
    expect(APP_LINKS.map((l) => l.web).sort()).toEqual(["/dashboard", "/dashboard/analytics", "/dashboard/customers"]);
  });
});

describe("appRouteForUrl", () => {
  it("maps our https links to their screen", () => {
    expect(appRouteForUrl(`${URL_BASE}/dashboard/customers`)).toBe("/leads");
    expect(appRouteForUrl(`${URL_BASE}/dashboard/analytics?x=1`)).toBe("/analytics");
    expect(appRouteForUrl(`${URL_BASE}/dashboard/`)).toBe("/");
  });

  it("sends any other path on our host Home, never to a path taken from the link", () => {
    expect(appRouteForUrl(`${URL_BASE}/dashboard/billing`)).toBe("/");
    expect(appRouteForUrl(`${URL_BASE}/settings/delete-account`)).toBe("/");
  });

  it("leaves everything that is not a website link alone", () => {
    expect(appRouteForUrl("hornbilltaptap://lead/1")).toBeNull();
    expect(appRouteForUrl("exp+hornbill-taptap://expo-development-client/?url=x")).toBeNull();
    expect(appRouteForUrl("/leads")).toBeNull();
    expect(appRouteForUrl(`http://${APP_LINK_HOST}/dashboard`)).toBeNull();
    expect(appRouteForUrl("https://evil.example/dashboard/customers")).toBeNull();
  });
});

describe("the files", () => {
  it("assetlinks.json lists each Android app with a well-formed fingerprint", () => {
    const file = assetLinks();
    expect(file).toHaveLength(ANDROID_APPS.length);
    for (const entry of file) {
      expect(entry.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
      expect(entry.target.namespace).toBe("android_app");
      for (const fp of entry.target.sha256_cert_fingerprints) expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
    expect(file.map((e) => e.target.package_name)).toContain("ke.co.hornbilltech.taptap.dev");
  });

  it("apple-app-site-association is withheld until there is a Team ID", () => {
    expect(appleAppSiteAssociation(null)).toBeNull();
    const file = appleAppSiteAssociation("TEAM123456")!;
    expect(file.applinks.details[0].appIDs).toEqual([
      "TEAM123456.ke.co.hornbilltech.taptap",
      "TEAM123456.ke.co.hornbilltech.taptap.dev",
    ]);
    expect(file.applinks.details[0].components.map((c) => c["/"])).toEqual(APP_LINKS.map((l) => l.web));
  });
});
