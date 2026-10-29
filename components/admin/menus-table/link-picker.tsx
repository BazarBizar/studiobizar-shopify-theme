"use client";

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, GlobeIcon, HomeIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import type { DestinationOption } from "@/components/admin/destination-picker";
import { Thumb } from "@/components/admin/record-picker";
import { Button } from "@/components/admin/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/admin/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { useProductPages, useProductSearch } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * WHERE A MENU LINK GOES, chosen as in Shopify's link picker: a short list of folders —
 * Collections, Products, Pages, Product types, Vendors, Designers, Projects, Policies,
 * Customer account — each opening to its own searchable list, plus Home, Search and a
 * web address. Typing at the top searches everything at once.
 *
 * Products are many, so their folder lists ALL of them from the server — fifty at a
 * time, the next fifty as the list scrolls — with their photo beside each; typing
 * narrows it on the server. Every folder says how many it holds.
 *
 * The choice shows as its folder and its name — "Collections › The Atlas Collection".
 */

export type LinkOption = DestinationOption & { thumbnail?: string | null };

/** Shopify's order. A folder with nothing in it is not offered. */
const FOLDERS = [
  "Collections",
  "Products",
  "Pages",
  "Product types",
  "Vendors",
  "Designers",
  "Projects",
  "Policies",
  "Customer account",
] as const;

/** "Collections › The Atlas Collection"; the few with no folder by their name alone. */
export function linkOptionLabel(option: { label: string; group: string }): string {
  return option.group === "Store" || option.group === "Current" ? option.label : `${option.group} › ${option.label}`;
}

const STORE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FRONTPAGE: HomeIcon,
  SEARCH: SearchIcon,
  HTTP: GlobeIcon,
};

export function LinkPicker({
  id,
  value,
  options,
  productCount = null,
  onChange,
}: {
  id?: string;
  value: string;
  /** Everything but single products — see `listMenuDestinations`. */
  options: LinkOption[];
  /** How many active products there are, for the Products folder's count. */
  productCount?: number | null;
  /** The option is passed too, so a product found by search can be remembered by its name. */
  onChange: (value: string, option: LinkOption) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [folder, setFolder] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const inProducts = folder === "Products";
  // At the top, typing: the first twenty matching products, beside the other folders'.
  const quickSearch = open && !folder && debounced.length >= 2;
  const quick = useProductSearch(debounced, quickSearch);
  // In Products: every one of them, fifty at a time as the list scrolls.
  const pages = useProductPages(debounced, open && inProducts);
  const toOption = (product: { id: string; title: string; thumbnail: string | null }): LinkOption => ({
    value: `PRODUCT:${product.id}`,
    label: product.title,
    group: "Products",
    thumbnail: product.thumbnail,
  });
  const found: LinkOption[] = inProducts
    ? (pages.data?.pages.flatMap((page) => page.products) ?? []).map(toOption)
    : quickSearch
      ? (quick.data ?? []).map(toOption)
      : [];
  const productTotal = pages.data?.pages[0]?.total?.count ?? productCount;
  const loading = inProducts ? pages.isFetching && !pages.isFetchingNextPage : quick.isFetching;
  const more = () => {
    if (inProducts && pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage();
  };
  /** What a folder holds — its "All …" entry not counted. */
  const countOf = (name: string) =>
    name === "Products"
      ? productTotal
      : options.filter((option) => option.group === name && option.value !== "COLLECTIONS").length;

  const current = [...options, ...found].find((option) => option.value === value);
  const matches = (option: LinkOption) => option.label.toLowerCase().includes(query.trim().toLowerCase());
  const folders = FOLDERS.filter((name) => name === "Products" || options.some((option) => option.group === name));
  const store = options.filter((option) => option.group === "Store");

  const reset = () => {
    setFolder(null);
    setQuery("");
  };
  const choose = (option: LinkOption) => {
    onChange(option.value, option);
    setOpen(false);
    reset();
  };

  const item = (option: LinkOption) => {
    const Icon = STORE_ICONS[option.value];
    return (
      <CommandItem key={`${option.group}-${option.value}`} value={`${option.group}-${option.value}`} onSelect={() => choose(option)}>
        <CheckIcon className={cn("size-3.5 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
        {option.value.startsWith("PRODUCT:") ? <Thumb src={option.thumbnail ?? null} className="size-7" /> : null}
        {Icon ? <Icon className="text-muted-foreground size-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </CommandItem>
    );
  };

  // Inside a folder: its own list. At the top with something typed: everything that
  // matches, by folder. At the top with nothing typed: the folders.
  // A product the menu already links to is listed by name; the server's results are
  // already narrowed by what was typed. Each once.
  const once = (list: LinkOption[]) => list.filter((option, index) => list.findIndex((other) => other.value === option.value) === index);
  const searched = (option: LinkOption) => found.some((other) => other.value === option.value);
  const inside = folder
    ? once([...options.filter((option) => option.group === folder), ...(inProducts ? found : [])].filter(
        (option) => searched(option) || matches(option),
      ))
    : [];
  const everywhere = !folder && query.trim() ? once([...options.filter(matches), ...found]) : [];
  const groups = [...new Set(everywhere.map((option) => option.group))];

  return (
    // Modal: it opens inside the "Add menu item" dialog but is drawn at <body>, where
    // that dialog's scroll lock would swallow the mouse wheel. A modal popover takes the
    // lock over, so its own list scrolls.
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !current && "text-muted-foreground")}
        >
          <span className="truncate">{current ? linkOptionLabel(current) : "Choose where it goes"}</span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          {folder ? (
            <button
              type="button"
              onClick={reset}
              className="hover:bg-muted flex w-full items-center gap-1 border-b px-2 py-2 text-left text-sm font-medium"
            >
              <ChevronLeftIcon className="size-4" />
              {folder}
            </button>
          ) : null}
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={folder ? `Search ${folder.toLowerCase()}` : "Search, or open a folder below"}
            onKeyDown={(event) => {
              // Backspace in an empty search goes back up, as in Shopify.
              if (event.key === "Backspace" && !query && folder) reset();
            }}
          />
          <CommandList
            className="max-h-80"
            onScroll={(event) => {
              const list = event.currentTarget;
              if (list.scrollTop + list.clientHeight >= list.scrollHeight - 160) more();
            }}
          >
            {folder ? (
              <>
                {inProducts && productTotal !== null && !loading ? (
                  <p className="text-muted-foreground px-3 pt-2 text-xs">
                    {debounced
                      ? `${productTotal.toLocaleString("en")} matching`
                      : `${found.length.toLocaleString("en")} of ${productTotal.toLocaleString("en")} products`}
                    {pages.hasNextPage ? " — scroll for more" : ""}
                  </p>
                ) : null}
                <CommandEmpty>{loading ? "Loading…" : "Nothing found."}</CommandEmpty>
                {inside.map(item)}
                {inProducts && pages.hasNextPage ? (
                  <CommandItem value="load-more" onSelect={more} className="text-muted-foreground justify-center">
                    {pages.isFetchingNextPage ? "Loading…" : "Load more products"}
                  </CommandItem>
                ) : null}
              </>
            ) : query.trim() ? (
              <>
                <CommandEmpty>{loading ? "Searching…" : "Nothing found."}</CommandEmpty>
                {groups.map((group) => (
                  <CommandGroup key={group} heading={group === "Store" ? undefined : group}>
                    {everywhere.filter((option) => option.group === group).map(item)}
                    {group === "Products" ? (
                      <CommandItem value="all-matching-products" onSelect={() => setFolder("Products")} className="text-muted-foreground">
                        <span className="size-3.5 shrink-0" />
                        <span className="flex-1">Every product matching “{query.trim()}”</span>
                        <ChevronRightIcon className="size-4" />
                      </CommandItem>
                    ) : null}
                  </CommandGroup>
                ))}
              </>
            ) : (
              <>
                <CommandGroup>{store.filter((option) => option.value !== "HTTP").map(item)}</CommandGroup>
                <CommandGroup>
                  {folders.map((name) => (
                    <CommandItem
                      key={name}
                      value={`folder-${name}`}
                      onSelect={() => {
                        setFolder(name);
                        setQuery("");
                      }}
                    >
                      <CheckIcon
                        className={cn("size-3.5 shrink-0", current?.group === name ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex-1">{name}</span>
                      {countOf(name) ? (
                        <span className="text-muted-foreground text-xs tabular-nums">{countOf(name)!.toLocaleString("en")}</span>
                      ) : null}
                      <ChevronRightIcon className="text-muted-foreground size-4" />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>{store.filter((option) => option.value === "HTTP").map(item)}</CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
