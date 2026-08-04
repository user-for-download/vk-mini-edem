// mini-app/src/store/useSnackbarStore.ts
import { create } from "zustand";

export type SnackbarType = "success" | "error" | "info";

export interface SnackbarItem {
  type: SnackbarType;
  title: string;
  subtitle?: string;
  dedupeKey?: string;
}

interface SnackbarState {
  current: SnackbarItem | null;
  enqueue: (item: SnackbarItem) => void;
  dismiss: () => void;
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  current: null,
  enqueue: (item) => {
    set({ current: item });
    // Автозакрытие через 4 секунды
    setTimeout(() => {
      set((state) => {
        if (state.current === item) {
          return { current: null };
        }
        return state;
      });
    }, 4000);
  },
  dismiss: () => set({ current: null }),
}));
