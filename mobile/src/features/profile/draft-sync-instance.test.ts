import { NetworkError, NotSignedInError } from "@/api/app-api";
import { saveOverApi } from "./draft-sync-instance";

const mockCallAppApi = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock("@/api/app-api", () => {
  const actual = jest.requireActual("@/api/app-api");
  return { ...actual, callAppApi: (...a: unknown[]) => mockCallAppApi(...a) };
});
jest.mock("@/api/supabase", () => ({ supabase: {} }));
jest.mock("@/api/query", () => ({ queryClient: { setQueriesData: jest.fn(), invalidateQueries: jest.fn() } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureMessage: (...a: unknown[]) => mockCaptureMessage(...a) } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/config/env", () => ({ env: { siteUrl: "https://taptap.example" } }));

beforeEach(() => {
  mockCallAppApi.mockReset();
  mockCaptureMessage.mockReset();
});

describe("saveOverApi", () => {
  it.each([
    [{ status: 200, body: { updatedAt: "v2" } }, { kind: "saved", updatedAt: "v2" }],
    [{ status: 409, body: { code: "conflict", updatedAt: "v9" } }, { kind: "conflict", updatedAt: "v9" }],
    [{ status: 404, body: { code: "not_found" } }, { kind: "gone" }],
    [{ status: 422, body: { code: "invalid_destination", index: 2 } }, { kind: "invalid", code: "invalid_destination", index: 2 }],
    [{ status: 422, body: { code: "invalid_redirect" } }, { kind: "invalid", code: "invalid_redirect", index: undefined }],
    [{ status: 401, body: {} }, { kind: "retry" }],
    [{ status: 500, body: { code: "error" } }, { kind: "retry" }],
    [{ status: 503, body: { code: "unavailable" } }, { kind: "retry" }],
    // A 200 without a version is not a save we can build on.
    [{ status: 200, body: {} }, { kind: "retry" }],
    // The website without this route (deployed before it, or a proxy page):
    // keep the edits and try again, never treat them as for a deleted profile.
    [{ status: 404, body: {} }, { kind: "retry" }],
    [{ status: 400, body: {} }, { kind: "retry" }],
  ])("maps %j", async (answer, outcome) => {
    mockCallAppApi.mockResolvedValue(answer);
    await expect(saveOverApi("p1", {})).resolves.toEqual(outcome);
    expect(mockCallAppApi).toHaveBeenCalledWith("PUT", "/api/app/v1/pages/p1/draft", {});
  });

  it("reports a malformed draft (a bug in this app) by field name only", async () => {
    mockCallAppApi.mockResolvedValue({ status: 400, body: { code: "invalid_body", field: "blocks[3].id" } });
    await expect(saveOverApi("p1", { secret: "customer text" })).resolves.toMatchObject({ kind: "invalid" });
    expect(mockCaptureMessage).toHaveBeenCalledWith(expect.any(String), { extra: { field: "blocks[3].id" } });
    expect(JSON.stringify(mockCaptureMessage.mock.calls)).not.toContain("customer text");
  });

  it("retries when there was no answer or no session yet", async () => {
    mockCallAppApi.mockRejectedValueOnce(new NetworkError("offline"));
    await expect(saveOverApi("p1", {})).resolves.toEqual({ kind: "retry" });
    mockCallAppApi.mockRejectedValueOnce(new NotSignedInError());
    await expect(saveOverApi("p1", {})).resolves.toEqual({ kind: "retry" });
  });
});
