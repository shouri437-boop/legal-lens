// ABOUTME: Cases list page
// ABOUTME: Shows all user's cases with create/delete actions

"use client";

import { useEffect } from "react";
import { CaseList } from "@/components/app/case-list";

export default function CasesPage() {
  useEffect(() => {
    console.log("📋 [CASES PAGE] Component mounted", {
      timestamp: new Date().toISOString(),
      pathname: window.location.pathname,
    });
  }, []);

  console.log("📋 [CASES PAGE] Rendering");

  return (
    <div className="p-6 lg:p-8">
      <CaseList />
    </div>
  );
}
