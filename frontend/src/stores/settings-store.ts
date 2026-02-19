import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

interface SettingsStore extends Settings {
  isOpen: boolean;
  draft: Settings | null;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (updates: Partial<Settings>) => void;
  updateDraft: (updates: Partial<Settings>) => void;
  commitDraft: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      isOpen: false,
      draft: null,

      openSettings: () => {
        const s = get();
        set({
          isOpen: true,
          draft: {
            fontSize: s.fontSize,
            theme: s.theme,
            startBehavior: s.startBehavior,
            port: s.port,
            scrollback: s.scrollback,
            leaderKey: s.leaderKey,
            defaultPath: s.defaultPath,
          },
        });
      },

      closeSettings: () => set({ isOpen: false, draft: null }),

      updateSettings: (updates) => set(updates),

      updateDraft: (updates) =>
        set((state) => ({
          draft: state.draft ? { ...state.draft, ...updates } : null,
        })),

      commitDraft: () =>
        set((state) => {
          if (!state.draft) return {};
          // draft를 실제 설정에 반영하되, 모달은 열린 채로 유지
          // draft도 현재 값으로 갱신 (이후 수정의 기준점)
          return { ...state.draft, draft: { ...state.draft } };
        }),
    }),
    {
      name: "deck-settings",
      // isOpen, draft, 함수들은 localStorage에 저장하지 않음
      partialize: (state) => {
        const {
          isOpen: _isOpen,
          draft: _draft,
          openSettings: _open,
          closeSettings: _close,
          updateSettings: _update,
          updateDraft: _updateDraft,
          commitDraft: _commit,
          ...settings
        } = state;
        return settings;
      },
    },
  ),
);
