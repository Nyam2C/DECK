import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

interface SettingsStore extends Settings {
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (updates: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      isOpen: false,

      openSettings: () => set({ isOpen: true }),
      closeSettings: () => set({ isOpen: false }),

      updateSettings: (updates) => set(updates),
    }),
    {
      name: "deck-settings",
      // isOpen은 localStorage에 저장하지 않음
      partialize: (state) => {
        const {
          isOpen: _isOpen,
          openSettings: _open,
          closeSettings: _close,
          updateSettings: _update,
          ...settings
        } = state;
        return settings;
      },
    },
  ),
);
