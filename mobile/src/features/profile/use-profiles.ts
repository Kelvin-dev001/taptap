import { useCards } from "@/api/cards";
import { usePages, type Profile } from "@/api/pages";
import { useSignedInUser } from "@/auth/session";
import type { IdentityRow } from "@taptap/core/identity";
import { usePendingDraft } from "./draft-sync-instance";
import { draftFromProfile, profileStatus, type EditorDraft, type ProfileStatus } from "./model";

const NO_CARDS: IdentityRow[] = [];

/** The account's profiles and cards, from cache first. */
export function useProfiles() {
  const user = useSignedInUser();
  const userId = user?.id ?? null;
  const pages = usePages(userId);
  const cards = useCards(userId);
  return { userId, pages, cards, identities: cards.data ?? NO_CARDS };
}

export type ProfileState = {
  profile: Profile;
  all: Profile[];
  identities: IdentityRow[];
  /** The draft as the owner sees it: unsaved edits on this phone first. */
  draft: EditorDraft;
  status: ProfileStatus;
};

/**
 * One profile with everything a screen needs to describe it. Status counts
 * edits not yet saved: typing offline makes a live profile "Unpublished
 * changes" straight away, as it is.
 */
export function useProfileState(profile: Profile | null, all: Profile[], identities: IdentityRow[]): ProfileState | null {
  const pending = usePendingDraft(profile?.id);
  if (!profile) return null;
  const draft = pending?.draft ?? draftFromProfile(profile);
  return { profile, all, identities, draft, status: profileStatus(profile, all, identities, draft) };
}
