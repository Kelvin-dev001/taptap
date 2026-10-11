import type { QueryClient } from "@tanstack/react-query";
import { renameCard, type Card } from "./cards";

/**
 * A card's name, changed at once and kept until the server has it (PLAN.md
 * §4.5: "card name queued") — the same paused-mutation queue as lead edits
 * (src/api/lead-edits.ts). Linking and switching a card off need the network
 * and are never queued: a customer could tap the card meanwhile.
 */
export const RENAME_CARD = ["card", "rename"] as const;

export type CardRename = { id: string; label: string };

export function registerCardEdits(client: QueryClient) {
  client.setMutationDefaults(RENAME_CARD, {
    mutationFn: ({ id, label }: CardRename) => renameCard(id, label),
    retry: 3,
    onMutate: ({ id, label }: CardRename) => {
      client.setQueriesData<Card[]>({ queryKey: ["cards"] }, (cards) =>
        cards?.map((c) => (c.id === id ? { ...c, label: label.trim() || null } : c)),
      );
    },
    onError: () => void client.invalidateQueries({ queryKey: ["cards"] }),
  });
}
