import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/api/supabase";

/**
 * The profile photo: picked, cropped square, shrunk on the phone, uploaded to
 * the same storage path the web uses (PLAN.md §8 Editor, §4.10).
 *
 * Under 300 KB, always. A customer opens the profile on a phone, often on
 * mobile data; a 4 MB camera photo would be most of the page's weight.
 */
export const PHOTO_MAX_BYTES = 300 * 1024;
/** Shown at 80 pt on the profile: 512 px is sharp at 3× and small on disk. */
export const PHOTO_PX = 512;
/** JPEG qualities tried in turn until one fits. */
export const QUALITIES = [0.8, 0.65, 0.5, 0.35] as const;

export class PhotoTooLargeError extends Error {
  constructor() {
    super("Photo could not be made small enough");
    this.name = "PhotoTooLargeError";
  }
}

/** Opens the photo library with a square crop. Null when the person cancels. */
export async function pickPhoto(): Promise<string | null> {
  // Android's system photo picker needs no permission; nothing is asked for.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/** Bytes a base64 string decodes to. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Tries each quality until the result fits. `encode` turns a quality into
 * base64 JPEG; separated from the native module so the rule is testable.
 */
export async function encodeWithin(
  encode: (quality: number) => Promise<string>,
  maxBytes = PHOTO_MAX_BYTES,
): Promise<string> {
  for (const quality of QUALITIES) {
    const base64 = await encode(quality);
    if (base64Bytes(base64) <= maxBytes) return base64;
  }
  throw new PhotoTooLargeError();
}

/** Resizes to PHOTO_PX wide and encodes as JPEG under the limit. */
export async function compressPhoto(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_PX }).renderAsync();
  try {
    return await encodeWithin(async (quality) => {
      const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
      if (!saved.base64) throw new Error("No image data");
      return saved.base64;
    });
  } finally {
    image.release();
  }
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/** Base64 to bytes, without depending on the runtime's atob. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = LOOKUP[clean.charCodeAt(i + 2)];
    const d = LOOKUP[clean.charCodeAt(i + 3)];
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/**
 * Uploads to `page-assets/<account>/<profile>/avatar-<time>.jpg` — the web's
 * path, where RLS lets an account write only inside its own folder (0002) —
 * and returns the public address the profile will show.
 */
export async function uploadPhoto(accountId: string, pageId: string, base64: string): Promise<string> {
  const path = `${accountId}/${pageId}/avatar-${Date.now()}.jpg`;
  const bucket = supabase.storage.from("page-assets");
  const bytes = base64ToBytes(base64);
  // An ArrayBuffer of exactly the image: the body type Supabase documents for
  // React Native uploads.
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { error } = await bucket.upload(path, body, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
