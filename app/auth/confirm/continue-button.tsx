"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Busy while the token is being used, so a second press cannot submit an
 * already-spent token and land on "link expired".
 */
export function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full loading={pending} loadingText="Signing you in">
      Continue
    </Button>
  );
}
