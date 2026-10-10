import { useOnline } from "@/features/network/use-online";
import { Notice } from "./notice";

/** Shown only while the phone is offline; says what the screen is showing instead. */
export function OfflineBanner({ message }: { message: string }) {
  const online = useOnline();
  return online ? null : <Notice tone="offline" message={message} />;
}
