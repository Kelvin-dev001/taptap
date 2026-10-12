import { existsSync } from "node:fs";
import path from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";
import { APP_LINK_HOST, APP_LINKS } from "@taptap/core/app-links";
import appConfig from "../../app.config";
import { redirectSystemPath } from "../../app/+native-intent";

const config = (appConfig as (c: ConfigContext) => ExpoConfig)({ config: {} } as ConfigContext);
const BASE = `https://${APP_LINK_HOST}`;

describe("website links that open the app (PLAN.md §9 W10)", () => {
  it("declares exactly lib/app-links.ts's paths on Android, verified, exact, https only", () => {
    const filters = config.android?.intentFilters ?? [];
    expect(filters).toHaveLength(1);
    const [filter] = filters;
    expect(filter.autoVerify).toBe(true);
    expect(filter.category).toEqual(["BROWSABLE", "DEFAULT"]);
    const data = Array.isArray(filter.data) ? filter.data : [filter.data];
    expect(data.map((d) => d?.path)).toEqual(APP_LINKS.map((l) => l.web));
    for (const d of data) {
      expect(d).toEqual({ scheme: "https", host: APP_LINK_HOST, path: d?.path });
    }
  });

  it("names the same host for iPhone", () => {
    expect(config.ios?.associatedDomains).toEqual([`applinks:${APP_LINK_HOST}`]);
  });

  it("opens a screen that exists for every link", () => {
    for (const link of APP_LINKS) {
      const name = link.app === "/" ? "index" : link.app.slice(1);
      expect(existsSync(path.join(__dirname, "../../app/(app)/(tabs)", `${name}.tsx`))).toBe(true);
    }
  });
});

describe("redirectSystemPath", () => {
  it("opens the screen an email's link stands for", () => {
    expect(redirectSystemPath({ path: `${BASE}/dashboard/customers`, initial: true })).toBe("/leads");
    expect(redirectSystemPath({ path: `${BASE}/dashboard/analytics`, initial: false })).toBe("/analytics");
    expect(redirectSystemPath({ path: `${BASE}/dashboard`, initial: true })).toBe("/");
  });

  it("sends any other website path Home rather than following it", () => {
    expect(redirectSystemPath({ path: `${BASE}/settings/delete-account`, initial: true })).toBe("/");
  });

  it("leaves the app's own and the development client's URLs alone", () => {
    for (const p of ["hornbilltaptap://lead/1", "exp+hornbill-taptap://expo-development-client/?url=x", "/leads"]) {
      expect(redirectSystemPath({ path: p, initial: true })).toBe(p);
    }
  });
});
