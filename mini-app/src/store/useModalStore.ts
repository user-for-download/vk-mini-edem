import { create } from "zustand";
import type { Trip } from "@/types";

interface ModalStore {
  editTrip: Trip | null;
  setEditTrip: (trip: Trip | null) => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  editTrip: null,
  setEditTrip: (trip) => set({ editTrip: trip }),
}));
