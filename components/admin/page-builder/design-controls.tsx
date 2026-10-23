"use client";

import { ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import {
  ALIGNMENTS,
  contrastRatio,
  DEVICE_LABELS,
  DEVICES,
  FONT_WEIGHTS,
  FONTS,
  fontStack,
  getAt,
  IMAGE_RATIOS,
  inheritedFrom,
  resolveResponsive,
  setAt,
  SHADOWS,
  TEXT_TRANSFORMS,
  type DesignValue,
  type Device,
  type FontId,
  type Responsive,
} from "@/lib/page-builder/design";
import type { DesignPart, ImageRef } from "@/lib/page-builder/fields";
import { cn } from "@/lib/utils/cn";

import { DEVICE_ICONS, DeviceSwitch, useEditorDevice } from "./editor-device";
import { ColorField, ImageField } from "./field-controls";

/**
 * THE DESIGN PANEL — the editor for a `design` value (`lib/page-builder/design.ts`),
 * the same everywhere one is offered: a section's Style tab, a slide, later a header
 * element.
 *
 * Built for someone who has never written CSS:
 *  - every control starts EMPTY, showing the brand's own value as "Default" — so it is
 *    always clear what has been changed, and the page looks as designed until it is;
 *  - each changed control has its own reset (↺), and nothing else is touched by it;
 *  - a control that differs per device carries the device icon; it edits the device
 *    chosen at the top (which is also the preview's width), and says when the value
 *    shown is inherited from a larger screen;
 *  - parts fold away, so the panel is short until a part is opened.
 */

type Props = {
  value: DesignValue;
  onChange: (value: DesignValue) => void;
  parts: readonly DesignPart[];
  /**
   * The Style tab's desktop Custom spacing, for the per-device spacing part — or null
   * when Custom spacing is off (there is nothing to override then).
   */
  spacingBase?: { pt: number; pb: number; mt: number; mb: number } | null;
  /** The Style tab's (desktop) rounded corners, px — what tablet and mobile start from. */
  radiusBase?: number;
  /** Part names shown open at first. */
  open?: readonly DesignPart[];
  /**
   * Who owns "Show on devices" when it is not only the design's own `hide` — a section,
   * whose older "Show on" setting is folded into these same three switches.
   */
  visibility?: {
    hidden: readonly Device[];
    onChange: (hidden: Device[]) => void;
  };
  /** Off for the site style: text alignment belongs to a section, not to the whole site. */
  align?: boolean;
  /**
   * What the section actually draws (reported by the preview). Typography then offers
   * only headings, text or buttons it HAS — a control that does nothing reads as broken.
   * Absent: everything is offered.
   */
  contents?: {
    heading: boolean;
    text: boolean;
    button: boolean;
    container?: boolean;
  } | null;
};

type Path = readonly (string | number)[];

export function DesignControls({
  value,
  onChange,
  parts,
  spacingBase = null,
  radiusBase = 0,
  open = [],
  visibility,
  align = true,
  contents = null,
}: Props) {
  const get = (path: Path) => getAt(value, path);
  const set = (path: Path, next: unknown) => onChange(setAt(value, path, next));
  const has = (part: DesignPart) => parts.includes(part);

  const changed = (keys: (keyof DesignValue)[]) =>
    keys.some((key) => value[key] !== undefined);

  return (
    <div className="space-y-2">
      {has("typography") && (
        <Part
          title="Typography"
          changed={changed(["heading", "text", "button", "align"])}
          defaultOpen={open.includes("typography")}
        >
          <TypographyPart
            get={get}
            set={set}
            align={align}
            contents={contents}
          />
        </Part>
      )}
      {has("buttons") && contents?.button !== false && (
        <Part
          title="Buttons"
          changed={changed(["buttonLook"])}
          defaultOpen={open.includes("buttons")}
        >
          <ButtonsPart get={get} set={set} />
        </Part>
      )}
      {has("background") && (
        <Part
          title="Background image & gradient"
          changed={changed(["background"])}
          defaultOpen={open.includes("background")}
        >
          <BackgroundPart get={get} set={set} />
        </Part>
      )}
      {has("spacing") && (
        <Part
          title="Spacing per device"
          changed={changed(["spacing"])}
          defaultOpen={open.includes("spacing")}
        >
          <SpacingPart get={get} set={set} base={spacingBase} />
        </Part>
      )}
      {has("effects") && (
        <Part
          title="Corners, shadow & transparency"
          changed={changed(["shadow", "opacity", "radius"])}
          defaultOpen={open.includes("effects")}
        >
          <EffectsPart get={get} set={set} radiusBase={radiusBase} />
        </Part>
      )}
      {has("images") && (
        <Part
          title="Images"
          changed={changed(["images"])}
          defaultOpen={open.includes("images")}
        >
          <ImagesPart get={get} set={set} />
        </Part>
      )}
      {has("layout") && (
        <Part
          title="Width & height"
          changed={changed(["maxWidth", "minHeight", "verticalAlign"])}
          defaultOpen={open.includes("layout")}
        >
          <LayoutPart
            get={get}
            set={set}
            width={contents?.container !== false}
          />
        </Part>
      )}
      {has("visibility") && (
        <Part
          title="Show on devices"
          changed={
            visibility ? visibility.hidden.length > 0 : changed(["hide"])
          }
          defaultOpen={open.includes("visibility")}
        >
          <VisibilityPart get={get} set={set} visibility={visibility} />
        </Part>
      )}
    </div>
  );
}

type PartProps = {
  get: (path: Path) => unknown;
  set: (path: Path, next: unknown) => void;
};

/* -------------------------------------------------------------------------- *
 * Parts
 * -------------------------------------------------------------------------- */

const TARGETS = [
  { value: "heading", label: "Headings" },
  { value: "text", label: "Text" },
  { value: "button", label: "Buttons" },
] as const;

function TypographyPart({
  get,
  set,
  align,
  contents,
}: PartProps & { align: boolean; contents: Props["contents"] }) {
  const offered = TARGETS.filter(
    (option) => !contents || contents[option.value],
  );
  const [chosen, setTarget] = React.useState<"heading" | "text" | "button">(
    "heading",
  );
  // The chosen one when the section has it; else the first it has.
  const target = offered.some((option) => option.value === chosen)
    ? chosen
    : (offered[0]?.value ?? "text");
  if (offered.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        This section shows no text of its own, so there is nothing here to
        style.
      </p>
    );
  }
  // A button's colours are under Buttons (with its line, corners and spacing), and it
  // keeps a one-line height, so neither is offered here.
  const isButton = target === "button";
  const base = [target] as const;

  return (
    <div className="space-y-4">
      <Segmented
        label="Style for"
        value={target}
        options={offered.map((option) => ({ ...option }))}
        onChange={(next) =>
          setTarget((next ?? "heading") as "heading" | "text" | "button")
        }
      />

      <Row
        label="Font"
        onReset={
          get([...base, "font"])
            ? () => set([...base, "font"], undefined)
            : undefined
        }
      >
        <Select
          value={(get([...base, "font"]) as string | undefined) ?? "default"}
          onValueChange={(next) =>
            set([...base, "font"], next === "default" ? undefined : next)
          }
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default" className="text-xs">
              Default (Helvetica Neue)
            </SelectItem>
            {FONTS.map((font) => (
              <SelectItem key={font.id} value={font.id} className="text-xs">
                <span style={{ fontFamily: fontStack(font.id as FontId) }}>
                  {font.label}
                </span>
                <span className="text-muted-foreground ms-1.5 text-[10px]">
                  {font.style}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <ResponsiveSlider
        label="Size"
        unit="px"
        min={8}
        max={target === "heading" ? 160 : isButton ? 32 : 48}
        step={1}
        value={get([...base, "size"]) as Responsive<number> | undefined}
        placeholder="Default"
        onChange={(next) => set([...base, "size"], next)}
      />

      <Row
        label="Weight"
        onReset={
          get([...base, "weight"])
            ? () => set([...base, "weight"], undefined)
            : undefined
        }
      >
        <Select
          value={String(
            (get([...base, "weight"]) as number | undefined) ?? "default",
          )}
          onValueChange={(next) =>
            set(
              [...base, "weight"],
              next === "default" ? undefined : Number(next),
            )
          }
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default" className="text-xs">
              Default
            </SelectItem>
            {FONT_WEIGHTS.map((weight) => (
              <SelectItem
                key={weight.value}
                value={String(weight.value)}
                className="text-xs"
              >
                <span style={{ fontWeight: weight.value }}>{weight.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {isButton ? null : (
        <ResponsiveSlider
          label="Line height"
          unit="×"
          min={0.8}
          max={2.6}
          step={0.05}
          value={get([...base, "lineHeight"]) as Responsive<number> | undefined}
          placeholder="Default"
          onChange={(next) => set([...base, "lineHeight"], next)}
        />
      )}

      <ResponsiveSlider
        label="Letter spacing"
        unit="px"
        min={-3}
        max={12}
        step={0.1}
        value={
          get([...base, "letterSpacing"]) as Responsive<number> | undefined
        }
        placeholder="Default"
        onChange={(next) => set([...base, "letterSpacing"], next)}
      />

      {isButton ? null : (
        <Row
          label="Colour"
          onReset={
            get([...base, "color"])
              ? () => set([...base, "color"], undefined)
              : undefined
          }
        >
          <ColorField
            inputId={`design-${target}-color`}
            value={(get([...base, "color"]) as string | undefined) ?? ""}
            onChange={(next) => set([...base, "color"], next || undefined)}
          />
        </Row>
      )}

      <Row
        label="Letter case"
        onReset={
          get([...base, "transform"])
            ? () => set([...base, "transform"], undefined)
            : undefined
        }
      >
        <Segmented
          label="Letter case"
          hideLabel
          value={(get([...base, "transform"]) as string | undefined) ?? ""}
          options={TEXT_TRANSFORMS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(next) => set([...base, "transform"], next)}
        />
      </Row>

      {align ? (
        <div className="border-t pt-4">
          <ResponsiveChoice
            label="Text alignment"
            value={get(["align"]) as Responsive<string> | undefined}
            options={ALIGNMENTS.map((value) => ({
              value,
              label: value[0]!.toUpperCase() + value.slice(1),
            }))}
            onChange={(next) => set(["align"], next)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The buttons' colours (as they are, and under the pointer — Elementor's Normal and
 * Hover), line, corners and the space in and around them. The font, size and letter
 * case are under Typography → Buttons.
 */
function ButtonsPart({ get, set }: PartProps) {
  const [state, setState] = React.useState<"normal" | "hover">("normal");
  const hover = state === "hover";
  const key = (normal: string, onHover: string) =>
    ["buttonLook", hover ? onHover : normal] as const;
  const colours = [
    { label: "Background", path: key("background", "hoverBackground") },
    { label: "Text", path: key("color", "hoverColor") },
    { label: "Line", path: key("borderColor", "hoverBorderColor") },
  ];
  const background =
    (get(["buttonLook", "background"]) as string | undefined) ?? "";
  const text = (get(["buttonLook", "color"]) as string | undefined) ?? "";
  const hard = background && text && contrastRatio(background, text) < 4.5;
  // A new background with no text colour beside it (as it is, or under the pointer)
  // gets a readable one too — the design's dark wood or earth, still the editor's
  // to change. In one change, so neither write undoes the other.
  const setColour = (path: readonly [string, string], next: string) => {
    const textKey =
      path[1] === "background"
        ? "color"
        : path[1] === "hoverBackground"
          ? "hoverColor"
          : null;
    if (next && textKey && !get(["buttonLook", textKey])) {
      const readable =
        contrastRatio(next, "#302f2d") >= contrastRatio(next, "#ebe8e3")
          ? "#302f2d"
          : "#ebe8e3";
      const look =
        (get(["buttonLook"]) as Record<string, unknown> | undefined) ?? {};
      set(["buttonLook"], { ...look, [path[1]]: next, [textKey]: readable });
      return;
    }
    set(path, next || undefined);
  };
  const number = (path: readonly string[]) => get(path) as number | undefined;
  const responsive = (path: readonly string[]) =>
    get(path) as Responsive<number> | undefined;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Filled and outlined buttons take all of these; a text link only its
        colours. Font and size are under Typography.
      </p>
      <Segmented
        label="Colours"
        value={state}
        options={[
          { value: "normal", label: "Normal" },
          { value: "hover", label: "Under the pointer" },
        ]}
        onChange={(next) => setState(next === "hover" ? "hover" : "normal")}
      />
      {colours.map((colour) => (
        <Row
          key={colour.label}
          label={colour.label}
          onReset={
            get(colour.path) ? () => set(colour.path, undefined) : undefined
          }
        >
          <ColorField
            inputId={`design-button-${colour.path[1]}`}
            value={(get(colour.path) as string | undefined) ?? ""}
            onChange={(next) => setColour(colour.path, typeof next === "string" ? next : "")}
          />
        </Row>
      ))}
      {hover ? (
        <p className="text-muted-foreground text-xs">
          Empty: the button keeps its colours and dims slightly.
        </p>
      ) : null}
      {!hover && hard ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          The text is hard to read on this background — choose a lighter or
          darker one.
        </p>
      ) : null}

      <div className="space-y-4 border-t pt-4">
        <Slider
          label="Line thickness"
          unit="px"
          min={0}
          max={10}
          step={1}
          value={number(["buttonLook", "borderWidth"])}
          placeholder="Default"
          onChange={(next) => set(["buttonLook", "borderWidth"], next)}
        />
        <Slider
          label="Rounded corners"
          unit="px"
          min={0}
          max={100}
          step={1}
          value={number(["buttonLook", "radius"])}
          placeholder="0"
          onChange={(next) => set(["buttonLook", "radius"], next)}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <ResponsiveSlider
          label="Space inside, left and right"
          unit="px"
          min={0}
          max={120}
          step={1}
          value={responsive(["buttonLook", "padX"])}
          placeholder="Default"
          onChange={(next) => set(["buttonLook", "padX"], next)}
        />
        <ResponsiveSlider
          label="Space inside, top and bottom"
          unit="px"
          min={0}
          max={60}
          step={1}
          value={responsive(["buttonLook", "padY"])}
          placeholder="Default"
          onChange={(next) => set(["buttonLook", "padY"], next)}
        />
        <ResponsiveSlider
          label="Space above the buttons"
          unit="px"
          min={0}
          max={200}
          step={1}
          value={responsive(["buttonLook", "spaceAbove"])}
          placeholder="Default"
          onChange={(next) => set(["buttonLook", "spaceAbove"], next)}
        />
        <ResponsiveSlider
          label="Space between buttons"
          unit="px"
          min={0}
          max={120}
          step={1}
          value={responsive(["buttonLook", "gap"])}
          placeholder="Default"
          onChange={(next) => set(["buttonLook", "gap"], next)}
        />
      </div>
    </div>
  );
}

function BackgroundPart({ get, set }: PartProps) {
  const image = get(["background", "image"]) as ImageRef | null | undefined;
  const overlay = get(["background", "overlay"]) as string | undefined;

  return (
    <div className="space-y-4">
      <Row label="Image" hint="Covers the whole section, behind its content.">
        <ImageField
          label="Background image"
          value={image ?? null}
          onChange={(next) => set(["background", "image"], next ?? undefined)}
        />
      </Row>
      {image ? (
        <>
          <Row
            label="Image on phones"
            hint="Optional — a taller crop for narrow screens."
          >
            <ImageField
              label="Background image on phones"
              value={
                (get(["background", "mobileImage"]) as
                  ImageRef | null | undefined) ?? null
              }
              onChange={(next) =>
                set(["background", "mobileImage"], next ?? undefined)
              }
            />
          </Row>
          <Segmented
            label="Keep in view"
            value={
              (get(["background", "position"]) as string | undefined) ??
              "center"
            }
            options={[
              { value: "top", label: "Top" },
              { value: "center", label: "Middle" },
              { value: "bottom", label: "Bottom" },
            ]}
            onChange={(next) =>
              set(
                ["background", "position"],
                next === "center" ? undefined : next,
              )
            }
          />
        </>
      ) : null}
      <GradientRows get={get} set={set} />
      <Row
        label="Overlay colour"
        hint="A colour laid over the image so text on it stays readable."
        onReset={
          overlay ? () => set(["background", "overlay"], undefined) : undefined
        }
      >
        <ColorField
          inputId="design-overlay"
          value={overlay ?? ""}
          onChange={(next) => set(["background", "overlay"], next || undefined)}
        />
      </Row>
      {overlay ? (
        <Slider
          label="Overlay strength"
          unit="%"
          min={0}
          max={90}
          step={5}
          value={get(["background", "overlayOpacity"]) as number | undefined}
          placeholder="40"
          onChange={(next) => set(["background", "overlayOpacity"], next)}
        />
      ) : null}
    </div>
  );
}

/** A two-colour gradient: switched on with a start that reads as the brand, then tuned. */
function GradientRows({ get, set }: PartProps) {
  const gradient = get(["background", "gradient"]) as
    { from: string; to: string; angle: number } | undefined;
  const change = (key: "from" | "to" | "angle", next: unknown) =>
    // A cleared colour keeps the old one: a gradient needs both ends.
    set(["background", "gradient"], {
      ...gradient!,
      [key]: next === "" || next === undefined ? gradient![key] : next,
    });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="design-gradient" className="text-xs">
          Gradient
        </Label>
        <Switch
          id="design-gradient"
          checked={Boolean(gradient)}
          onCheckedChange={(on) =>
            set(
              ["background", "gradient"],
              on ? { from: "#ebe8e3", to: "#c9c2b8", angle: 180 } : undefined,
            )
          }
        />
      </div>
      {gradient ? (
        <>
          <Row label="From">
            <ColorField
              inputId="design-gradient-from"
              value={gradient.from}
              onChange={(next) => change("from", next)}
            />
          </Row>
          <Row label="To">
            <ColorField
              inputId="design-gradient-to"
              value={gradient.to}
              onChange={(next) => change("to", next)}
            />
          </Row>
          <Slider
            label="Direction"
            hint="0° goes upwards, 90° to the right, 180° downwards."
            unit="°"
            min={0}
            max={360}
            step={15}
            value={gradient.angle}
            placeholder="180"
            onChange={(next) => change("angle", next ?? 180)}
          />
        </>
      ) : null}
    </div>
  );
}

function SpacingPart({
  get,
  set,
  base,
}: PartProps & { base: Props["spacingBase"] }) {
  const { device } = useEditorDevice();

  if (!base) {
    return (
      <p className="text-muted-foreground text-xs">
        Turn on{" "}
        <span className="text-foreground font-medium">Custom spacing</span>{" "}
        under Spacing first. Then the space can be set separately for tablet and
        mobile here.
      </p>
    );
  }
  if (device === "d") {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Desktop uses the Custom spacing above. Choose tablet or mobile to give
          a smaller screen its own spacing.
        </p>
        <DeviceSwitch />
      </div>
    );
  }

  const fields = [
    { key: "pt", label: "Space inside, top", base: base.pt },
    { key: "pb", label: "Space inside, bottom", base: base.pb },
    { key: "mt", label: "Space above", base: base.mt },
    { key: "mb", label: "Space below", base: base.mb },
  ] as const;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <DeviceIcon device={device} /> Spacing on{" "}
        {DEVICE_LABELS[device].toLowerCase()}. Empty uses the larger screen’s.
      </p>
      {fields.map((field) => {
        const own = get(["spacing", device, field.key]) as number | undefined;
        const inherited =
          device === "m"
            ? ((get(["spacing", "t", field.key]) as number | undefined) ??
              field.base)
            : field.base;
        return (
          <Slider
            key={field.key}
            label={field.label}
            unit="px"
            min={0}
            max={400}
            step={1}
            value={own}
            placeholder={String(inherited)}
            onChange={(next) => set(["spacing", device, field.key], next)}
          />
        );
      })}
    </div>
  );
}

function EffectsPart({
  get,
  set,
  radiusBase,
}: PartProps & { radiusBase: number }) {
  const { device } = useEditorDevice();
  const corners =
    device === "d" ? null : (get(["radius", device]) as number | undefined);
  const inherited =
    device === "m"
      ? ((get(["radius", "t"]) as number | undefined) ?? radiusBase)
      : radiusBase;
  return (
    <div className="space-y-4">
      {device === "d" ? (
        <p className="text-muted-foreground text-xs">
          Desktop corners are set under Line &amp; corners. Choose tablet or
          mobile to round them differently there.
        </p>
      ) : (
        <Slider
          label={`Rounded corners on ${DEVICE_LABELS[device].toLowerCase()}`}
          unit="px"
          min={0}
          max={200}
          step={1}
          value={corners ?? undefined}
          placeholder={String(inherited)}
          device={device}
          onChange={(next) => set(["radius", device], next)}
        />
      )}
      <Segmented
        label="Shadow"
        value={(get(["shadow"]) as string | undefined) ?? "none"}
        options={Object.entries(SHADOWS).map(([value, shadow]) => ({
          value,
          label: shadow.label,
        }))}
        onChange={(next) => set(["shadow"], next === "none" ? undefined : next)}
      />
      <Slider
        label="Transparency"
        hint="100% is fully visible."
        unit="%"
        min={10}
        max={100}
        step={5}
        value={get(["opacity"]) as number | undefined}
        placeholder="100"
        onChange={(next) => set(["opacity"], next === 100 ? undefined : next)}
      />
    </div>
  );
}

function ImagesPart({ get, set }: PartProps) {
  return (
    <div className="space-y-4">
      <Segmented
        label="Shape"
        value={(get(["images", "ratio"]) as string | undefined) ?? "original"}
        options={[
          { value: "original", label: "As uploaded" },
          ...Object.entries(IMAGE_RATIOS).map(([value, ratio]) => ({
            value,
            label: ratio.label,
          })),
        ]}
        onChange={(next) =>
          set(["images", "ratio"], next === "original" ? undefined : next)
        }
      />
      <Slider
        label="Rounded corners"
        unit="px"
        min={0}
        max={120}
        step={1}
        value={get(["images", "radius"]) as number | undefined}
        placeholder="0"
        onChange={(next) =>
          set(["images", "radius"], next === 0 ? undefined : next)
        }
      />
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="design-zoom" className="text-xs">
          Zoom in slightly under the pointer
        </Label>
        <Switch
          id="design-zoom"
          checked={get(["images", "zoom"]) === true}
          onCheckedChange={(on) =>
            set(["images", "zoom"], on ? true : undefined)
          }
        />
      </div>
    </div>
  );
}

/** `width` off: the section runs edge to edge with no content column to narrow. */
function LayoutPart({ get, set, width }: PartProps & { width: boolean }) {
  const minHeight = get(["minHeight"]) as Responsive<number> | undefined;
  return (
    <div className="space-y-4">
      {width ? (
        <ResponsiveSlider
          label="Content width"
          hint="The widest the content may get. Empty uses the design’s width."
          unit="px"
          min={320}
          max={2400}
          step={10}
          value={get(["maxWidth"]) as Responsive<number> | undefined}
          placeholder="Default"
          onChange={(next) => set(["maxWidth"], next)}
        />
      ) : null}
      <ResponsiveSlider
        label="Minimum height"
        unit="px"
        min={0}
        max={1600}
        step={10}
        value={minHeight}
        placeholder="Auto"
        onChange={(next) => set(["minHeight"], next)}
      />
      {minHeight ? (
        <Segmented
          label="Content sits"
          value={(get(["verticalAlign"]) as string | undefined) ?? "top"}
          options={[
            { value: "top", label: "Top" },
            { value: "center", label: "Middle" },
            { value: "bottom", label: "Bottom" },
          ]}
          onChange={(next) =>
            set(["verticalAlign"], next === "top" ? undefined : next)
          }
        />
      ) : null}
    </div>
  );
}

function VisibilityPart({
  get,
  set,
  visibility,
}: PartProps & { visibility?: Props["visibility"] }) {
  return (
    <div className="space-y-3">
      {DEVICES.map((device) => {
        const hidden = visibility
          ? visibility.hidden.includes(device)
          : get(["hide", device]) === true;
        return (
          <div key={device} className="flex items-center justify-between gap-3">
            <Label
              htmlFor={`design-show-${device}`}
              className="flex items-center gap-2 text-xs font-normal"
            >
              <DeviceIcon device={device} />
              Show on {DEVICE_LABELS[device].toLowerCase()}
            </Label>
            <Switch
              id={`design-show-${device}`}
              checked={!hidden}
              onCheckedChange={(show) => {
                if (!visibility)
                  return set(["hide", device], show ? undefined : true);
                const next = DEVICES.filter((other) =>
                  other === device ? !show : visibility.hidden.includes(other),
                );
                visibility.onChange(next);
              }}
            />
          </div>
        );
      })}
      <p className="text-muted-foreground text-xs">
        A hidden section is still on the page for the other devices.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Building blocks
 * -------------------------------------------------------------------------- */

function Part({
  title,
  changed,
  defaultOpen,
  children,
}: {
  title: string;
  changed: boolean;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-md border"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-open:rotate-90" />
        {title}
        {changed ? (
          <span
            className="bg-primary ms-auto size-1.5 rounded-full"
            title="Changed"
            aria-label="Changed"
          />
        ) : null}
      </summary>
      <div className="border-t px-3 py-3">{children}</div>
    </details>
  );
}

function DeviceIcon({ device }: { device: Device }) {
  const Icon = DEVICE_ICONS[device];
  return (
    <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
  );
}

function ResetButton({
  onReset,
  label,
}: {
  onReset: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground"
      aria-label={`Reset ${label}`}
      title="Back to default"
      onClick={onReset}
    >
      <RotateCcwIcon />
    </Button>
  );
}

export function Row({
  label,
  hint,
  onReset,
  device,
  children,
}: {
  label: string;
  hint?: string;
  onReset?: () => void;
  device?: Device;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-6 items-center gap-1.5">
        <span className="text-xs font-medium">{label}</span>
        {device ? <DeviceCycle device={device} /> : null}
        <span className="ms-auto">
          {onReset ? <ResetButton onReset={onReset} label={label} /> : null}
        </span>
      </div>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/** The device icon beside a responsive control; clicking it moves to the next device, as in Elementor. */
function DeviceCycle({ device }: { device: Device }) {
  const { setDevice } = useEditorDevice();
  const Icon = DEVICE_ICONS[device];
  const next = DEVICES[(DEVICES.indexOf(device) + 1) % DEVICES.length]!;
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground rounded p-0.5"
      title={`Editing ${DEVICE_LABELS[device].toLowerCase()} — click for ${DEVICE_LABELS[next].toLowerCase()}`}
      aria-label={`Editing ${DEVICE_LABELS[device]}. Switch to ${DEVICE_LABELS[next]}`}
      onClick={() => setDevice(next)}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/** A number with a slider beside it; empty means "default", shown as the placeholder. */
export function Slider({
  label,
  hint,
  unit,
  min,
  max,
  step,
  value,
  placeholder,
  onChange,
  device,
  inheritedNote,
}: {
  label: string;
  hint?: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number | undefined;
  placeholder: string;
  onChange: (next: number | undefined) => void;
  device?: Device;
  inheritedNote?: string | null;
}) {
  const id = React.useId();
  const decimals = step < 1 ? String(step).split(".")[1]!.length : 0;
  const clamp = (raw: number) =>
    Number(Math.min(max, Math.max(min, raw)).toFixed(decimals));
  const shown =
    value ?? (Number.isFinite(Number(placeholder)) ? Number(placeholder) : min);

  return (
    <Row
      label={label}
      hint={hint}
      device={device}
      onReset={value !== undefined ? () => onChange(undefined) : undefined}
    >
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={shown}
          aria-label={label}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          className={cn(
            "accent-primary h-1.5 min-w-0 flex-1 cursor-pointer",
            value === undefined && "opacity-40",
          )}
        />
        <div className="relative">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={value === undefined ? "" : String(value)}
            placeholder={placeholder}
            aria-label={`${label} (${unit})`}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") return onChange(undefined);
              const next = Number(raw);
              if (Number.isFinite(next)) onChange(clamp(next));
            }}
            className="h-8 w-20 [appearance:textfield] pe-6 text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-[10px]">
            {unit}
          </span>
        </div>
      </div>
      {inheritedNote ? (
        <p className="text-muted-foreground text-[11px]">{inheritedNote}</p>
      ) : null}
    </Row>
  );
}

/** A slider whose value is per device — it edits the device chosen at the top. */
export function ResponsiveSlider({
  value,
  onChange,
  placeholder,
  ...rest
}: Omit<
  React.ComponentProps<typeof Slider>,
  "value" | "onChange" | "device" | "inheritedNote"
> & {
  value: Responsive<number> | undefined;
  onChange: (next: Responsive<number> | undefined) => void;
}) {
  const { device } = useEditorDevice();
  const from = inheritedFrom(value, device);
  const inherited = from ? resolveResponsive(value, device) : undefined;
  return (
    <Slider
      {...rest}
      device={device}
      value={value?.[device]}
      placeholder={inherited !== undefined ? String(inherited) : placeholder}
      inheritedNote={
        from
          ? `Same as ${DEVICE_LABELS[from].toLowerCase()} until changed here.`
          : null
      }
      onChange={(next) => {
        const updated = { ...value, [device]: next };
        if (next === undefined) delete updated[device];
        onChange(Object.keys(updated).length ? updated : undefined);
      }}
    />
  );
}

export function Segmented({
  label,
  hideLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string | undefined) => void;
}) {
  const control = (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() =>
            onChange(
              value === option.value && hideLabel ? undefined : option.value,
            )
          }
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            value === option.value
              ? "bg-background shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
  if (hideLabel) return control;
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <div>{control}</div>
    </div>
  );
}

function ResponsiveChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Responsive<string> | undefined;
  options: { value: string; label: string }[];
  onChange: (next: Responsive<string> | undefined) => void;
}) {
  const { device } = useEditorDevice();
  const own = value?.[device];
  const from = inheritedFrom(value, device);
  const current = own ?? resolveResponsive(value, device) ?? "";
  const set = (next: string | undefined) => {
    const updated = { ...value, [device]: next };
    if (next === undefined) delete updated[device];
    onChange(Object.keys(updated).length ? updated : undefined);
  };
  return (
    <Row
      label={label}
      device={device}
      onReset={own !== undefined ? () => set(undefined) : undefined}
    >
      <Segmented
        label={label}
        hideLabel
        value={current}
        options={options}
        onChange={set}
      />
      {from ? (
        <p className="text-muted-foreground text-[11px]">
          Same as {DEVICE_LABELS[from].toLowerCase()} until changed here.
        </p>
      ) : !current ? (
        <p className="text-muted-foreground text-[11px]">
          Default: as the section is designed.
        </p>
      ) : null}
    </Row>
  );
}
