import { createStore } from "zustand";
import { persist, devtools } from "zustand/middleware";

export type GlobalStore = {
  navigatorOnline: boolean;
  showNavigation: boolean;
};

export const createGlobalStore = () => {
  return createStore<GlobalStore>()(
    devtools(
      persist(
        (set) => ({
          navigatorOnline: true,
          showNavigation: false,
          actions: {},
        }),
        {
          name: "global-storage",
          partialize: (state) => ({}),
          onRehydrateStorage: (state) => {
            if (state) {
            }
          },
        },
      ),
      { name: "GlobalStore" },
    ),
  );
};
