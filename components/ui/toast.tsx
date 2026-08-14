"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CircleCheck, TriangleAlert, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  info: { cls: "text-info", Icon: Info },
  success: { cls: "text-success", Icon: CircleCheck },
  warning: { cls: "text-warning", Icon: TriangleAlert },
  danger: { cls: "text-danger", Icon: CircleAlert },
};

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
  duration: number;
};

type ToastInput = {
  title: string;
  description?: string;
  tone?: Tone;
  /** Errors default to a longer read time; pass explicitly to override. */
  duration?: number;
};

const ToastContext = React.createContext<((t: ToastInput) => void) | null>(null);

/** Fire a transient message. Throws if used outside the provider. */
export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((input: ToastInput) => {
    const tone = input.tone ?? "info";
    setItems((prev) => [
      ...prev,
      {
        id: nextId++,
        title: input.title,
        description: input.description,
        tone,
        duration: input.duration ?? (tone === "danger" ? 8000 : 5000),
      },
    ]);
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {/* Radix owns the aria-live region, swipe-to-dismiss and the F8 hotkey
          that moves focus into the toast list. */}
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((t) => {
          const { cls, Icon } = TONES[t.tone];
          return (
            <ToastPrimitive.Root
              key={t.id}
              duration={t.duration}
              onOpenChange={(open) => !open && dismiss(t.id)}
              // Failures interrupt; everything else waits its turn.
              type={t.tone === "danger" ? "foreground" : "background"}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-lg",
                "data-[state=open]:animate-slide-in-right data-[state=closed]:animate-fade-out",
                "data-[swipe=end]:animate-fade-out",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cls)} aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <ToastPrimitive.Title className="text-body-sm font-semibold text-foreground">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="text-caption text-muted">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close asChild>
                <IconButton label="Dismiss" size="sm">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          className={cn(
            "fixed bottom-0 right-0 z-[60] m-0 flex w-full max-w-[min(24rem,100vw-2rem)] list-none flex-col gap-2 p-4",
            "outline-none",
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
