import {
  MessageCircle,
  Star,
  Phone,
  Mail,
  Globe,
  Camera,
  Users,
  Music2,
  PlaySquare,
  Briefcase,
  Hash,
  MapPin,
  UtensilsCrossed,
  CalendarCheck,
  Smartphone,
  Contact,
  Link as LinkIcon,
} from "lucide-react";
import type { BlockType } from "@/lib/profile";

/**
 * Icons for each action type.
 *
 * lucide-react v1 removed its brand glyphs (Instagram, Facebook, YouTube,
 * LinkedIn, Twitter) over trademark concerns, so social actions use generic but
 * distinguishable stand-ins. If Hornbill later wants true brand marks, they must
 * come from each platform's own brand assets under their usage terms — not from
 * a general icon set.
 */
const ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
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
  youtube: PlaySquare,
  linkedin: Briefcase,
  x: Hash,
  menu: UtensilsCrossed,
  booking: CalendarCheck,
  custom: LinkIcon,
};

export function BlockIcon({
  type,
  className,
}: {
  type: BlockType;
  className?: string;
}) {
  const Icon = ICONS[type] ?? LinkIcon;
  return <Icon className={className} />;
}
