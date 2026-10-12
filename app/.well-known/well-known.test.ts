import { describe, expect, it } from "vitest";
import { GET as assetLinks } from "./assetlinks.json/route";
import { GET as appleAssociation } from "./apple-app-site-association/route";

describe("/.well-known files (PLAN.md §9 W10)", () => {
  it("serves assetlinks.json as JSON with a 200", async () => {
    const res = assetLinks();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body[0].target.package_name).toBe("ke.co.hornbilltech.taptap.dev");
  });

  it("answers 404 for the iPhone file until Apple's Team ID exists", () => {
    expect(appleAssociation().status).toBe(404);
  });
});
