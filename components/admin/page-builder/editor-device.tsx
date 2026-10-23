"use client";

import { EyeIcon, MonitorIcon, PencilIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { DEVICE_LABELS, DEVICES, type Device } from "@/lib/page-builder/design";
import { cn } from "@/lib/utils/cn";

/**
 * THE DEVICE BEING EDITED — one choice for the whole editor, as in Elementor: the
 * preview takes that width, and every responsive control edits that device's
 * value. Changing it anywhere (the bar above the preview, the toggle in the Style
 * tab, the icon beside a control) changes it everywhere.
 */

type DeviceState = { device: Device; setDevice: (device: Device) => void };

export const EditorDeviceContext = React.createContext<DeviceState>({ device: "d", setDevice: () => undefined });

export const useEditorDevice = () => React.useContext(EditorDeviceContext);

export const DEVICE_ICONS: Record<Device, typeof MonitorIcon> = { d: MonitorIcon, t: TabletIcon, m: SmartphoneIcon };

/**
 * The width each device is RENDERED at, px. Desktop is at least 1440 — the width the
 * designs were drawn at, and well past the 1024px tablet breakpoint — even when the
 * editor's preview pane is narrower, so "Desktop" always shows the desktop design
 * (scaled to fit) and never, quietly, the tablet one. Tablet and mobile are common
 * tablet and phone widths.
 */
export const DEVICE_PIXELS: Record<Device, number> = { d: 1440, t: 820, m: 390 };

/**
 * The preview at the device's real width, scaled down to fit the pane when the pane
 * is narrower — what the visitor's screen would show, shrunk, rather than the page
 * reflowed to a width no visitor has.
 */
export function DeviceViewport({
  device,
  children,
}: {
  device: Device;
  children: (style: React.CSSProperties) => React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // Hidden (a narrow screen showing the settings): keep the last size, so the
      // preview stays loaded instead of reloading each time it is shown again.
      if (entry && entry.contentRect.width > 0) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const inset = device === "d" ? 0 : 16;
  const available = { width: Math.max(0, box.width - inset * 2), height: Math.max(0, box.height - inset * 2) };
  const target = device === "d" ? Math.max(DEVICE_PIXELS.d, available.width) : DEVICE_PIXELS[device];
  const scale = available.width > 0 && target > available.width ? available.width / target : 1;

  return (
    <div ref={ref} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      {box.width > 0 ? (
        <div
          className="absolute"
          style={{
            left: inset + (available.width - target * scale) / 2,
            top: inset,
            width: target * scale,
            height: available.height,
          }}
        >
          {children({
            width: target,
            height: available.height / scale,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: "top left",
          })}
        </div>
      ) : null}
    </div>
  );
}

export function DeviceSwitch({ className, size = "icon-xs" }: { className?: string; size?: "icon-xs" | "icon-sm" }) {
  const { device, setDevice } = useEditorDevice();
  return (
    <div className={cn("bg-muted flex rounded-md p-0.5", className)} role="group" aria-label="Device">
      {DEVICES.map((candidate) => {
        const Icon = DEVICE_ICONS[candidate];
        return (
          <Button
            key={candidate}
            type="button"
            variant={device === candidate ? "outline" : "ghost"}
            size={size}
            aria-label={`${DEVICE_LABELS[candidate]} view`}
            title={DEVICE_LABELS[candidate]}
            aria-pressed={device === candidate}
            onClick={() => setDevice(candidate)}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Below 1024px there is no room for the settings and the preview side by side; this
 * button switches between them, so the preview is one tap away on a tablet or a small
 * laptop instead of only in another tab.
 */
export function PaneSwitch({ pane, onChange }: { pane: "edit" | "preview"; onChange: (pane: "edit" | "preview") => void }) {
  return (
    <Button
      type="button"
      size="sm"
      className="fixed right-4 bottom-4 z-30 shadow-lg lg:hidden"
      onClick={() => onChange(pane === "edit" ? "preview" : "edit")}
    >
      {pane === "edit" ? <EyeIcon /> : <PencilIcon />}
      {pane === "edit" ? "Show preview" : "Back to editing"}
    </Button>
  );
}
