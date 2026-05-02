"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CabinetSidebar } from "@/components/cabinet/CabinetSidebar";

const sidebarStorageKey = "cabinet-sidebar-collapsed";

type CabinetShellProps = {
  children: ReactNode;
};

export function CabinetShell({ children }: CabinetShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(sidebarStorageKey) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(
      sidebarStorageKey,
      isSidebarCollapsed ? "true" : "false",
    );
  }, [isSidebarCollapsed]);

  return (
    <main className="min-h-screen bg-[#02030b] px-4 py-4 text-white sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <div
        className={[
          "mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1760px] gap-4 transition-[grid-template-columns] duration-300 ease-out",
          isSidebarCollapsed
            ? "md:grid-cols-[5.75rem_minmax(0,1fr)]"
            : "md:grid-cols-[18rem_minmax(0,1fr)]",
        ].join(" ")}
      >
        <div className="md:h-full">
          <CabinetSidebar
            collapsed={isSidebarCollapsed}
            onToggleCollapsed={() =>
              setIsSidebarCollapsed((currentValue) => !currentValue)
            }
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}
