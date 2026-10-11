import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react";
import { clearQueryCache } from "@/api/query";
import { draftSync } from "@/features/profile/draft-sync-instance";
import { forgetSelectedProfile } from "@/features/profile/selection";
import { hadSessionAtLaunch, SESSION_KEY, sessionStorage, supabase } from "@/api/supabase";
import { Sentry } from "@/lib/sentry";
import {
  initialSessionState,
  sessionReducer,
  userFromStoredSession,
  type SessionState,
  type SessionUser,
} from "./session-state";

type SessionContextValue = {
  state: SessionState;
  /** Signs out on this phone only, and works offline. */
  signOut: () => Promise<void>;
  /** The reset screen is done (new password saved, or abandoned). */
  finishRecovery: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const toUser = (user: User): SessionUser => ({ id: user.id, email: user.email ?? null });

/**
 * Keeps the app's idea of who is signed in (session-state.ts) in step with
 * supabase-js, and owns sign-out.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const signingOut = useRef(false);

  useEffect(() => {
    // The phone's own copy decides at launch, straight from storage: no network
    // round trip before the first screen (PLAN.md §4.5), and an expired token
    // offline still opens the app. supabase-js's events refine it from there.
    let active = true;
    void Promise.all([
      sessionStorage.getItem(SESSION_KEY).then(userFromStoredSession, () => null),
      hadSessionAtLaunch,
    ]).then(([stored, hadStored]) => {
      if (active) dispatch({ type: "restored", session: null, stored, hadStored });
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case "INITIAL_SESSION":
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
          // A missing session here only means "not refreshed yet"; the stored
          // copy and SIGNED_OUT decide that.
          if (session) dispatch({ type: "signedIn", user: toUser(session.user) });
          break;
        case "PASSWORD_RECOVERY":
          if (session) dispatch({ type: "recovery", user: toUser(session.user) });
          break;
        case "SIGNED_OUT":
          dispatch({ type: "signedOut", byUser: signingOut.current });
          signingOut.current = false;
          break;
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Crash reports carry the user id, never the email (PLAN.md §4.11).
  const userId = state.status === "signedIn" ? state.user.id : null;
  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null);
  }, [userId]);

  // Whoever signs in next on this phone sees nothing of the last person:
  // cached data and unsent profile edits go, whether they signed out or the
  // server ended the session.
  const signedOut = state.status === "signedOut";
  useEffect(() => {
    if (!signedOut) return;
    void clearQueryCache();
    void draftSync.clear();
    forgetSelectedProfile();
  }, [signedOut]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    // `local`: this phone only. The default would sign the person out of the
    // website and every other phone too.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      // supabase-js keeps the session when it cannot load it first — offline
      // with an expired access token. Signing out must still work there, so
      // the stored session is removed directly; supabase-js reads storage on
      // every call and has no other copy.
      await sessionStorage.removeItem(SESSION_KEY);
      dispatch({ type: "signedOut", byUser: true });
      signingOut.current = false;
    }
  }, []);

  const finishRecovery = useCallback(() => dispatch({ type: "recoveryDone" }), []);

  const value = useMemo(
    () => ({ state, signOut, finishRecovery }),
    [state, signOut, finishRecovery],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** The signed-in person, or null while signing out. */
export function useSignedInUser(): SessionUser | null {
  const { state } = useSession();
  return state.status === "signedIn" ? state.user : null;
}
