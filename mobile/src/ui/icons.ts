/**
 * Every icon the app uses, one file each (the web's icon set, lucide).
 *
 * Metro does not tree-shake: `import { House } from "lucide-react-native"`
 * bundles all ~1,600 icons. Measured on 9 Oct 2026, that alone took the
 * Android bundle from 4.4 MB to 7.9 MB, past the 7 MB budget (PLAN.md §4.10).
 * Lint refuses the package root everywhere but here; add new icons below.
 */
export { default as ArrowDown } from "lucide-react-native/icons/arrow-down";
export { default as ArrowUp } from "lucide-react-native/icons/arrow-up";
export { default as Briefcase } from "lucide-react-native/icons/briefcase";
export { default as CalendarCheck } from "lucide-react-native/icons/calendar-check";
export { default as Camera } from "lucide-react-native/icons/camera";
export { default as ChartColumn } from "lucide-react-native/icons/chart-column";
export { default as Check } from "lucide-react-native/icons/check";
export { default as ChevronDown } from "lucide-react-native/icons/chevron-down";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as CircleAlert } from "lucide-react-native/icons/circle-alert";
export { default as CircleCheck } from "lucide-react-native/icons/circle-check";
export { default as CircleUser } from "lucide-react-native/icons/circle-user";
export { default as CloudOff } from "lucide-react-native/icons/cloud-off";
export { default as Contact } from "lucide-react-native/icons/contact";
export { default as Copy } from "lucide-react-native/icons/copy";
export { default as CreditCard } from "lucide-react-native/icons/credit-card";
export { default as Eye } from "lucide-react-native/icons/eye";
export { default as EyeOff } from "lucide-react-native/icons/eye-off";
export { default as Globe } from "lucide-react-native/icons/globe";
export { default as Hash } from "lucide-react-native/icons/hash";
export { default as House } from "lucide-react-native/icons/house";
export { default as ImagePlus } from "lucide-react-native/icons/image-plus";
export { default as Inbox } from "lucide-react-native/icons/inbox";
export { default as Info } from "lucide-react-native/icons/info";
export { default as Link } from "lucide-react-native/icons/link";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as MapPin } from "lucide-react-native/icons/map-pin";
export { default as MessageCircle } from "lucide-react-native/icons/message-circle";
export { default as Music2 } from "lucide-react-native/icons/music-2";
export { default as Palette } from "lucide-react-native/icons/palette";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as Phone } from "lucide-react-native/icons/phone";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as QrCode } from "lucide-react-native/icons/qr-code";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as Share2 } from "lucide-react-native/icons/share-2";
export { default as Smartphone } from "lucide-react-native/icons/smartphone";
export { default as SquarePlay } from "lucide-react-native/icons/square-play";
export { default as Star } from "lucide-react-native/icons/star";
export { default as Trash } from "lucide-react-native/icons/trash";
export { default as TriangleAlert } from "lucide-react-native/icons/triangle-alert";
export { default as Users } from "lucide-react-native/icons/users";
export { default as UtensilsCrossed } from "lucide-react-native/icons/utensils-crossed";
export { default as WifiOff } from "lucide-react-native/icons/wifi-off";
export { default as Wrench } from "lucide-react-native/icons/wrench";
export { default as X } from "lucide-react-native/icons/x";

// Types cost nothing at run time.
export type { LucideIcon } from "lucide-react-native";
