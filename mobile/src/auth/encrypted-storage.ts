import aesjs from "aes-js";

/**
 * Where the Supabase session lives on the phone (PLAN.md §4.4, §0 #2).
 *
 * The session (access and refresh tokens, plus the user) is larger than the
 * 2,048 bytes SecureStore accepts, so it is split the way Supabase documents
 * for React Native: an AES-256 key in the iOS Keychain / Android Keystore
 * (SecureStore), and the session encrypted with it in AsyncStorage.
 *
 * Every write uses a fresh random key. CTR mode must never reuse a key with the
 * same counter, and a new key per write makes that impossible without tracking
 * nonces.
 *
 * Uninstalling wipes AsyncStorage, so a reinstall starts signed out even though
 * iOS keeps Keychain items. If the key has gone but the ciphertext is still
 * there (a restored backup, a reset Keystore), the ciphertext is useless: it is
 * deleted and the person signs in again.
 *
 * Dependencies are passed in so the logic is tested without native modules.
 */

export type KeyStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type ValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** The storage shape supabase-js accepts. */
export type SessionStorage = ValueStore;

type Deps = {
  keys: KeyStore;
  values: ValueStore;
  randomBytes: (count: number) => Uint8Array;
};

/** SecureStore keys may only use letters, digits, ".", "-" and "_". */
const keyName = (key: string) => `${key.replace(/[^A-Za-z0-9._-]/g, "_")}.key`;

export function createEncryptedStorage({ keys, values, randomBytes }: Deps): SessionStorage {
  return {
    async getItem(key) {
      const cipherHex = await values.getItem(key);
      if (cipherHex === null) return null;
      const keyHex = await keys.getItemAsync(keyName(key));
      if (keyHex === null) {
        await values.removeItem(key);
        return null;
      }
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(keyHex),
        new aesjs.Counter(1),
      );
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(cipherHex)));
    },

    async setItem(key, value) {
      const secret = randomBytes(32);
      const cipher = new aesjs.ModeOfOperation.ctr(secret, new aesjs.Counter(1));
      const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
      // Key first: if the app dies between the two writes, an unreadable old
      // ciphertext is cleaned up on the next read rather than decrypted wrongly.
      await keys.setItemAsync(keyName(key), aesjs.utils.hex.fromBytes(secret));
      await values.setItem(key, aesjs.utils.hex.fromBytes(encrypted));
    },

    async removeItem(key) {
      await values.removeItem(key);
      await keys.deleteItemAsync(keyName(key));
    },
  };
}
