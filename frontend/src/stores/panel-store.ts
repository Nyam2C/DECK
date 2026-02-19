import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Panel, PanelStatus } from "../types";
import { reorderPanelIds } from "../services/drag";

const MAX_PANELS = 4;

interface PanelStore {
  panels: Panel[];
  focusedId: string | null;
  pinnedId: string | null;

  // 액션
  addPanel: () => string | null;
  removePanel: (id: string) => void;
  setFocus: (id: string) => void;
  setPinned: (id: string | null) => void;
  updatePanel: (id: string, updates: Partial<Panel>) => void;
  setStatus: (id: string, status: PanelStatus) => void;
  reorderPanels: (draggedId: string, dropTargetId: string) => void;
}

export const usePanelStore = create<PanelStore>()(
  persist(
    (set, get) => ({
      panels: [],
      focusedId: null,
      pinnedId: null,

      addPanel: () => {
        const { panels } = get();
        const alive = panels.filter((p) => p.status !== "exited").length;
        if (alive >= MAX_PANELS) return null;

        const id = crypto.randomUUID();
        const newPanel: Panel = {
          id,
          name: "새 패널",
          cli: "",
          path: "",
          options: "",
          status: "setup",
          hookConnected: null,
        };

        set((state) => ({
          panels: [...state.panels, newPanel],
          focusedId: id,
        }));

        return id;
      },

      removePanel: (id) => {
        set((state) => {
          const filtered = state.panels.filter((p) => p.id !== id);
          const newFocused =
            state.focusedId === id ? (filtered[filtered.length - 1]?.id ?? null) : state.focusedId;
          const newPinned = state.pinnedId === id ? null : state.pinnedId;
          return { panels: filtered, focusedId: newFocused, pinnedId: newPinned };
        });
      },

      setFocus: (id) => {
        set({ focusedId: id });
      },

      setPinned: (id) => {
        set({ pinnedId: id });
      },

      updatePanel: (id, updates) => {
        set((state) => ({
          panels: state.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      setStatus: (id, status) => {
        set((state) => ({
          panels: state.panels.map((p) => (p.id === id ? { ...p, status } : p)),
        }));
      },

      reorderPanels: (draggedId, dropTargetId) => {
        set((state) => {
          const ids = state.panels.map((p) => p.id);
          const newIds = reorderPanelIds(ids, draggedId, dropTargetId);
          const panelMap = new Map(state.panels.map((p) => [p.id, p]));
          return { panels: newIds.map((id) => panelMap.get(id)!) };
        });
      },
    }),
    {
      name: "deck-panels",
      partialize: (state) => ({
        panels: state.panels,
        focusedId: state.focusedId,
        pinnedId: state.pinnedId,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PanelStore> | undefined;
        if (!saved?.panels) return current;
        return {
          ...current,
          panels: saved.panels.map((p) => ({
            ...p,
            status: "setup" as const,
            hookConnected: null,
            exitCode: undefined,
          })),
          focusedId: saved.focusedId ?? null,
          pinnedId: saved.pinnedId ?? null,
        };
      },
    },
  ),
);
