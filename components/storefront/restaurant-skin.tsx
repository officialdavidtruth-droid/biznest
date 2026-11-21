"use client";
import { createContext, useContext, type ReactNode } from "react";

/** True when this storefront wears the shared restaurant look (sidebar, top bar, footer). Set once in the store layout so every page agrees. */
const Ctx = createContext(false);
export function RestaurantSkinProvider({ on, children }: { on: boolean; children: ReactNode }) {
  return <Ctx.Provider value={on}>{children}</Ctx.Provider>;
}
export function useRestaurantSkin() { return useContext(Ctx); }
