"use client";

import { Loader2Icon } from "lucide-react";
import { useParams } from "next/navigation";

import { Skeleton } from "@/components/admin/ui/skeleton";
import { cn } from "@/lib/utils/cn";

import { useRememberedPageBar } from "./page-bar-memory";
import { PageEditorBar } from "./page-editor-bar";

/** The bar while a tab loads: the remembered one when it is this page's, else its outline. */
export function PendingPageBar({ active, className }: { active: "content" | "settings"; className?: string }) {
  const last = useRememberedPageBar();
  const { id } = useParams<{ id: string }>();

  if (last && last.param === id) {
    return (
      <PageEditorBar
        className={className}
        title={last.title}
        path={last.path}
        param={last.param}
        active={active}
        isPublished={last.isPublished}
        content={last.content}
      >
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" aria-live="polite">
          <Loader2Icon className="size-3 animate-spin" />
          Loading…
        </span>
      </PageEditorBar>
    );
  }

  return (
    <div className={cn("bg-background flex items-center gap-3 border-b px-3 py-2.5", className)}>
      <Skeleton className="size-7" />
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-8 w-36" />
    </div>
  );
}
