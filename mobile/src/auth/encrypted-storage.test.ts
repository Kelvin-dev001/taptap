import { createEncryptedStorage, type KeyStore, type ValueStore } from "./encrypted-storage";

function fakes() {
  const secure = new Map<string, string>();
  const plain = new Map<string, string>();
  const keys: KeyStore = {
    getItemAsync: async (k) => secure.get(k) ?? null,
    setItemAsync: async (k, v) => void secure.set(k, v),
    deleteItemAsync: async (k) => void secure.delete(k),
  };
  const values: ValueStore = {
    getItem: async (k) => plain.get(k) ?? null,
    setItem: async (k, v) => void plain.set(k, v),
    removeItem: async (k) => void plain.delete(k),
  };
  // Deterministic, and different on every call (as real random bytes would be).
  let call = 0;
  const randomBytes = (n: number) => {
    call += 1;
    return Uint8Array.from({ length: n }, (_, i) => (call * 37 + i * 11) % 256);
  };
  return { secure, plain, storage: createEncryptedStorage({ keys, values, randomBytes }) };
}

const SESSION = JSON.stringify({
  access_token: "example-access-token",
  refresh_token: "r-123",
  user: { id: "u-1", email: "owner@business.co.ke" },
});

describe("encrypted session storage", () => {
  it("returns what was stored", async () => {
    const { storage } = fakes();
    await storage.setItem("taptap.session", SESSION);
    expect(await storage.getItem("taptap.session")).toBe(SESSION);
  });

  it("keeps nothing readable in AsyncStorage", async () => {
    const { storage, plain } = fakes();
    await storage.setItem("taptap.session", SESSION);
    const stored = plain.get("taptap.session")!;
    expect(stored).not.toContain("refresh_token");
    expect(stored).not.toContain("owner@business.co.ke");
    expect(stored).toMatch(/^[0-9a-f]+$/);
  });

  it("keeps only the 32-byte key in SecureStore, well under its 2 KB limit", async () => {
    const { storage, secure } = fakes();
    await storage.setItem("taptap.session", SESSION.repeat(20));
    const [name, key] = [...secure.entries()][0];
    expect(name).toBe("taptap.session.key");
    expect(key).toHaveLength(64);
  });

  it("uses a new key on every write", async () => {
    const { storage, secure } = fakes();
    await storage.setItem("taptap.session", SESSION);
    const first = secure.get("taptap.session.key");
    await storage.setItem("taptap.session", SESSION);
    expect(secure.get("taptap.session.key")).not.toBe(first);
    expect(await storage.getItem("taptap.session")).toBe(SESSION);
  });

  it("treats a session whose key has gone as signed out, and cleans it up", async () => {
    const { storage, secure, plain } = fakes();
    await storage.setItem("taptap.session", SESSION);
    secure.clear();
    expect(await storage.getItem("taptap.session")).toBeNull();
    expect(plain.has("taptap.session")).toBe(false);
  });

  it("returns null when nothing is stored", async () => {
    const { storage } = fakes();
    expect(await storage.getItem("taptap.session")).toBeNull();
  });

  it("removes both halves on sign-out", async () => {
    const { storage, secure, plain } = fakes();
    await storage.setItem("taptap.session", SESSION);
    await storage.removeItem("taptap.session");
    expect(secure.size).toBe(0);
    expect(plain.size).toBe(0);
  });

  it("makes any storage key safe for SecureStore", async () => {
    const { storage, secure } = fakes();
    await storage.setItem("sb-abc-auth-token:user", "x");
    expect([...secure.keys()]).toEqual(["sb-abc-auth-token_user.key"]);
  });
});
