"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

/**
 * The record's own name in the breadcrumb — "Pages › About", not "Pages › Page".
 *
 * The breadcrumb sits in the layout's header and only sees the URL; the screen
 * knows the name. `DetailHeader` and `PageEditorBar` render `<CrumbLabel>`, which
 * hands the name up for one path; the breadcrumb asks for it by path.
 */

type Labels = Record<string, string>;

const CrumbContext = React.createContext<{
  labels: Labels;
  set: (href: string, label: string) => void;
}>({ labels: {}, set: () => undefined });

export function CrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = React.useState<Labels>({});
  const set = React.useCallback(
    (href: string, label: string) =>
      setLabels((current) => (current[href] === label ? current : { ...current, [href]: label })),
    [],
  );
  const value = React.useMemo(() => ({ labels, set }), [labels, set]);
  return <CrumbContext.Provider value={value}>{children}</CrumbContext.Provider>;
}

export function useCrumbLabels(): Labels {
  return React.useContext(CrumbContext).labels;
}

/** Names the crumb for `href` (default: this screen's path). Renders nothing. */
export function CrumbLabel({ label, href }: { label: string; href?: string }) {
  const pathname = usePathname();
  const { set } = React.useContext(CrumbContext);
  const target = href ?? pathname;
  React.useEffect(() => {
    if (label) set(target, label);
  }, [label, target, set]);
  return null;
}
