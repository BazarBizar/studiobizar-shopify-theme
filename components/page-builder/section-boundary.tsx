"use client";

import { Component, type ReactNode } from "react";

/**
 * One section failing to draw costs that section, not the page.
 *
 * Server-side failures are caught where the data loads (`section-renderer.tsx`);
 * this catches the rest — a Client Component inside a section throwing while it
 * renders in the browser. A class because error boundaries still have no hook.
 */
export class SectionBoundary extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[page-builder] section ${this.props.id} failed to render`, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
