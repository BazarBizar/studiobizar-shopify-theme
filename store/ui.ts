"use client";

import { create } from "zustand";

/** Ephemeral UI state — never persisted. */
type UiState = {
  inquiryDrawerOpen: boolean;
  openInquiryDrawer: () => void;
  closeInquiryDrawer: () => void;
};

export const useUi = create<UiState>()((set) => ({
  inquiryDrawerOpen: false,
  openInquiryDrawer: () => set({ inquiryDrawerOpen: true }),
  closeInquiryDrawer: () => set({ inquiryDrawerOpen: false }),
}));
