import {
  canEnterApp,
  initialSessionState,
  sessionReducer,
  userFromStoredSession,
  type SessionEvent,
  type SessionState,
} from "./session-state";

const owner = { id: "u-1", email: "owner@business.co.ke" };
const run = (events: SessionEvent[], from: SessionState = initialSessionState) =>
  events.reduce(sessionReducer, from);

describe("starting the app", () => {
  it("opens the app with a valid session", () => {
    const state = run([{ type: "restored", session: owner, stored: owner, hadStored: true }]);
    expect(state).toEqual({ status: "signedIn", user: owner, recovering: false });
    expect(canEnterApp(state)).toBe(true);
  });

  /** M1 acceptance: launching in airplane mode after the access token has
   *  expired still shows the app from cache. */
  it("stays signed in offline when supabase-js cannot refresh yet", () => {
    const state = run([{ type: "restored", session: null, stored: owner, hadStored: true }]);
    expect(canEnterApp(state)).toBe(true);
  });

  /** M1 acceptance: an expired session returns to sign-in with a message. */
  it("explains when the server refused the stored session", () => {
    const state = run([
      { type: "signedOut", byUser: false },
      { type: "restored", session: null, stored: null, hadStored: true },
    ]);
    expect(state).toEqual({ status: "signedOut", reason: "expired" });
  });

  it("says nothing on a first launch", () => {
    const state = run([{ type: "restored", session: null, stored: null, hadStored: false }]);
    expect(state).toEqual({ status: "signedOut", reason: null });
  });

  it("lets a sign-in that lands first win over a late restore", () => {
    const state = run([
      { type: "signedIn", user: owner },
      { type: "restored", session: null, stored: null, hadStored: false },
    ]);
    expect(canEnterApp(state)).toBe(true);
  });
});

describe("while signed in", () => {
  const signedIn = run([{ type: "restored", session: owner, stored: owner, hadStored: true }]);

  it("treats a sign-out the person asked for as nothing to explain", () => {
    expect(sessionReducer(signedIn, { type: "signedOut", byUser: true })).toEqual({
      status: "signedOut",
      reason: null,
    });
  });

  it("explains a sign-out the server caused", () => {
    expect(sessionReducer(signedIn, { type: "signedOut", byUser: false })).toEqual({
      status: "signedOut",
      reason: "expired",
    });
  });

  it("keeps the person in the app across token refreshes", () => {
    expect(canEnterApp(sessionReducer(signedIn, { type: "signedIn", user: owner }))).toBe(true);
  });
});

describe("resetting a password", () => {
  const signedOut: SessionState = { status: "signedOut", reason: null };

  it("keeps the person on the reset screen after the code signs them in", () => {
    const state = sessionReducer(signedOut, { type: "recovery", user: owner });
    expect(state.status).toBe("signedIn");
    expect(canEnterApp(state)).toBe(false);
  });

  it("does not end the reset on a token refresh", () => {
    const state = run(
      [
        { type: "recovery", user: owner },
        { type: "signedIn", user: owner },
      ],
      signedOut,
    );
    expect(canEnterApp(state)).toBe(false);
  });

  it("opens the app once the new password is set", () => {
    const state = run([{ type: "recovery", user: owner }, { type: "recoveryDone" }], signedOut);
    expect(canEnterApp(state)).toBe(true);
  });

  it("ignores a stray recoveryDone when nobody is signed in", () => {
    expect(sessionReducer(signedOut, { type: "recoveryDone" })).toBe(signedOut);
  });
});

describe("userFromStoredSession", () => {
  it("reads the user from a serialised session", () => {
    const raw = JSON.stringify({ access_token: "a", refresh_token: "r", user: owner });
    expect(userFromStoredSession(raw)).toEqual(owner);
  });

  it("refuses anything without a refresh token or a user id", () => {
    expect(userFromStoredSession(null)).toBeNull();
    expect(userFromStoredSession("not json")).toBeNull();
    expect(userFromStoredSession(JSON.stringify({ user: owner }))).toBeNull();
    expect(userFromStoredSession(JSON.stringify({ refresh_token: "r", user: {} }))).toBeNull();
    expect(userFromStoredSession(JSON.stringify("text"))).toBeNull();
  });

  it("copes with a user without an email", () => {
    const raw = JSON.stringify({ refresh_token: "r", user: { id: "u-2" } });
    expect(userFromStoredSession(raw)).toEqual({ id: "u-2", email: null });
  });
});
