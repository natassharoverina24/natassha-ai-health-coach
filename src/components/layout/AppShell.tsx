"use client";

import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

/**
 * Authenticated app frame: sidebar on md+, bottom tab bar on mobile, top
 * utility bar throughout. Every page under src/app/(app) renders inside
 * this shell via the route group layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-backdrop flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-8 lg:px-10">
          <TopBar />
          <main>{children}</main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
