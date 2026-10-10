/**
 * Every icon the app uses, one file each (the web's icon set, lucide).
 *
 * Metro does not tree-shake: `import { House } from "lucide-react-native"`
 * bundles all ~1,600 icons. Measured on 9 Oct 2026, that alone took the
 * Android bundle from 4.4 MB to 7.9 MB, past the 7 MB budget (PLAN.md §4.10).
 * Lint refuses the package root everywhere but here; add new icons below.
 */
export { default as ChartColumn } from "lucide-react-native/icons/chart-column";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as CircleAlert } from "lucide-react-native/icons/circle-alert";
export { default as CircleCheck } from "lucide-react-native/icons/circle-check";
export { default as CircleUser } from "lucide-react-native/icons/circle-user";
export { default as CreditCard } from "lucide-react-native/icons/credit-card";
export { default as Eye } from "lucide-react-native/icons/eye";
export { default as EyeOff } from "lucide-react-native/icons/eye-off";
export { default as House } from "lucide-react-native/icons/house";
export { default as Inbox } from "lucide-react-native/icons/inbox";
export { default as Info } from "lucide-react-native/icons/info";
export { default as Share2 } from "lucide-react-native/icons/share-2";
export { default as Smartphone } from "lucide-react-native/icons/smartphone";
export { default as WifiOff } from "lucide-react-native/icons/wifi-off";
export { default as Wrench } from "lucide-react-native/icons/wrench";

// Types cost nothing at run time.
export type { LucideIcon } from "lucide-react-native";
