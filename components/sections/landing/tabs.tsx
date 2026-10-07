"use client";

import * as React from "react";

import { ButtonLink } from "@/components/ui/button";
import type { ShopifyImage } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Picture, Prose, SectionHeader, type LandingLink } from "./shared";

export type TabItem = {
  id: string;
  label: string;
  title: string;
  html: string;
  image: ShopifyImage | null;
  link: LandingLink | null;
};

/**
 * Topics behind tabs, following the WAI-ARIA tabs pattern: arrow keys move
 * between tabs, Home and End jump to the ends, and only the active tab is in the
 * tab order. Every panel is in the HTML — hidden ones with `hidden` — so search
 * engines read all of them and nothing waits on a script to exist.
 */
export function Tabs({
  id,
  title,
  intro,
  headingAlign,
  items,
  imageSide,
  tabStyle,
  placeholder,
}: {
  id: string;
  title: string;
  intro: string;
  headingAlign: "left" | "center";
  items: TabItem[];
  imageSide: "left" | "right";
  tabStyle: "underline" | "pills";
  placeholder?: boolean;
}) {
  const [active, setActive] = React.useState(0);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  if (items.length === 0) return null;

  const focus = (index: number) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => focus(active + 1),
      ArrowLeft: () => focus(active - 1),
      Home: () => focus(0),
      End: () => focus(items.length - 1),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="sb-container py-section">
      <SectionHeader title={title} intro={intro} align={headingAlign} />

      <div
        role="tablist"
        aria-label={title || "Topics"}
        onKeyDown={onKeyDown}
        className={cn(
          "-mx-[var(--sb-gutter)] flex gap-2 overflow-x-auto px-[var(--sb-gutter)] sm:mx-0 sm:px-0",
          headingAlign === "center" && "sm:justify-center",
          tabStyle === "underline" && "border-border gap-8 border-b",
        )}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${item.id}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${item.id}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            className={cn(
              "text-button shrink-0 whitespace-nowrap uppercase transition-colors",
              tabStyle === "underline"
                ? cn("-mb-px border-b py-3", index === active ? "border-foreground" : "text-muted hover:text-foreground border-transparent")
                : cn(
                    "border px-5 py-2",
                    index === active ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground",
                  ),
            )}
          >
            {item.label || `Tab ${index + 1}`}
          </button>
        ))}
      </div>

      {items.map((item, index) => {
        const hasImage = Boolean(item.image) || placeholder;
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={`${id}-panel-${item.id}`}
            aria-labelledby={`${id}-tab-${item.id}`}
            hidden={index !== active}
            tabIndex={0}
            className="pt-10 sm:pt-14"
          >
            <div
              className={cn(
                "grid gap-10 lg:items-center lg:gap-20",
                hasImage && "lg:grid-cols-2",
                imageSide === "left" && "lg:[&>*:last-child]:-order-1",
              )}
            >
              <div className="max-w-[40rem]">
                {item.title.trim() && <h3 className="text-h2">{item.title}</h3>}
                <Prose html={item.html} className={cn(item.title.trim() && "mt-5")} />
                {item.link?.href && item.link.label && (
                  <ButtonLink href={item.link.href} variant="outline" className="mt-8">
                    {item.link.label}
                  </ButtonLink>
                )}
              </div>
              {hasImage && (
                <Picture image={item.image} ratio="landscape" placeholder={placeholder} sizes="(max-width: 1023px) 100vw, 45vw" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
