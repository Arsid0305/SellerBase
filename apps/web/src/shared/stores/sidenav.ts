import { create } from 'zustand';

type SidenavState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
};

export const useSidenavStore = create<SidenavState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));
