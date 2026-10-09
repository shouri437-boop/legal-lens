"use client";

import { Timeline } from "@/components/Timeline/Timeline";
import { useParams } from "next/navigation";

export default function TimelinePage() {
  const params = useParams();
  const caseId = params.id as string;

  return (
    <div className="min-h-screen bg-(--background)">
      <Timeline
        caseId={caseId}
        enableRealtimeUpdates={false}
        enableOfflineSupport={true}
      />
    </div>
  );
}
