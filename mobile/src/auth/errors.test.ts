import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from "@supabase/supabase-js";
import en from "@/i18n/en.json";
import { authErrorKey } from "./errors";

const api = (code: string, status = 400) => new AuthApiError("server text", status, code);

describe("authErrorKey", () => {
  it.each([
    ["invalid_credentials", "auth.errors.wrongPassword"],
    ["otp_disabled", "auth.errors.noAccount"],
    ["user_not_found", "auth.errors.noAccount"],
    ["otp_expired", "auth.errors.wrongCode"],
    ["over_email_send_rate_limit", "auth.errors.emailWait"],
    ["over_request_rate_limit", "auth.errors.tooMany"],
    ["email_not_confirmed", "auth.errors.notConfirmed"],
    ["same_password", "auth.errors.samePassword"],
    ["user_banned", "auth.errors.blocked"],
    ["email_address_invalid", "auth.errors.invalidEmail"],
  ])("maps %s", (code, key) => {
    expect(authErrorKey(api(code))).toBe(key);
  });

  it("calls a network failure being offline", () => {
    expect(authErrorKey(new AuthRetryableFetchError("Failed to fetch", 0))).toBe(
      "auth.errors.offline",
    );
    expect(authErrorKey(new TypeError("Network request failed"))).toBe("auth.errors.offline");
  });

  it("maps a weak password", () => {
    expect(authErrorKey(new AuthWeakPasswordError("weak", 422, ["length"]))).toBe(
      "auth.errors.weakPassword",
    );
  });

  it("treats any 429 as too many attempts", () => {
    expect(authErrorKey(new AuthApiError("slow down", 429, undefined))).toBe("auth.errors.tooMany");
  });

  it("never shows Supabase's own text for anything else", () => {
    expect(authErrorKey(api("unexpected_failure", 500))).toBe("auth.errors.unknown");
    expect(authErrorKey(new Error("boom"))).toBe("auth.errors.unknown");
    expect(authErrorKey(undefined)).toBe("auth.errors.unknown");
  });

  it("has English for every key it can return", () => {
    const keys = Object.keys(en.auth.errors).map((k) => `auth.errors.${k}`);
    for (const err of [
      api("invalid_credentials"),
      api("otp_disabled"),
      api("otp_expired"),
      api("over_email_send_rate_limit"),
      api("over_request_rate_limit"),
      api("email_not_confirmed"),
      api("same_password"),
      api("user_banned"),
      api("email_address_invalid"),
      new AuthWeakPasswordError("weak", 422, []),
      new AuthRetryableFetchError("x", 0),
      new Error("x"),
    ]) {
      expect(keys).toContain(authErrorKey(err));
    }
  });
});
