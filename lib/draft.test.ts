import { describe, expect, it } from "vitest";
import {
  DRAFT_LIMITS,
  actionValueProblem,
  draftProblem,
  isUuid,
  parseDraftInput,
  withLeadFormRule,
  type DraftInput,
} from "./draft";

const ID = "3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f";
const ID2 = "4a7d2e3f-9b5c-4d6e-8f10-2b3c4d5e6f70";

function body(overrides: Record<string, unknown> = {}) {
  return {
    expectedUpdatedAt: "2026-10-11T14:00:00.123456+00:00",
    title: "Mama Mboga",
    config: { bio: "Fresh daily" },
    theme: { accent: "#c2560a" },
    blocks: [{ id: ID, type: "whatsapp", label: "Chat", value: "0722000000", isActive: true }],
    ...overrides,
  };
}

describe("parseDraftInput", () => {
  it("accepts a well-formed draft and keeps only known fields", () => {
    const parsed = parseDraftInput({ ...body(), extra: "ignored" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input).toEqual(body());
    expect("mode" in parsed.input).toBe(false);
  });

  it("keeps mode and redirectUrl when sent", () => {
    const parsed = parseDraftInput(body({ mode: "redirect", redirectUrl: "https://x.co" }));
    expect(parsed.ok && parsed.input.mode).toBe("redirect");
    expect(parsed.ok && parsed.input.redirectUrl).toBe("https://x.co");
  });

  it.each([
    ["body", null],
    ["body", []],
    ["expectedUpdatedAt", body({ expectedUpdatedAt: "" })],
    ["expectedUpdatedAt", body({ expectedUpdatedAt: 5 })],
    ["title", body({ title: null })],
    ["title", body({ title: "x".repeat(DRAFT_LIMITS.title + 1) })],
    ["mode", body({ mode: "gallery" })],
    ["redirectUrl", body({ redirectUrl: 7 })],
    ["config", body({ config: [] })],
    ["theme", body({ theme: "dark" })],
    ["config", body({ config: { bio: "x".repeat(DRAFT_LIMITS.json) } })],
    ["blocks", body({ blocks: {} })],
    ["blocks", body({ blocks: Array.from({ length: DRAFT_LIMITS.blocks + 1 }, () => ({})) })],
    ["blocks[0]", body({ blocks: ["x"] })],
    ["blocks[0].id", body({ blocks: [{ id: "1", type: "call", label: "", value: "", isActive: true }] })],
    ["blocks[0].type", body({ blocks: [{ id: ID, type: "script", label: "", value: "", isActive: true }] })],
    ["blocks[0].label", body({ blocks: [{ id: ID, type: "call", label: 3, value: "", isActive: true }] })],
    ["blocks[0].value", body({ blocks: [{ id: ID, type: "call", label: "", value: 722000000, isActive: true }] })],
    ["blocks[0].isActive", body({ blocks: [{ id: ID, type: "call", label: "", value: "", isActive: "yes" }] })],
  ])("names %s when it is wrong", (field, input) => {
    expect(parseDraftInput(input)).toEqual({ ok: false, field });
  });

  it("refuses the same action id twice, whatever its case", () => {
    const blocks = [
      { id: ID, type: "call", label: "", value: "", isActive: true },
      { id: ID.toUpperCase(), type: "email", label: "", value: "", isActive: true },
    ];
    expect(parseDraftInput(body({ blocks }))).toEqual({ ok: false, field: "blocks[1].id" });
  });

  it("reads a null label or value as empty, as the database stores them", () => {
    const blocks = [{ id: ID, type: "contact", label: null, value: null, isActive: true }];
    const parsed = parseDraftInput(body({ blocks }));
    expect(parsed.ok && parsed.input.blocks).toEqual([
      { id: ID, type: "contact", label: "", value: "", isActive: true },
    ]);
  });

  it("accepts an empty draft", () => {
    expect(parseDraftInput(body({ title: "", blocks: [] })).ok).toBe(true);
  });
});

describe("isUuid", () => {
  it("accepts uuids and nothing else", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(`${ID} `)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe("actionValueProblem", () => {
  it("allows an action that has not been filled in yet", () => {
    expect(actionValueProblem("website", "")).toBeNull();
    expect(actionValueProblem("whatsapp", "   ")).toBeNull();
  });

  it("accepts what owners actually type", () => {
    expect(actionValueProblem("website", "mamamboga.co.ke")).toBeNull();
    expect(actionValueProblem("instagram", "https://instagram.com/mamamboga")).toBeNull();
    expect(actionValueProblem("whatsapp", "0722 000 000")).toBeNull();
    expect(actionValueProblem("call", "+254722000000")).toBeNull();
    expect(actionValueProblem("email", "hello@mamamboga.co.ke")).toBeNull();
    expect(actionValueProblem("directions", "Westlands, Nairobi")).toBeNull();
    expect(actionValueProblem("directions", "https://maps.app.goo.gl/abc")).toBeNull();
    expect(actionValueProblem("mpesa", "Till 123456")).toBeNull();
    expect(actionValueProblem("contact", "")).toBeNull();
  });

  it("refuses values that would be a dead button", () => {
    expect(actionValueProblem("website", "my shop")).toBe("invalid");
    expect(actionValueProblem("email", "hello at mamamboga")).toBe("invalid");
    expect(actionValueProblem("email", "hello@mamamboga")).toBe("invalid");
    expect(actionValueProblem("whatsapp", "call me")).toBe("invalid");
    expect(actionValueProblem("directions", "https://not a url")).toBe("invalid");
  });
});

describe("draftProblem", () => {
  const input = (blocks: DraftInput["blocks"], redirectUrl?: string): DraftInput => ({
    expectedUpdatedAt: "v",
    title: "",
    config: {},
    theme: {},
    blocks,
    redirectUrl,
  });

  it("points at the first action that would not work", () => {
    const blocks = [
      { id: ID, type: "website" as const, label: "", value: "ok.co.ke", isActive: true },
      { id: ID2, type: "website" as const, label: "", value: "not ok", isActive: false },
    ];
    expect(draftProblem(input(blocks), "page")).toEqual({ code: "invalid_destination", index: 1 });
    expect(draftProblem(input(blocks.slice(0, 1)), "page")).toBeNull();
  });

  it("checks only the destination of a redirect profile", () => {
    const broken = [{ id: ID, type: "website" as const, label: "", value: "not ok", isActive: true }];
    expect(draftProblem(input(broken, "https://wa.me/254722000000"), "redirect")).toBeNull();
    expect(draftProblem(input([], "javascript:alert(1)"), "redirect")).toEqual({
      code: "invalid_redirect",
    });
    expect(draftProblem(input([]), "redirect")).toEqual({ code: "invalid_redirect" });
  });
});

describe("withLeadFormRule", () => {
  it("switches the form off for an account without a live card", () => {
    const config = { bio: "b", leadForm: { enabled: true, headline: "Talk to us" } };
    expect(withLeadFormRule(config, false)).toEqual({
      bio: "b",
      leadForm: { enabled: false, headline: "Talk to us" },
    });
  });

  it("leaves everything else alone", () => {
    const on = { leadForm: { enabled: true } };
    expect(withLeadFormRule(on, true)).toBe(on);
    const off = { bio: "b" };
    expect(withLeadFormRule(off, false)).toBe(off);
  });
});
