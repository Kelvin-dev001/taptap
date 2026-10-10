/**
 * Who is signed in on this phone — as a pure function of what has happened,
 * so every path is tested without Supabase (session-state.test.ts).
 *
 * The rule that matters: **a stored session means signed in**, even when it
 * cannot be refreshed right now. supabase-js reports "no session" once the
 * one-hour access token has expired and the refresh fails for lack of a
 * network — but it keeps the refresh token, and refreshes as soon as it can.
 * Trusting that report would throw an offline owner back to sign-in, where
 * they cannot sign in either. Only a session the server has refused (supabase-js
 * deletes it and says SIGNED_OUT) or a sign-out ends it.
 */

export type SessionUser = { id: string; email: string | null };

export type SignedOutReason =
  /** The server ended the session (revoked, expired, password changed elsewhere). */
  "expired" | null;

export type SessionState =
  | { status: "restoring" }
  | { status: "signedOut"; reason: SignedOutReason }
  | {
      status: "signedIn";
      user: SessionUser;
      /**
       * Signed in by a password-reset code but no new password yet. The person
       * stays on the reset screen until they choose one (or leave it).
       */
      recovering: boolean;
    };

export type SessionEvent =
  /**
   * Startup. `session` is what supabase-js reports; `stored` is what is on the
   * phone after it has tried; `hadStored` is what was there before it started.
   */
  | {
      type: "restored";
      session: SessionUser | null;
      stored: SessionUser | null;
      hadStored: boolean;
    }
  | { type: "signedIn"; user: SessionUser }
  | { type: "recovery"; user: SessionUser }
  | { type: "recoveryDone" }
  | { type: "signedOut"; byUser: boolean };

export const initialSessionState: SessionState = { status: "restoring" };

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "restored": {
      // A sign-in or sign-out may have happened while the stored session was
      // being read; that newer state wins.
      if (state.status !== "restoring") return state;
      const user = event.session ?? event.stored;
      if (user) return { status: "signedIn", user, recovering: false };
      return { status: "signedOut", reason: event.hadStored ? "expired" : null };
    }
    case "signedIn":
      return {
        status: "signedIn",
        user: event.user,
        // A token refresh or profile update mid-reset must not end the reset.
        recovering: state.status === "signedIn" ? state.recovering : false,
      };
    case "recovery":
      return { status: "signedIn", user: event.user, recovering: true };
    case "recoveryDone":
      return state.status === "signedIn" ? { ...state, recovering: false } : state;
    case "signedOut":
      // Nobody was signed in, so nobody was signed out: no message.
      if (state.status === "signedOut") return state;
      // supabase-js refusing the stored session while starting up: "restored"
      // follows and decides, knowing whether a session was there before.
      if (state.status === "restoring") return state;
      return { status: "signedOut", reason: event.byUser ? null : "expired" };
  }
}

/** Whether the signed-in part of the app is open. */
export function canEnterApp(state: SessionState): boolean {
  return state.status === "signedIn" && !state.recovering;
}

/**
 * The user stored in a serialised supabase-js session, or null. Read when the
 * app starts offline with an expired token, which supabase-js will not hand back.
 */
export function userFromStoredSession(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { refresh_token, user } = parsed as { refresh_token?: unknown; user?: unknown };
    if (typeof refresh_token !== "string" || !refresh_token) return null;
    if (typeof user !== "object" || user === null) return null;
    const { id, email } = user as { id?: unknown; email?: unknown };
    if (typeof id !== "string" || !id) return null;
    return { id, email: typeof email === "string" ? email : null };
  } catch {
    return null;
  }
}
