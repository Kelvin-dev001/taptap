import { act, fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

/**
 * Who sees which screen (M1): the real app/ routes and layouts, with only
 * Supabase, storage and native modules replaced. Proves the Stack.Protected
 * guards in app/_layout.tsx move between welcome, sign-in, the reset screen
 * and the app by themselves as the session changes.
 */

type AuthEvent =
  "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "PASSWORD_RECOVERY" | "USER_UPDATED";
type Listener = (event: AuthEvent, session: unknown) => void;

const mockStore = new Map<string, string>();
const mockListeners = new Set<Listener>();
const mockAuth = {
  signInWithPassword: jest.fn(),
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  signOut: jest.fn(),
};
let mockOnboarded: boolean | null = true;
const mockOnboardListeners = new Set<() => void>();

const SESSION_KEY = "taptap.session";
const owner = { id: "u-1", email: "owner@business.co.ke" };
const session = { access_token: "a", refresh_token: "r", user: owner };

/** supabase-js telling the app something happened. Inside a mocked call, the
 *  surrounding press is already an act() scope; from a test body, use emit. */
function notify(event: AuthEvent, value: unknown) {
  mockListeners.forEach((listener) => listener(event, value));
}
async function emit(event: AuthEvent, value: unknown) {
  await act(async () => notify(event, value));
}

jest.mock("@/api/supabase", () => ({
  SESSION_KEY: "taptap.session",
  sessionStorage: {
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => void mockStore.set(key, value),
    removeItem: async (key: string) => void mockStore.delete(key),
  },
  get hadSessionAtLaunch() {
    return Promise.resolve(mockStore.has("taptap.session"));
  },
  supabase: {
    auth: {
      ...mockAuth,
      onAuthStateChange: (listener: Listener) => {
        mockListeners.add(listener);
        return { data: { subscription: { unsubscribe: () => mockListeners.delete(listener) } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { account_id: "acc-1", accounts: { name: "Mama Njeri's Café" } },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

jest.mock("@/api/query", () => {
  const { createElement } = jest.requireActual("react");
  const { QueryClient, QueryClientProvider } = jest.requireActual("@tanstack/react-query");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return {
    queryClient: client,
    QueryProvider: ({ children }: { children: unknown }) =>
      createElement(QueryClientProvider, { client }, children),
    clearQueryCache: async () => client.clear(),
  };
});

jest.mock("@/features/onboarding/onboarding", () => ({
  loadOnboarded: () => undefined,
  useOnboarded: () =>
    jest.requireActual("react").useSyncExternalStore(
      (listener: () => void) => {
        mockOnboardListeners.add(listener);
        return () => mockOnboardListeners.delete(listener);
      },
      () => mockOnboarded,
    ),
  completeOnboarding: () => {
    mockOnboarded = true;
    mockOnboardListeners.forEach((listener) => listener());
  },
}));

jest.mock("@/lib/sentry", () => ({
  initSentry: () => undefined,
  sentryEnabled: false,
  Sentry: { wrap: (c: unknown) => c, setUser: () => undefined, captureException: () => undefined },
}));
jest.mock("@/ui/icons", () => new Proxy({}, { get: () => () => null }));
jest.mock("@/features/nfc/reader", () => ({
  nfcAvailability: async () => "unsupported",
  scanCard: jest.fn(),
  cancelScan: async () => undefined,
  openNfcSettings: jest.fn(),
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: async () => undefined,
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: async () => undefined,
  hideAsync: async () => undefined,
}));
jest.mock("expo-system-ui", () => ({ setBackgroundColorAsync: async () => undefined }));

jest.mock("@/config/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseKey: "sb_publishable_test",
    siteUrl: "https://taptap.hornbilltech.co.ke",
  },
  envReady: true,
}));

/** renderRouter returns the (thenable) render result with router helpers attached. */
async function start() {
  const rendered = renderRouter("./app", { initialUrl: "/" });
  await rendered;
  return { getPathname: () => rendered.getPathname() };
}

beforeEach(() => {
  mockStore.clear();
  mockListeners.clear();
  mockOnboarded = true;
  for (const fn of Object.values(mockAuth)) fn.mockReset();
});

describe("first launch", () => {
  it("shows the welcome once, then sign-in", async () => {
    mockOnboarded = false;
    await start();
    expect(await screen.findByText("Your business, in your pocket")).toBeTruthy();

    await fireEvent.press(screen.getByText("Skip"));
    expect(await screen.findByText("Sign in with the email you use for TapTap.")).toBeTruthy();
  });

  it("goes straight to sign-in once the welcome has been seen", async () => {
    await start();
    expect(await screen.findByText("Sign in with the email you use for TapTap.")).toBeTruthy();
    expect(screen.queryByText("You were signed out. Sign in again to carry on.")).toBeNull();
  });
});

describe("signing in", () => {
  it("opens the app when the password is right", async () => {
    mockAuth.signInWithPassword.mockImplementation(async () => {
      mockStore.set(SESSION_KEY, JSON.stringify(session));
      notify("SIGNED_IN", session);
      return { data: { session }, error: null };
    });
    const router = await start();
    await screen.findByText("Sign in with the email you use for TapTap.");

    await fireEvent.changeText(screen.getByTestId("sign-in-email"), " Owner@Business.co.ke ");
    await fireEvent.changeText(screen.getByTestId("sign-in-password"), "correct horse");
    await fireEvent.press(screen.getByTestId("sign-in-submit"));

    expect(await screen.findByText("Mama Njeri's Café")).toBeTruthy();
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@business.co.ke",
      password: "correct horse",
    });
    expect(router.getPathname()).toBe("/");
  });

  it("says why when the password is wrong, and stays put", async () => {
    const { AuthApiError } = jest.requireActual("@supabase/supabase-js");
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    await start();
    await screen.findByText("Sign in with the email you use for TapTap.");

    await fireEvent.changeText(screen.getByTestId("sign-in-email"), "owner@business.co.ke");
    await fireEvent.changeText(screen.getByTestId("sign-in-password"), "wrong");
    await fireEvent.press(screen.getByTestId("sign-in-submit"));

    expect(
      await screen.findByText(
        "That email and password don't match. Try again, or reset your password.",
      ),
    ).toBeTruthy();
  });

  it("sends a code and opens the code screen", async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    const router = await start();
    await screen.findByText("Sign in with the email you use for TapTap.");

    await fireEvent.changeText(screen.getByTestId("sign-in-email"), "owner@business.co.ke");
    await fireEvent.press(screen.getByTestId("sign-in-code"));

    expect(await screen.findByText("We sent a 6-digit code to owner@business.co.ke.")).toBeTruthy();
    expect(router.getPathname()).toBe("/sign-in-code");
    const options = mockAuth.signInWithOtp.mock.calls[0][0].options;
    expect(options.shouldCreateUser).toBe(false);
    expect(options.emailRedirectTo).toContain("/auth/confirm?next=%2Fdashboard");
  });
});

describe("a saved session", () => {
  /** Includes the offline case: supabase-js reports no session when it
   *  cannot refresh, but the stored one still opens the app. */
  it("opens the app without asking the network", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    const router = await start();
    expect(await screen.findByText("Mama Njeri's Café")).toBeTruthy();
    expect(router.getPathname()).toBe("/");
  });

  it("returns to sign-in with a message when the server ends it", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    await start();
    await screen.findByText("Mama Njeri's Café");

    mockStore.delete(SESSION_KEY);
    await emit("SIGNED_OUT", null);

    expect(await screen.findByText("You were signed out. Sign in again to carry on.")).toBeTruthy();
  });
});

describe("resetting a password", () => {
  it("keeps the person on the reset screen until the new password is saved", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockAuth.verifyOtp.mockImplementation(async () => {
      mockStore.set(SESSION_KEY, JSON.stringify(session));
      notify("PASSWORD_RECOVERY", session);
      return { data: { session }, error: null };
    });
    const { AuthApiError } = jest.requireActual("@supabase/supabase-js");
    mockAuth.updateUser
      .mockResolvedValueOnce({
        data: {},
        error: new AuthApiError("same", 422, "same_password"),
      })
      .mockResolvedValueOnce({ data: { user: owner }, error: null });

    const router = await start();
    await screen.findByText("Sign in with the email you use for TapTap.");
    await fireEvent.press(screen.getByText("Forgot password?"));

    await fireEvent.changeText(await screen.findByLabelText("Email"), "owner@business.co.ke");
    await fireEvent.press(screen.getByText("Email me a code"));
    await screen.findByText(
      "If owner@business.co.ke has a TapTap account, we've sent it a 6-digit code.",
    );

    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "123456");
    await fireEvent.changeText(screen.getByLabelText("New password"), "a new password");
    await fireEvent.changeText(screen.getByLabelText("New password again"), "a new password");
    await fireEvent.press(screen.getByText("Save new password"));

    // The code signed them in, but the password was refused: still here.
    expect(await screen.findByText("That's your current password. Choose a new one.")).toBeTruthy();
    expect(screen.getByText("Code accepted. Now choose your new password.")).toBeTruthy();
    expect(router.getPathname()).toBe("/forgot-password");

    await fireEvent.press(screen.getByText("Save new password"));
    expect(await screen.findByText("Mama Njeri's Café")).toBeTruthy();
    // The code is used once; the retry only set the password.
    expect(mockAuth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: "owner@business.co.ke",
      token: "123456",
      type: "recovery",
    });
    expect(router.getPathname()).toBe("/");
  });
});
