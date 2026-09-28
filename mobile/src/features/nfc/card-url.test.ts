import {
  decodeUtf8,
  readCardRecords,
  tokenFromCardUrl,
  uriFromRecord,
  type NdefRecordLike,
} from "./card-url";

const TOKEN = "0123456789abcdef0123456789abcdef";

const bytes = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/** A URI record exactly as an encoder writes it: prefix code, then the rest. */
function uriRecord(
  prefixCode: number,
  rest: string,
  type: number[] | string = [0x55],
): NdefRecordLike {
  return { tnf: 0x01, type, payload: [prefixCode, ...bytes(rest)] };
}

const cardRecord = uriRecord(0x04, `taptap.hornbilltech.co.ke/t/${TOKEN}`);

describe("uriFromRecord", () => {
  it("expands the https:// prefix code the encoder uses", () => {
    expect(uriFromRecord(cardRecord)).toBe(`https://taptap.hornbilltech.co.ke/t/${TOKEN}`);
  });

  it("accepts the record type as a string too", () => {
    expect(uriFromRecord(uriRecord(0x04, "example.com", "U"))).toBe("https://example.com");
  });

  it("ignores records that are not URIs", () => {
    const text: NdefRecordLike = { tnf: 0x01, type: [0x54], payload: [0x02, ...bytes("enhello")] };
    expect(uriFromRecord(text)).toBeNull();
    expect(uriFromRecord({ tnf: 0x04, type: "U", payload: [0x04] })).toBeNull();
  });

  it("treats reserved prefix codes as no prefix", () => {
    expect(uriFromRecord(uriRecord(0x7f, "https://x.test"))).toBe("https://x.test");
  });
});

describe("tokenFromCardUrl", () => {
  it.each([
    [`https://taptap.hornbilltech.co.ke/t/${TOKEN}`, TOKEN],
    [`https://taptap.hornbilltech.co.ke/t/${TOKEN}?src=qr`, TOKEN],
    [`https://taptap.hornbilltech.co.ke/t/${TOKEN}/`, TOKEN],
    [`HTTPS://TAPTAP.HORNBILLTECH.CO.KE/t/${TOKEN}`, TOKEN],
    [`  https://taptap.hornbilltech.co.ke/t/${TOKEN}  `, TOKEN],
  ])("reads %s", (url, token) => {
    expect(tokenFromCardUrl(url)).toBe(token);
  });

  it.each([
    [`http://taptap.hornbilltech.co.ke/t/${TOKEN}`, "not HTTPS"],
    [`https://evil.example/t/${TOKEN}`, "another host"],
    [`https://taptap.hornbilltech.co.ke.evil.example/t/${TOKEN}`, "a look-alike host"],
    ["https://taptap.hornbilltech.co.ke/kelvin?src=nfc", "a profile slug, not a card"],
    [`https://taptap.hornbilltech.co.ke/t/${TOKEN.toUpperCase()}`, "an upper-case token"],
    ["https://taptap.hornbilltech.co.ke/t/abc123", "a short token"],
    [`https://taptap.hornbilltech.co.ke/t/${TOKEN}/extra`, "a longer path"],
  ])("refuses %s (%s)", (url) => {
    expect(tokenFromCardUrl(url)).toBeNull();
  });
});

describe("readCardRecords", () => {
  it("finds the card", () => {
    expect(readCardRecords([cardRecord])).toEqual({
      kind: "card",
      token: TOKEN,
      url: `https://taptap.hornbilltech.co.ke/t/${TOKEN}`,
    });
  });

  it("finds the card behind another link", () => {
    const records = [uriRecord(0x04, "example.com"), cardRecord];
    expect(readCardRecords(records).kind).toBe("card");
  });

  it("reports someone else's tag", () => {
    expect(readCardRecords([uriRecord(0x03, "example.com/menu")])).toEqual({
      kind: "other",
      url: "http://example.com/menu",
    });
  });

  it("reports an empty or unreadable tag", () => {
    expect(readCardRecords([])).toEqual({ kind: "empty" });
    expect(readCardRecords(null)).toEqual({ kind: "empty" });
  });
});

describe("decodeUtf8", () => {
  it("decodes multi-byte characters", () => {
    // "ñ" is C3 B1; "€" is E2 82 AC; "😀" is F0 9F 98 80.
    expect(decodeUtf8([0x61, 0xc3, 0xb1, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80])).toBe("añ€😀");
  });

  it("replaces broken sequences instead of throwing", () => {
    expect(decodeUtf8([0x61, 0xc3])).toBe("a�");
    expect(decodeUtf8([0xff, 0x62])).toBe("�b");
  });
});
