import type { Config } from "tailwindcss";

/**
 * Hornbill TapTap design system — Sprint UI-1.
 *
 * Tokens are declared as CSS custom properties in app/globals.css and merely
 * surfaced here as Tailwind classes, so there is exactly one source of truth
 * per value. Light-mode only this phase (CLAUDE.md §30.17) — `darkMode` is
 * deliberately left unset.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
          950: "var(--color-primary-950)",
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          /** Use behind white labels and for orange text — AA safe. */
          strong: "var(--color-primary-strong)",
          "strong-hover": "var(--color-primary-strong-hover)",
          soft: "var(--color-primary-soft)",
          subtle: "var(--color-primary-subtle)",
        },
        background: "var(--color-background)",
        surface: {
          DEFAULT: "var(--color-surface)",
          elevated: "var(--color-surface-elevated)",
          sunken: "var(--color-surface-sunken)",
          inverse: "var(--color-surface-inverse)",
          "inverse-elevated": "var(--color-surface-inverse-elevated)",
        },
        foreground: {
          DEFAULT: "var(--color-foreground)",
          secondary: "var(--color-foreground-secondary)",
        },
        muted: "var(--color-muted)",
        "on-inverse": {
          DEFAULT: "var(--color-on-inverse)",
          muted: "var(--color-on-inverse-muted)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          soft: "var(--color-success-soft)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          soft: "var(--color-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          soft: "var(--color-danger-soft)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          soft: "var(--color-info-soft)",
        },
      },

      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      /* Type scale — paired line-heights and tracking so a role is one class. */
      fontSize: {
        display: ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        "page-title": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        "section-title": ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        "card-title": ["0.9375rem", { lineHeight: "1.375rem", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        "body-sm": ["0.875rem", { lineHeight: "1.375rem" }],
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.06em", fontWeight: "500" }],
        caption: ["0.75rem", { lineHeight: "1.125rem" }],
        metric: ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        "metric-lg": ["2.5rem", { lineHeight: "2.75rem", letterSpacing: "-0.025em", fontWeight: "700" }],
      },

      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },

      /* Layered and restrained — never a single heavy drop shadow (§8). */
      boxShadow: {
        xs: "0 1px 2px 0 rgb(15 15 15 / 0.04)",
        sm: "0 1px 2px 0 rgb(15 15 15 / 0.04), 0 1px 3px 0 rgb(15 15 15 / 0.06)",
        md: "0 2px 4px -1px rgb(15 15 15 / 0.05), 0 4px 12px -2px rgb(15 15 15 / 0.08)",
        lg: "0 8px 24px -6px rgb(15 15 15 / 0.10), 0 2px 6px -2px rgb(15 15 15 / 0.06)",
        /* Charcoal cards get an inner warm glow rather than a bigger shadow. */
        glow: "inset 0 0 60px -20px rgb(249 115 22 / 0.35)",
        focus: "0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-primary)",
      },

      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "240ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        decelerate: "cubic-bezier(0, 0, 0, 1)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.96)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-out-bottom": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        /* Marketing marquee. The track is rendered twice and this moves it by
           exactly half its width, so the second copy lands where the first
           began and the loop has no seam. */
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-base) var(--ease-standard)",
        "fade-out": "fade-out var(--duration-fast) var(--ease-standard)",
        "scale-in": "scale-in var(--duration-slow) var(--ease-standard)",
        "scale-out": "scale-out var(--duration-fast) var(--ease-standard)",
        "slide-in-right": "slide-in-right var(--duration-base) var(--ease-standard)",
        "slide-in-bottom": "slide-in-bottom var(--duration-slow) var(--ease-standard)",
        "slide-out-bottom": "slide-out-bottom var(--duration-base) var(--ease-standard)",
        "rise-in": "rise-in var(--duration-base) var(--ease-decelerate) both",
        shimmer: "shimmer 1.6s infinite",
        spin: "spin 0.7s linear infinite",
        // Slow enough to read a word as it passes, rather than a blur.
        marquee: "marquee 46s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
