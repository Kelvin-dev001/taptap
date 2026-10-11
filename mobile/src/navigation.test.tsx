import { act, fireEvent, screen } from "@testing-library/react-native";
import { router as appRouter } from "expo-router";
import { renderRouter } from "expo-router/testing-library";

/**
 * Who sees which screen (M1): the real app/ routes and layouts, with only
 * Supabase, storage and native modules replaced. Proves the Stack.Protected
 * guards in app/_layout.tsx move between welcome, sign-in, the reset screen
 * and the app by themselves as the session changes.
 *
 * M2 adds Home and the editor on the same harness: the profile from the
 * (mocked) database, its status, and an edit flowing through autosave.
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

/** One live profile, published from exactly this draft. */
const mockAction = { id: "l-1", type: "whatsapp", label: "Chat on WhatsApp", value: "0722000000" };
const mockPage = {
  id: "p-1",
  slug: "mama-njeri",
  title: "Mama Njeri's",
  mode: "page",
  redirect_url: null,
  config: { bio: "Coffee and mandazi" },
  theme: {},
  status: "published",
  is_active: true,
  published_at: "2026-10-01T09:00:00+00:00",
  published_content: {
    id: "p-1",
    title: "Mama Njeri's",
    mode: "page",
    redirect_url: null,
    config: { bio: "Coffee and mandazi" },
    theme: {},
    links: [{ ...mockAction, sort_order: 0 }],
  },
  updated_at: "2026-10-01T08:59:00.123456+00:00",
  created_at: "2026-09-01T09:00:00+00:00",
  // Live whatever cards the account holds (D-023), so the test needs none.
  entitlement_grandfathered: true,
  links: [{ ...mockAction, sort_order: 0, is_active: true }],
};
const mockCallAppApi = jest.fn();
const mockRpc = jest.fn();

/** Leads the account has in a test; empty unless a test fills it. */
let mockLeadRows: Record<string, unknown>[] = [];
const mockLeadUpdate = jest.fn();

/** What each database function answers in these tests: an account with no activity yet. */
function mockRpcAnswer(fn: string): unknown {
  switch (fn) {
    case "get_lead_counts": {
      const by: Record<string, number> = {};
      for (const l of mockLeadRows) by[l.status as string] = (by[l.status as string] ?? 0) + 1;
      return { all: mockLeadRows.length, by_status: by };
    }
    case "get_leads":
      return mockLeadRows;
    case "get_analytics":
      return {
        days: 7, scope: "account", pages: 1, totals: {}, previous: {}, leads: 0, previous_leads: 0,
        daily: [], by_source: [], by_device: [], by_country: [], by_hour: [], top_blocks: [], top_pages: [],
      };
    default:
      return { ok: true };
  }
}

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
    from: (table: string) => {
      if (table === "smart_pages") {
        return {
          select: () => ({
            order: () => ({ order: async () => ({ data: [mockPage], error: null }) }),
          }),
        };
      }
      if (table === "nfc_tags") return { select: async () => ({ data: [], error: null }) };
      if (table === "leads") {
        return {
          update: (patch: unknown) => ({
            eq: async (_col: string, id: string) => {
              mockLeadUpdate(id, patch);
              return { error: null };
            },
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { account_id: "acc-1", accounts: { name: "Mama Njeri's Café" } },
              error: null,
            }),
          }),
        }),
      };
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock("@/api/query", () => {
  const { createElement } = jest.requireActual("react");
  const { QueryClient, QueryClientProvider } = jest.requireActual("@tanstack/react-query");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  // As the real src/api/query.tsx does at start: queued lead edits need it.
  jest.requireActual("@/api/lead-edits").registerLeadEdits(client);
  return {
    queryClient: client,
    QueryProvider: ({ children }: { children: unknown }) =>
      createElement(QueryClientProvider, { client }, children),
    clearQueryCache: async () => client.clear(),
  };
});

jest.mock("expo-crypto", () => ({ randomUUID: () => "11111111-2222-4333-8444-555555555555" }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/api/app-api", () => ({
  callAppApi: (...args: unknown[]) => mockCallAppApi(...args),
  NetworkError: class extends Error {},
  NotSignedInError: class extends Error {},
}));

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
  selectionAsync: async () => undefined,
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

beforeEach(async () => {
  // The cache and the unsent-edits store live for the whole app run — here,
  // the whole file. Each test starts from nothing, as a fresh install would.
  jest.requireMock<{ queryClient: { clear(): void } }>("@/api/query").queryClient.clear();
  await jest
    .requireActual<typeof import("@/features/profile/draft-sync-instance")>(
      "@/features/profile/draft-sync-instance",
    )
    .draftSync.clear();
  mockStore.clear();
  mockListeners.clear();
  mockOnboarded = true;
  for (const fn of Object.values(mockAuth)) fn.mockReset();
  mockCallAppApi.mockReset();
  mockRpc.mockReset();
  mockLeadRows = [];
  mockLeadUpdate.mockReset();
  mockRpc.mockImplementation(async (fn: string) => ({ data: mockRpcAnswer(fn), error: null }));
  mockCallAppApi.mockResolvedValue({ status: 200, body: { updatedAt: "2026-10-11T10:00:00.000001+00:00" } });
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

describe("home and the editor (M2)", () => {
  it("shows the live profile as customers see it, with its status", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    await start();
    expect(await screen.findByText("Live")).toBeTruthy();
    expect(screen.getByText("Customers see this profile when they tap your card or open your link.")).toBeTruthy();
    expect(screen.getByText("What customers see")).toBeTruthy();
    // The published snapshot, rendered natively.
    expect(screen.getByText("Chat on WhatsApp")).toBeTruthy();
    expect(screen.getByText("Coffee and mandazi")).toBeTruthy();
    expect(screen.getByText("taptap.hornbilltech.co.ke/mama-njeri")).toBeTruthy();
  });

  it("saves an edit by itself, and Home says it is not live yet", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    const router = await start();
    await screen.findByText("Live");

    await fireEvent.press(screen.getByText("Edit profile"));
    expect(router.getPathname()).toBe("/profile/p-1/edit");
    const name = await screen.findByLabelText("Business name");
    expect(name.props.value).toBe("Mama Njeri's");

    await fireEvent.changeText(name, "Mama Njeri's Kitchen");
    expect(await screen.findByText("Saving…")).toBeTruthy();
    expect(screen.getByText("Unpublished changes")).toBeTruthy();

    // A moment after typing stops, the draft goes to the server with its ids.
    expect(await screen.findByText("Saved", undefined, { timeout: 4000 })).toBeTruthy();
    expect(mockCallAppApi).toHaveBeenCalledTimes(1);
    const [method, path, body] = mockCallAppApi.mock.calls[0];
    expect(method).toBe("PUT");
    expect(path).toBe("/api/app/v1/pages/p-1/draft");
    expect(body).toMatchObject({
      expectedUpdatedAt: "2026-10-01T08:59:00.123456+00:00",
      title: "Mama Njeri's Kitchen",
      blocks: [{ id: "l-1", type: "whatsapp", label: "Chat on WhatsApp", value: "0722000000", isActive: true }],
    });
    // Saved is not published: customers still see the old name.
    expect(screen.getByText("Unpublished changes")).toBeTruthy();
  });

  it("adds an action only once it works", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    const router = await start();
    await screen.findByText("Live");
    await fireEvent.press(screen.getByText("Edit profile"));
    await screen.findByLabelText("Business name");

    await fireEvent.press(screen.getByText("Add action"));
    expect(await screen.findByText("Add an action")).toBeTruthy();
    await fireEvent.press(screen.getByText("WhatsApp"));
    expect(router.getPathname()).toBe("/profile/p-1/action");

    const number = await screen.findByLabelText("WhatsApp number");
    await fireEvent.changeText(number, "0722 000");
    await fireEvent.press(screen.getByText("Add action"));
    expect(
      await screen.findByText("That number is too short. Kenyan numbers have 10 digits, like 0722 000 000."),
    ).toBeTruthy();
    expect(router.getPathname()).toBe("/profile/p-1/action");

    await fireEvent.changeText(screen.getByLabelText(/WhatsApp number/), "0722 000 111");
    await fireEvent.press(screen.getByText("Add action"));
    expect(router.getPathname()).toBe("/profile/p-1/edit");

    expect(await screen.findByText("Saved", undefined, { timeout: 4000 })).toBeTruthy();
    const body = mockCallAppApi.mock.calls[0][2];
    expect(body.blocks).toEqual([
      { id: "l-1", type: "whatsapp", label: "Chat on WhatsApp", value: "0722000000", isActive: true },
      { id: "11111111-2222-4333-8444-555555555555", type: "whatsapp", label: "", value: "0722 000 111", isActive: true },
    ]);
  });

  it("stops at a change made elsewhere and lets the owner keep theirs", async () => {
    mockCallAppApi.mockResolvedValueOnce({
      status: 409,
      body: { code: "conflict", updatedAt: "2026-10-11T09:30:00.000001+00:00" },
    });
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    await start();
    await screen.findByText("Live");
    await fireEvent.press(screen.getByText("Edit profile"));
    await fireEvent.changeText(await screen.findByLabelText("Business name"), "Mine");

    expect(await screen.findByText("Changed somewhere else", undefined, { timeout: 4000 })).toBeTruthy();
    expect(mockCallAppApi).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("Keep my version"));
    expect(await screen.findByText("Saved", undefined, { timeout: 4000 })).toBeTruthy();
    expect(mockCallAppApi.mock.calls[1][2]).toMatchObject({
      expectedUpdatedAt: "2026-10-11T09:30:00.000001+00:00",
      title: "Mine",
    });
  });

  it("publishes the saved draft through publish_page", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    await start();
    await screen.findByText("Live");
    await fireEvent.press(screen.getByText("Edit profile"));
    await fireEvent.changeText(await screen.findByLabelText("Business name"), "Mama Njeri's Kitchen");

    // Publishing waits for the save, so nothing older goes live.
    await fireEvent.press(screen.getByText("Publish changes"));
    expect(await screen.findByText("Published. Customers see your changes now.", undefined, { timeout: 4000 })).toBeTruthy();
    expect(mockCallAppApi).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("publish_page", { p_page_id: "p-1" });
    const publishCall = mockRpc.mock.calls.findIndex(([fn]) => fn === "publish_page");
    expect(mockCallAppApi.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[publishCall]);
  });
});

describe("leads and analytics (M3)", () => {
  const lead = (n: number, overrides: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    smart_page_id: "p-1",
    page_title: "Mama Njeri's",
    page_slug: "mama-njeri",
    name: `Customer ${n}`,
    phone: "0722000000",
    email: null,
    company: null,
    message: `Message ${n}`,
    status: "new",
    note: null,
    created_at: "2026-10-11T08:00:00.000001+00:00",
    updated_at: null,
    repeat_count: 0,
    ...overrides,
  });

  it("lists leads with counts, opens one, and marks it won at once", async () => {
    mockLeadRows = [lead(1, { repeat_count: 1 }), lead(2, { status: "contacted", phone: "0722000000" })];
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    const router = await start();
    await screen.findByText("Live");
    await act(async () => appRouter.push("/leads"));

    expect(await screen.findByText("Customer 1")).toBeTruthy();
    expect(screen.getByLabelText("New, 1 leads")).toBeTruthy();
    expect(screen.getByLabelText("Contacted, 1 leads")).toBeTruthy();

    await fireEvent.press(screen.getByText("Customer 1"));
    expect(router.getPathname()).toBe("/lead/00000000-0000-4000-8000-000000000001");
    // WhatsApp first, then a call.
    expect(await screen.findByText("WhatsApp")).toBeTruthy();
    expect(screen.getByText("Message 1")).toBeTruthy();
    // The other submission from the same number is listed as an earlier enquiry.
    expect(screen.getByText("Earlier enquiries")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Won"));
    expect(mockLeadUpdate).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      expect.objectContaining({ status: "won" }),
    );
    expect(await screen.findByText("Became a customer")).toBeTruthy();
  });

  it("shows the account's numbers, and says plainly what needs a card", async () => {
    mockStore.set(SESSION_KEY, JSON.stringify(session));
    await start();
    await screen.findByText("Live");
    await act(async () => appRouter.push("/analytics"));

    expect(await screen.findByText("Profile views")).toBeTruthy();
    expect(screen.getByText("Clicks and confirmed actions")).toBeTruthy();
    // No card on this account: the detail is described, never sold.
    expect(
      screen.getByText(
        "How visitors arrived, which card, where and when show on accounts with an active TapTap card.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/buy|upgrade|renew|KES/i)).toBeNull();
  });
});
