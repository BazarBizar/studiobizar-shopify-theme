import {
  AwardIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  GemIcon,
  GlobeIcon,
  HammerIcon,
  HeartIcon,
  LampIcon,
  LeafIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageIcon,
  PaletteIcon,
  PhoneIcon,
  RecycleIcon,
  RulerIcon,
  ShieldCheckIcon,
  SofaIcon,
  SparklesIcon,
  StarIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";

import type { SectionIconName } from "@/lib/page-builder/icons";

/**
 * The fixed icon set a section may show, by the names in `lib/page-builder/icons.ts`.
 * Drawn at the line weight of the rest of the site's icons. Used by the
 * storefront and by the panel's icon picker, so both show the same drawing.
 */
export const ICONS: Record<Exclude<SectionIconName, "none">, LucideIcon> = {
  leaf: LeafIcon,
  sparkles: SparklesIcon,
  gem: GemIcon,
  award: AwardIcon,
  star: StarIcon,
  heart: HeartIcon,
  hammer: HammerIcon,
  ruler: RulerIcon,
  palette: PaletteIcon,
  sofa: SofaIcon,
  lamp: LampIcon,
  truck: TruckIcon,
  package: PackageIcon,
  shield: ShieldCheckIcon,
  recycle: RecycleIcon,
  globe: GlobeIcon,
  "map-pin": MapPinIcon,
  clock: ClockIcon,
  calendar: CalendarIcon,
  phone: PhoneIcon,
  mail: MailIcon,
  message: MessageCircleIcon,
  check: CheckIcon,
};

export function SectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = Object.hasOwn(ICONS, name) ? ICONS[name as keyof typeof ICONS] : null;
  return Icon ? <Icon aria-hidden className={className} strokeWidth={1.25} /> : null;
}
