import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailLinkNext, emailLinkTarget } from "@/lib/email-link";

/** next/navigation's redirect() throws to stop rendering; the mock does the same. */
class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { verifyOtp } }),
}));

const { confirmEmailLink } = await import("./actions");

const params = (query: string) => new URLSearchParams(query);

/**
 * The templates send `redirect_to` as the full redirect the sign-in asked for.
 * Whether Supabase escapes it inside the href or not, the destination must
 * survive — and must never leave the site.
 */
describe("emailLinkNext", () => {
  it("reads next from inside redirect_to, escaped or not", () => {
    const redirect = "https://taptap.hornbilltech.co.ke/auth/confirm?next=%2Fadmin";
    expect(emailLinkNext(params(`redirect_to=${encodeURIComponent(redirect)}`))).toBe("/admin");
    expect(emailLinkNext(params(`token_hash=x&redirect_to=${redirect}`))).toBe("/admin");
  });

  it("prefers a plain next", () => {
    expect(emailLinkNext(params("next=%2Fdashboard%2Fdevices&redirect_to=x"))).toBe(
      "/dashboard/devices",
    );
  });

  it("falls back to the dashboard when there is nothing usable", () => {
    expect(emailLinkNext(params(""))).toBe("/dashboard");
    expect(emailLinkNext(params("redirect_to=not%20a%20url"))).toBe("/dashboard");
    // A redirect with no next — what an older template or a trimmed redirect gives.
    expect(emailLinkNext(params("redirect_to=https%3A%2F%2Ftaptap.hornbilltech.co.ke"))).toBe(
      "/dashboard",
    );
  });

  it("never lets redirect_to choose another site", () => {
    for (const hostile of [
      "https://evil.example/auth/confirm?next=https%3A%2F%2Fevil.example",
      "https://evil.example/?next=%2F%2Fevil.example",
      "https://evil.example/?next=%2F%5Cevil.example",
      "https://evil.example/",
    ]) {
      const out = emailLinkNext(params(`redirect_to=${encodeURIComponent(hostile)}`));
      expect(new URL(out, "https://taptap.hornbilltech.co.ke").origin).toBe(
        "https://taptap.hornbilltech.co.ke",
      );
    }
  });
});

describe("emailLinkTarget", () => {
  it("asks for confirmation for a well-formed email link", () => {
    expect(emailLinkTarget(params("token_hash=abc&type=recovery&next=%2Freset-password"))).toEqual({
      kind: "confirm",
      tokenHash: "abc",
      type: "recovery",
      next: "/reset-password",
    });
  });

  it("refuses an unknown type", () => {
    expect(emailLinkTarget(params("token_hash=abc&type=admin"))).toEqual({ kind: "invalid" });
    expect(emailLinkTarget(params("token_hash=abc"))).toEqual({ kind: "invalid" });
  });

  /** If a template still produces an OAuth-style link, or Supabase reports an
   *  expired link on the query string, the callback already knows what to do. */
  it("hands OAuth codes and provider errors to /auth/callback", () => {
    expect(emailLinkTarget(params("code=xyz&next=%2Fadmin"))).toEqual({
      kind: "callback",
      query: "code=xyz&next=%2Fadmin",
    });
    expect(emailLinkTarget(params("error=access_denied")).kind).toBe("callback");
  });

  it("does nothing for a bare visit", () => {
    expect(emailLinkTarget(params(""))).toEqual({ kind: "none" });
  });
});

describe("confirmEmailLink", () => {
  beforeEach(() => verifyOtp.mockReset());

  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
  };

  async function redirectOf(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (e) {
      if (e instanceof Redirect) return e.to;
      throw e;
    }
    throw new Error("expected a redirect");
  }

  it("uses the token, then goes to next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const to = await redirectOf(
      confirmEmailLink(form({ token_hash: "abc", type: "email", next: "/admin" })),
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(to).toBe("/admin");
  });

  it("re-checks next rather than trusting the page", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const to = await redirectOf(
      confirmEmailLink(form({ token_hash: "abc", type: "email", next: "//evil.example" })),
    );
    expect(to).toBe("/dashboard");
  });

  it("sends an expired or used link back to sign-in with the reason", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Email link is invalid or has expired" } });
    const to = await redirectOf(confirmEmailLink(form({ token_hash: "abc", type: "email" })));
    expect(to).toBe(`/login?error=${encodeURIComponent("Email link is invalid or has expired")}`);
  });

  it("never calls Supabase with a forged type or a missing token", async () => {
    await redirectOf(confirmEmailLink(form({ token_hash: "abc", type: "admin" })));
    await redirectOf(confirmEmailLink(form({ type: "email" })));
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
