import { designStyle, DEVICES, SHADOWS } from "@/lib/page-builder/design-style";
import { HEX_COLOR } from "@/lib/page-builder/value-types";

import type { ElementStyle } from "./layout";

/**
 * An element's own Style as inline properties and `data-*` switches: colours, the
 * box (padding per device, corners, line, shadow) and — through the design value's
 * own rules — its typography and the buttons' look. Empty: nothing, the zone's look.
 */
export function elementLook(look: ElementStyle | undefined): { style: Record<string, string>; attrs: Record<string, string> } {
  if (!look) return { style: {}, attrs: {} };
  const { style, attrs } = designStyle(look.design);
  const colour = (value: string | undefined) => (value && HEX_COLOR.test(value) ? value : undefined);

  const text = colour(look.color);
  if (text) {
    style.color = text;
    style["--sb-foreground"] = text;
  }
  const background = colour(look.background);
  if (background) {
    style.backgroundColor = background;
    style["--sb-background"] = background;
  }
  const hover = colour(look.hoverColor);
  if (hover) {
    style["--sb-el-hover"] = hover;
    attrs["data-el-hover"] = "";
  }
  for (const [name, value] of [["px", look.padX], ["py", look.padY]] as const) {
    const set = DEVICES.filter((device) => value?.[device] !== undefined);
    for (const device of set) style[device === "d" ? `--sb-el-${name}` : `--sb-el-${name}-${device}`] = `${value![device]}px`;
    if (set.length) attrs[`data-el-${name}`] = set.join(" ");
  }
  if (look.radius) style.borderRadius = `${look.radius}px`;
  if (look.borderWidth) style.border = `${look.borderWidth}px solid ${colour(look.borderColor) ?? "currentColor"}`;
  if (look.shadow && look.shadow !== "none") style.boxShadow = SHADOWS[look.shadow].css;
  return { style, attrs };
}
