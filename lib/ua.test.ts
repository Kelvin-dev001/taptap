import { describe, it, expect } from "vitest";
import { parseUA } from "./ua";

describe("parseUA", () => {
  it("Android mobile", () => {
    const r = parseUA(
      "Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit Mobile Safari",
    );
    expect(r.os).toBe("Android");
    expect(r.device).toBe("mobile");
  });
  it("iPhone", () => {
    const r = parseUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari",
    );
    expect(r.os).toBe("iOS");
    expect(r.device).toBe("mobile");
  });
  it("iPad is a tablet", () => {
    const r = parseUA("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari");
    expect(r.device).toBe("tablet");
  });
  it("Windows desktop", () => {
    const r = parseUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome");
    expect(r.os).toBe("Windows");
    expect(r.device).toBe("desktop");
  });
  it("empty -> unknown/desktop", () => {
    const r = parseUA("");
    expect(r.os).toBe("unknown");
    expect(r.device).toBe("desktop");
  });
});
