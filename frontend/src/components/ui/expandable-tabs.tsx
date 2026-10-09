// ABOUTME: Simplified tab navigation component with clean, snappy transitions.
// ABOUTME: Removed Framer Motion scale animations for better performance.

"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Tab {
  title: string;
  icon: LucideIcon;
  href: string;
  badge?: number;
  type?: never;
}

interface Separator {
  type: "separator";
  title?: never;
  icon?: never;
  href?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
  tabs: TabItem[];
  className?: string;
  activeColor?: string;
  activeTab?: string;
  onTabChange?: (href: string) => void;
}

export function ExpandableTabs({
  tabs,
  className,
  activeTab,
  onTabChange,
}: ExpandableTabsProps) {
  const handleSelect = (href: string) => {
    onTabChange?.(href);
  };

  const Separator = () => (
    <div className="mx-1 h-5 w-[1.2px] bg-border" aria-hidden="true" />
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 rounded-lg p-0.5",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        if (tab.type === "separator") {
          return <Separator key={`separator-${index}`} />;
        }

        const Icon = tab.icon;
        const isActive = activeTab === tab.href;

        return (
          <button
            key={tab.title}
            onClick={() => handleSelect(tab.href)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium cursor-pointer",
              "transition-colors duration-150",
              isActive
                ? "bg-white/15 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/8",
            )}
          >
            <Icon size={16} />
            <span>{tab.title}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-pulse">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
