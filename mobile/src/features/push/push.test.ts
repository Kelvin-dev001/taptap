import { Platform } from "react-native";
import {
  needsBackgroundHelp,
  registerThisPhone,
  routeFor,
  setPrefs,
  storedToken,
  toPrefs,
  unregisterThisPhone,
} from "./push";

let mockPermission = "granted";
let mockTokenError = false;
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: async () => ({ status: mockPermission }),
  getExpoPushTokenAsync: async () => {
    if (mockTokenError) throw new Error("No Firebase config in this build");
    return { data: "ExponentPushToken[phone-1]" };
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({ expoConfig: { extra: { eas: { projectId: "project-1" } }, version: "0.1.0" } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockRpc = jest.fn();
jest.mock("@/api/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

const ID = "00000000-0000-4000-8000-000000000001";

beforeEach(async () => {
  mockPermission = "granted";
  mockTokenError = false;
  mockRpc.mockReset();
  await jest.requireMock<{ clear(): Promise<void> }>("@react-native-async-storage/async-storage").clear();
});

describe("routeFor", () => {
  it("opens what the notification is about (PLAN.md §7.4)", () => {
    expect(routeFor({ kind: "lead", id: ID })).toBe(`/lead/${ID}`);
    expect(routeFor({ kind: "first_tap", id: ID })).toBe(`/card/${ID}`);
    expect(routeFor({ kind: "term", id: ID })).toBe("/cards");
  });

  it("falls back to the list, or Home, for anything odd — never a path from the payload", () => {
    expect(routeFor({ kind: "lead" })).toBe("/leads");
    expect(routeFor({ kind: "lead", id: "../../settings/delete-account" })).toBe("/leads");
    expect(routeFor({ kind: "first_tap", id: 5 })).toBe("/cards");
    expect(routeFor({ kind: "promo" })).toBe("/");
    expect(routeFor(null)).toBe("/");
  });
});

describe("toPrefs", () => {
  it("reads each switch, defaulting to on", () => {
    expect(toPrefs({ lead: false })).toEqual({ lead: false, first_tap: true, term: true });
    expect(toPrefs(null)).toEqual({ lead: true, first_tap: true, term: true });
  });
});

describe("registering this phone", () => {
  it("sends the Expo token with the platform, version and locale, and remembers it", async () => {
    mockRpc.mockResolvedValue({ data: { prefs: { lead: true, first_tap: false, term: true } }, error: null });
    await expect(registerThisPhone()).resolves.toEqual({ lead: true, first_tap: false, term: true });
    expect(mockRpc).toHaveBeenCalledWith(
      "register_push_device",
      expect.objectContaining({ p_token: "ExponentPushToken[phone-1]", p_platform: Platform.OS === "ios" ? "ios" : "android" }),
    );
    await expect(storedToken()).resolves.toBe("ExponentPushToken[phone-1]");
  });

  it("does nothing without permission, or without a push token (no Firebase config)", async () => {
    mockPermission = "denied";
    await expect(registerThisPhone()).resolves.toBeNull();
    mockPermission = "granted";
    mockTokenError = true;
    await expect(registerThisPhone()).resolves.toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("changes a switch for this phone only", async () => {
    mockRpc.mockResolvedValueOnce({ data: { prefs: {} }, error: null });
    await registerThisPhone();
    mockRpc.mockResolvedValueOnce({ data: { prefs: { lead: false } }, error: null });
    await expect(setPrefs({ lead: false })).resolves.toEqual({ lead: false, first_tap: true, term: true });
    expect(mockRpc).toHaveBeenLastCalledWith("set_push_prefs", { p_token: "ExponentPushToken[phone-1]", p_prefs: { lead: false } });
  });
});

describe("signing out", () => {
  it("removes this phone from the account, then forgets its token", async () => {
    mockRpc.mockResolvedValue({ data: { prefs: {} }, error: null });
    await registerThisPhone();
    await unregisterThisPhone();
    expect(mockRpc).toHaveBeenLastCalledWith("unregister_push_device", { p_token: "ExponentPushToken[phone-1]" });
    await expect(storedToken()).resolves.toBeNull();
  });

  it("never holds sign-out up for long when the server does not answer", async () => {
    mockRpc.mockResolvedValueOnce({ data: { prefs: {} }, error: null });
    await registerThisPhone();
    mockRpc.mockImplementation(() => new Promise(() => undefined));
    const started = Date.now();
    await unregisterThisPhone(50);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("does nothing on a phone that never registered", async () => {
    await unregisterThisPhone();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("needsBackgroundHelp", () => {
  const original = Platform.constants;
  afterEach(() => Object.defineProperty(Platform, "constants", { value: original, configurable: true }));

  it.each([
    ["TECNO", "TECNO MOBILE LIMITED", true],
    ["Infinix", "INFINIX MOBILITY LIMITED", true],
    ["itel", "itel", true],
    ["samsung", "samsung", false],
  ])("%s → %s", (brand, manufacturer, expected) => {
    Object.defineProperty(Platform, "constants", { value: { ...original, Brand: brand, Manufacturer: manufacturer }, configurable: true });
    expect(needsBackgroundHelp()).toBe(Platform.OS === "android" ? expected : false);
  });
});
