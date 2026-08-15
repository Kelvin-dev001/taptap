"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Only the print trigger needs to be interactive; the sheet itself is static. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      Print
    </Button>
  );
}
