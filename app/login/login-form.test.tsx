import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => ({
    auth: { signInWithOtp, signInWithOAuth, signInWithPassword, signUp, resetPasswordForEmail },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  signInWithOtp.mockResolvedValue({ error: null });
  signInWithOAuth.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

describe("LoginForm", () => {
  it("defaults the email path to a magic link, not a password", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it("sends a magic link and confirms where it went", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "owner@macauditcpa.co.ke");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0][0].email).toBe("owner@macauditcpa.co.ke");
    // The address is shown back so a typo is visible before they go hunting.
    expect(await screen.findByText("owner@macauditcpa.co.ke")).toBeTruthy();
  });

  /**
   * Guards the one destructive default in the OTP API. shouldCreateUser
   * defaults to true, which would silently create an account for a mistyped
   * address that the user believed already existed — and then mail a "sign-in"
   * link to a stranger.
   */
  it("does not create an account from the sign-in tab", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "typo@example.com");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
  });

  it("does create one from the sign-up tab", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /create one/i }));
    await user.type(screen.getByLabelText(/email/i), "new@business.co.ke");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(true);
  });

  it("routes every email link back through /auth/callback", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "owner@macauditcpa.co.ke");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toContain("/auth/callback");
  });

  /**
   * The button must not exist until the provider is actually configured in
   * Supabase. Shipped ahead of that it would be the most prominent control on
   * the screen and fail for everyone who trusted it.
   */
  it("hides Google until it is switched on", () => {
    render(<LoginForm />);
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
  });

  describe("with Google enabled", () => {
    beforeEach(() => vi.stubEnv("NEXT_PUBLIC_ENABLE_GOOGLE_AUTH", "true"));
    afterEach(() => vi.unstubAllEnvs());

    it("sends Google through the same callback", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
      expect(signInWithOAuth.mock.calls[0][0].provider).toBe("google");
      expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).toContain("/auth/callback");
    });
  });

  it("keeps the password path available behind a toggle", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /use a password instead/i }));
    await user.type(screen.getByLabelText(/email/i), "owner@macauditcpa.co.ke");
    await user.type(screen.getByLabelText(/password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("surfaces an expired-link error passed from the callback route", () => {
    render(<LoginForm initialError="Email link is invalid or has expired" />);
    expect(screen.getByRole("alert").textContent).toContain("expired");
  });

  it("reports a provider failure instead of leaving the button spinning", async () => {
    const user = userEvent.setup();
    signInWithOtp.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "owner@macauditcpa.co.ke");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("rate limit");
    // Still on the form, not stranded on a success panel.
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeTruthy();
  });

  describe("forgot password", () => {
    /** Only reachable from the password path — there is nothing to reset when
     *  signing in by link. */
    it("is offered once the password field is shown", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      expect(screen.queryByRole("button", { name: /forgot password/i })).toBeNull();
      await user.click(screen.getByRole("button", { name: /use a password instead/i }));
      expect(screen.getByRole("button", { name: /forgot password/i })).toBeTruthy();
    });

    it("sends a reset link and confirms where it went", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole("button", { name: /use a password instead/i }));
      await user.click(screen.getByRole("button", { name: /forgot password/i }));
      await user.type(screen.getByLabelText(/email/i), "owner@macauditcpa.co.ke");
      await user.click(screen.getByRole("button", { name: /email me a reset link/i }));

      await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalled());
      expect(resetPasswordForEmail.mock.calls[0][0]).toBe("owner@macauditcpa.co.ke");
      expect(await screen.findByText("owner@macauditcpa.co.ke")).toBeTruthy();
    });

    /** The recovery link must land on the page that actually sets the password,
     *  not the dashboard — otherwise the user is signed in but never prompted. */
    it("routes the link through the callback to /reset-password", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole("button", { name: /use a password instead/i }));
      await user.click(screen.getByRole("button", { name: /forgot password/i }));
      await user.type(screen.getByLabelText(/email/i), "owner@macauditcpa.co.ke");
      await user.click(screen.getByRole("button", { name: /email me a reset link/i }));

      await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalled());
      const opts = resetPasswordForEmail.mock.calls[0][1];
      expect(opts.redirectTo).toContain("/auth/callback");
      expect(opts.redirectTo).toContain("next=/reset-password");
    });

    it("never asks for a password while resetting", async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole("button", { name: /use a password instead/i }));
      await user.click(screen.getByRole("button", { name: /forgot password/i }));

      expect(screen.queryByLabelText(/password/i)).toBeNull();
      expect(screen.getByRole("button", { name: /back to sign in/i })).toBeTruthy();
    });
  });
});
