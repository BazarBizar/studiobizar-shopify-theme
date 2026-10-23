import { z } from "zod";

import {
  ALIGNMENTS,
  FONTS,
  IMAGE_RATIOS,
  SHADOWS,
  TEXT_TRANSFORMS,
  type DesignValue,
  type FontId,
  type ImageRatio,
  type ShadowId,
} from "./design-style";
import { HEX_COLOR, imageRefSchema } from "./value-schemas";

/**
 * The design value's VALIDATION — strict for writes, part by part for reads. The
 * value itself, its parts and `designStyle` are in `design-style.ts` (no zod, so the
 * storefront's client code stays light); everything there is re-exported here.
 */

export * from "./design-style";

const FONT_IDS = FONTS.map((font) => font.id) as [FontId, ...FontId[]];

/* -------------------------------------------------------------------------- *
 * Validation
 * -------------------------------------------------------------------------- */

const hexSchema = z.string().regex(HEX_COLOR, "Use a colour like #302f2d.");
const responsive = <T extends z.ZodType>(inner: T) =>
  z.strictObject({ d: inner.optional(), t: inner.optional(), m: inner.optional() });
const round = (step: number) => (value: number) => Math.round(value / step) * step;

const typeStyleSchema = z.strictObject({
  font: z.enum(FONT_IDS).optional(),
  size: responsive(z.number().int().min(8).max(200)).optional(),
  weight: z.number().int().min(100).max(900).multipleOf(100).optional(),
  lineHeight: responsive(z.number().min(0.7).max(3).transform(round(0.05))).optional(),
  letterSpacing: responsive(z.number().min(-5).max(30).transform(round(0.1))).optional(),
  color: hexSchema.optional(),
  transform: z.enum(TEXT_TRANSFORMS.map((option) => option.value) as ["none", ...string[]]).optional(),
});

const px = (max: number) => z.number().int().min(0).max(max);
const spaceBoxSchema = z.strictObject({ pt: px(400).optional(), pb: px(400).optional(), mt: px(400).optional(), mb: px(400).optional() });

/** What a WRITE must satisfy. Unknown keys are refused, as everywhere in the builder. */
export const designSchema = z.strictObject({
  heading: typeStyleSchema.optional(),
  text: typeStyleSchema.optional(),
  button: typeStyleSchema.optional(),
  buttonLook: z
    .strictObject({
      background: hexSchema.optional(),
      color: hexSchema.optional(),
      borderColor: hexSchema.optional(),
      borderWidth: px(10).optional(),
      radius: px(100).optional(),
      hoverBackground: hexSchema.optional(),
      hoverColor: hexSchema.optional(),
      hoverBorderColor: hexSchema.optional(),
      padX: responsive(px(120)).optional(),
      padY: responsive(px(60)).optional(),
      spaceAbove: responsive(px(200)).optional(),
      gap: responsive(px(120)).optional(),
    })
    .optional(),
  align: responsive(z.enum(ALIGNMENTS)).optional(),
  spacing: z.strictObject({ t: spaceBoxSchema.optional(), m: spaceBoxSchema.optional() }).optional(),
  sides: z
    .strictObject({
      padLeft: responsive(px(400)).optional(),
      padRight: responsive(px(400)).optional(),
      marginLeft: responsive(px(400)).optional(),
      marginRight: responsive(px(400)).optional(),
    })
    .optional(),
  background: z
    .strictObject({
      image: imageRefSchema.nullable().optional(),
      mobileImage: imageRefSchema.nullable().optional(),
      position: z.enum(["center", "top", "bottom"]).optional(),
      overlay: hexSchema.optional(),
      overlayOpacity: z.number().int().min(0).max(90).optional(),
      gradient: z.strictObject({ from: hexSchema, to: hexSchema, angle: z.number().int().min(0).max(360) }).optional(),
    })
    .optional(),
  shadow: z.enum(Object.keys(SHADOWS) as [ShadowId, ...ShadowId[]]).optional(),
  radius: z.strictObject({ t: z.number().int().min(0).max(200).optional(), m: z.number().int().min(0).max(200).optional() }).optional(),
  images: z
    .strictObject({
      ratio: z.enum(Object.keys(IMAGE_RATIOS) as [ImageRatio, ...ImageRatio[]]).optional(),
      radius: z.number().int().min(0).max(120).optional(),
      zoom: z.boolean().optional(),
    })
    .optional(),
  opacity: z.number().int().min(10).max(100).optional(),
  maxWidth: responsive(z.number().int().min(320).max(2400)).optional(),
  minHeight: responsive(z.number().int().min(0).max(1600)).optional(),
  verticalAlign: z.enum(["top", "center", "bottom"]).optional(),
  hide: z.strictObject({ d: z.boolean().optional(), t: z.boolean().optional(), m: z.boolean().optional() }).optional(),
}) as z.ZodType<DesignValue>;

/**
 * What a READ goes through: never fails. Each top-level part is kept or dropped on
 * its own, so one damaged value costs that value, not the section's whole design.
 */
export function readDesign(input: unknown): DesignValue {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const part = designSchema.safeParse({ [key]: value });
    if (part.success) Object.assign(out, part.data);
  }
  return out as DesignValue;
}
