"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { MENU_HANDLE, menuHandleFrom, paramFromMenuId } from "@/lib/admin/menu-tree";
import { createMenuRequest } from "@/lib/admin/queries";

/**
 * "Create menu": a name (its handle follows it until changed), then the editor of the
 * new, empty menu — where its links are added, as in Shopify.
 */
export function CreateMenuButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [handleTouched, setHandleTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const shownHandle = handleTouched ? handle : menuHandleFrom(title);
  const valid = title.trim() !== "" && MENU_HANDLE.test(shownHandle);

  async function create() {
    setBusy(true);
    try {
      const menu = await createMenuRequest({ title: title.trim(), handle: shownHandle });
      toast.success("Menu created", { description: "Add its links, then choose it in Appearance." });
      setOpen(false);
      router.push(`/admin/menus/${paramFromMenuId(menu.id)}`);
    } catch (error) {
      toast.error("Could not create it", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon />
        Create menu
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setTitle("");
            setHandle("");
            setHandleTouched(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create menu</DialogTitle>
            <DialogDescription>Name it after where it goes or what it holds — you add its links next.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid && !busy) void create();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-menu-title">Name</Label>
              <Input
                id="new-menu-title"
                value={title}
                maxLength={255}
                autoFocus
                placeholder="e.g. Shop by room"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-menu-handle">Handle</Label>
              <Input
                id="new-menu-handle"
                value={shownHandle}
                placeholder="shop-by-room"
                onChange={(event) => {
                  setHandleTouched(true);
                  setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
              />
              <p className="text-muted-foreground text-xs">How Appearance and the Shopify theme find it. Lowercase, with dashes.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || busy}>
                {busy ? <Loader2Icon className="animate-spin" /> : null}
                Create menu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
