import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

const USER = { id: "user-1", email: "owner@example.com" };
const getUser = vi.fn();
const signInWithPassword = vi.fn();
const verifyOtp = vi.fn();
const signInWithOtp = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser, signInWithPassword, verifyOtp, signInWithOtp, signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ admin: true }) }));
const deleteAccount = vi.fn();
vi.mock("@/lib/account-deletion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/account-deletion")>()),
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));

const { deleteAccountAction, sendDeletionCodeAction } = await import("./actions");
const { default: DeleteAccountPage } = await import("./page");

/** A Supabase access token whose sign-in (amr) happened `agoSeconds` ago. */
function token(agoSeconds = 5): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const at = Math.floor(Date.now() / 1000) - agoSeconds;
  return `${b64({ alg: "HS256" })}.${b64({ sub: USER.id, amr: [{ method: "password", timestamp: at }] })}.sig`;
}

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const fresh = (id = USER.id, ago = 5) => ({ data: { user: { id }, session: { access_token: token(ago) } }, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: USER } });
  signInWithPassword.mockResolvedValue(fresh());
  verifyOtp.mockResolvedValue(fresh());
  signInWithOtp.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  deleteAccount.mockResolvedValue({ ok: true, scope: "account", photosRemoved: 0 });
});

async function run(fields: Record<string, string>) {
  try {
    return { state: await deleteAccountAction({ error: null }, form(fields)), redirect: null };
  } catch (e) {
    if (e instanceof Redirect) return { state: null, redirect: e.to };
    throw e;
  }
}

describe("deleting an account on the web (PLAN.md §9 W7)", () => {
  it("deletes the session's own user after a fresh password check, then signs out", async () => {
    const { redirect } = await run({ method: "password", password: "secret-pass", confirm: "on", userId: "someone-else" });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: USER.email, password: "secret-pass" });
    // The id comes from the session — never from the form.
    expect(deleteAccount).toHaveBeenCalledWith({ admin: true }, USER.id);
    expect(signOut).toHaveBeenCalled();
    expect(redirect).toBe("/account/delete?done=account");
  });

  it("accepts an emailed code instead of the password", async () => {
    const { redirect } = await run({ method: "code", code: " 123456 ", confirm: "on" });
    expect(verifyOtp).toHaveBeenCalledWith({ email: USER.email, token: "123456", type: "email" });
    expect(redirect).toBe("/account/delete?done=account");
  });

  it("says when only this person was removed from a shared account", async () => {
    deleteAccount.mockResolvedValue({ ok: true, scope: "member", photosRemoved: 0 });
    const { redirect } = await run({ method: "password", password: "p", confirm: "on" });
    expect(redirect).toBe("/account/delete?done=member");
  });

  it.each([
    ["not ticked", { method: "password", password: "p" }, /Tick the box/],
    ["no password", { method: "password", password: "", confirm: "on" }, /password isn't right/],
  ])("refuses when %s, before touching anything", async (_n, fields, message) => {
    const { state } = await run(fields);
    expect(state?.error).toMatch(message);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("refuses a wrong password or code", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { code: "invalid_credentials", status: 400 } });
    expect((await run({ method: "password", password: "wrong", confirm: "on" })).state?.error).toMatch(/password isn't right/);
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "otp_expired", status: 403 } });
    expect((await run({ method: "code", code: "000000", confirm: "on" })).state?.error).toMatch(/code is wrong/);
    signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { status: 429 } });
    expect((await run({ method: "password", password: "x", confirm: "on" })).state?.error).toMatch(/Too many tries/);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("refuses a proof for someone else, or one that is not fresh", async () => {
    signInWithPassword.mockResolvedValue(fresh("user-2"));
    expect((await run({ method: "password", password: "p", confirm: "on" })).state?.error).toMatch(/Sign in again/);
    signInWithPassword.mockResolvedValue(fresh(USER.id, 3600));
    expect((await run({ method: "password", password: "p", confirm: "on" })).state?.error).toMatch(/Sign in again/);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await run({ method: "password", password: "p", confirm: "on" })).state?.error).toMatch(/Sign in again/);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("explains staff refusals and keeps the person signed in after a failure", async () => {
    deleteAccount.mockResolvedValue({ ok: false, code: "staff" });
    expect((await run({ method: "password", password: "p", confirm: "on" })).state?.error).toMatch(/administrator/);
    deleteAccount.mockResolvedValue({ ok: false, code: "error", message: "boom" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await run({ method: "password", password: "p", confirm: "on" })).state?.error).toMatch(/Nothing was lost/);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("emails a code to the session's own address only", async () => {
    await expect(sendDeletionCodeAction()).resolves.toEqual({ error: null });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: USER.email, options: { shouldCreateUser: false } });
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await sendDeletionCodeAction()).error).toMatch(/Sign in again/);
  });
});

describe("the /account/delete page", () => {
  const page = async (query: Record<string, string> = {}) => render(await DeleteAccountPage({ searchParams: Promise.resolve(query) }));

  it("tells anyone, signed out, what is deleted and kept, and how to delete", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await page();
    expect(screen.getByText(/Your profiles, their actions and analytics, and every lead/)).toBeTruthy();
    expect(screen.getByText(/for 5 years, as Kenyan tax law requires/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to delete your account" }).getAttribute("href")).toBe("/login?next=/account/delete");
    expect(screen.getByText(/Account → Delete account/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "info@hornbilltech.co.ke" })).toBeTruthy();
  });

  it("shows the form when signed in, and the button waits for the tick", async () => {
    await page();
    const button = screen.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Use an emailed code instead" }));
    expect(screen.getByRole("button", { name: "Email me a code" })).toBeTruthy();
    expect(button.disabled).toBe(true);
  });

  it("confirms a finished deletion without asking who is signed in", async () => {
    await page({ done: "account" });
    expect(screen.getByText("Your account has been deleted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete my account" })).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
