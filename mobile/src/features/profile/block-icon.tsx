import type { ColorValue } from "react-native";
import {
  Briefcase,
  CalendarCheck,
  Camera,
  Contact,
  Globe,
  Hash,
  Link,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Smartphone,
  SquarePlay,
  Star,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "@/ui/icons";

/**
 * The web's icon for each action type (components/profile/block-icon.tsx), so
 * a profile looks the same in the app and on the web. lucide v1 has no brand
 * marks, so social actions use the same generic stand-ins the web does.
 */
const ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  google_review: Star,
  mpesa: Smartphone,
  directions: MapPin,
  contact: Contact,
  call: Phone,
  email: Mail,
  website: Globe,
  instagram: Camera,
  facebook: Users,
  tiktok: Music2,
  youtube: SquarePlay,
  linkedin: Briefcase,
  x: Hash,
  menu: UtensilsCrossed,
  booking: CalendarCheck,
  custom: Link,
};

/** The icon component for an action type; a link for types this app does not know. */
export function blockIcon(type: string): LucideIcon {
  return ICONS[type] ?? Link;
}

export function BlockIcon({ type, size = 18, color }: { type: string; size?: number; color: ColorValue }) {
  // A lookup in a module-level table, not a component made here: the same
  // type always renders the same component.
  const Icon = ICONS[type] ?? Link;
  return <Icon size={size} color={color} />;
}
