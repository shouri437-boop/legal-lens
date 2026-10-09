// ABOUTME: Case-aware navigation section for sidebar
// ABOUTME: Self-detects case context and renders case-specific navigation

"use client";

import { usePathname, useParams } from "next/navigation";
import {
  FileSearch,
  Scale,
  Network,
  FolderOpen,
  Clock,
  MapPin,
} from "lucide-react";
import { SidebarTabs } from "@/components/ui/sidebar-tabs";

interface CaseNavSectionProps {
  collapsed: boolean;
}

const caseTabs = [
  { title: "Analysis", icon: FileSearch, href: "/analysis" },
  { title: "Review", icon: Scale, href: "/review" },
  { title: "Evidence", icon: FolderOpen, href: "/library" },
  { title: "Timeline", icon: Clock, href: "/timeline" },
  { title: "Map", icon: MapPin, href: "/geospatial" },
  { title: "Knowledge Graph", icon: Network, href: "/knowledge-graph" },
];

export function CaseNavSection({ collapsed }: CaseNavSectionProps) {
  const pathname = usePathname();
  const params = useParams();

  // Detect if we're on a case route
  const caseId = params?.id as string | undefined;
  const isOnCaseRoute = pathname?.startsWith("/cases/") && caseId;

  // Return null if not on a case route
  if (!isOnCaseRoute) {
    return null;
  }

  // Get active tab from pathname
  const pathSegments = pathname.split("/");
  const currentSection = pathSegments[pathSegments.length - 1] || "analysis";
  const activeTab = `/${currentSection}`;
  const basePath = `/cases/${caseId}`;

  return (
    <>
      {/* Section divider */}
      <div
        className="my-2 mx-2"
        style={{ borderTop: "1px solid var(--border)" }}
      />

      {/* Case tabs */}
      <div className="px-2">
        <SidebarTabs
          tabs={caseTabs}
          activeTab={activeTab}
          basePath={basePath}
          collapsed={collapsed}
        />
      </div>
    </>
  );
}
