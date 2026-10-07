/**
 * The icons a section may show — a fixed set, stored by name. The storefront
 * draws them from `components/sections/section-icon.tsx`; a Liquid theme would
 * keep the same names as snippets. An unknown name is refused on write and drawn
 * as nothing on read.
 */
export const SECTION_ICONS = [
  { value: "none", label: "No icon" },
  { value: "leaf", label: "Leaf" },
  { value: "sparkles", label: "Sparkles" },
  { value: "gem", label: "Gem" },
  { value: "award", label: "Award" },
  { value: "star", label: "Star" },
  { value: "heart", label: "Heart" },
  { value: "hammer", label: "Craft" },
  { value: "ruler", label: "Measure" },
  { value: "palette", label: "Palette" },
  { value: "sofa", label: "Sofa" },
  { value: "lamp", label: "Lamp" },
  { value: "truck", label: "Delivery" },
  { value: "package", label: "Package" },
  { value: "shield", label: "Guarantee" },
  { value: "recycle", label: "Recycle" },
  { value: "globe", label: "Globe" },
  { value: "map-pin", label: "Location" },
  { value: "clock", label: "Time" },
  { value: "calendar", label: "Calendar" },
  { value: "phone", label: "Phone" },
  { value: "mail", label: "Mail" },
  { value: "message", label: "Message" },
  { value: "check", label: "Check" },
] as const;

export type SectionIconName = (typeof SECTION_ICONS)[number]["value"];
