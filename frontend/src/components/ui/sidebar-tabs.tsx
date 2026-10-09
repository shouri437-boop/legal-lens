// ABOUTME: Vertical tab navigation component optimized for sidebar display
// ABOUTME: Handles collapsed/expanded states with icon-only and icon+text layouts

"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Tooltip } from "@/components/ui/tooltip";

export interface SidebarTab {
  title: string;
  icon: LucideIcon;
  href: string; // relative path like "/command-center"
}

export interface SidebarTabsProps {
  tabs: SidebarTab[];
  activeTab: string; // current pathname segment
  basePath: string; // e.g., "/cases/123"
  collapsed: boolean;
}

export function SidebarTabs({
  tabs,
  activeTab,
  basePath,
  collapsed,
}: SidebarTabsProps) {
  const router = useRouter();

  const handleTabClick = (href: string) => {
    router.push(`${basePath}${href}`);
  };

  return (
    <div className="space-y-3 mt-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.href;

        return (
          <Tooltip
            key={tab.href}
            content={tab.title}
            position="right"
            disabled={!collapsed}
            className="w-full"
          >
            <button
              onClick={() => handleTabClick(tab.href)}
              data-active={isActive}
              className={clsx(
                "sidebar-tab-btn w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                "transition-colors duration-150",
                collapsed ? "justify-center" : "justify-start",
              )}
              aria-label={tab.title}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="text-sm whitespace-nowrap overflow-hidden">
                  {tab.title}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
      <style jsx global>{`
        .sidebar-tab-btn {
          background-color: transparent;
          color: var(--muted-foreground);
          font-weight: 400;
          position: relative;
        }

        .sidebar-tab-btn[data-active="true"] {
          background-color: var(--muted);
          color: var(--foreground);
          font-weight: 600;
        }

        .sidebar-tab-btn[data-active="false"]:hover {
          background-color: color-mix(in srgb, var(--muted) 50%, transparent);
          color: var(--foreground);
        }
      `}</style>
    </div>
  );
}
