"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { CrumbLabel } from "@/components/admin/crumbs";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { pageStatus, STATUS_TONE, type ContentStatus } from "@/lib/admin/page-status";
import { cn } from "@/lib/utils/cn";

import { PageTabs } from "./page-tabs";

/** The page's one status, as a badge; the hint is its tooltip (or shown under it). */
export function PageStatusBadge({
  isPublished,
  content,
  showHint = false,
}: {
  isPublished: boolean;
  content: ContentStatus;
  showHint?: boolean;
}) {
  const status = pageStatus(isPublished, content);
  return (
    <>
      <Badge variant="outline" className={STATUS_TONE[status.tone]} title={status.hint}>
        {status.label}
      </Badge>
      {showHint ? <p className="text-muted-foreground mt-1 text-xs whitespace-normal">{status.hint}</p> : null}
    </>
  );
}

/**
 * THE header of a page being edited — the same bar on its Content tab (the page
 * builder) and its Settings tab, so switching tabs changes what is below and
 * nothing above (see docs/admin/ui-standard.md): back to Pages, the title and
 * address, Content | Settings, the page's status, then that tab's own actions.
 *
 * Full-bleed: it cancels the layout's padding, as the builder always did.
 */
export function PageEditorBar({
  title,
  path,
  param,
  active,
  isPublished,
  content,
  onLeave,
  children,
  className,
}: {
  title: string;
  /** The page's address on the site. */
  path: string;
  /** The page's id segment; without it there are no tabs (a page with no Content tab). */
  param?: string;
  active: "content" | "settings";
  isPublished: boolean;
  content: ContentStatus;
  /** Asked before leaving the tab or the page; false stays. */
  onLeave?: () => Promise<boolean>;
  /** This tab's actions, on the right. */
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("bg-background flex flex-wrap items-center gap-2 border-b px-3 py-2", className)}>
      {param ? <CrumbLabel href={`/admin/pages/${param}`} label={title} /> : <CrumbLabel label={title} />}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Back to pages"
        title="Back to pages"
        onClick={async () => {
          if (!onLeave || (await onLeave())) router.push("/admin/pages");
        }}
      >
        <ArrowLeftIcon />
      </Button>

      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <p className="text-muted-foreground truncate text-[11px]">{path}</p>
      </div>

      {param ? <PageTabs param={param} active={active} beforeLeave={onLeave} /> : null}

      <div className="flex items-center gap-1.5">
        <PageStatusBadge isPublished={isPublished} content={content} />
      </div>

      <div className="ms-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}
