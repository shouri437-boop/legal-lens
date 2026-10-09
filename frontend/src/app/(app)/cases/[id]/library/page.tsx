"use client";

import { useParams } from "next/navigation";
import { CaseLibrary } from "@/components/library";

export default function LibraryPage() {
  const params = useParams();
  const caseId = params.id as string;

  return <CaseLibrary caseId={caseId} />;
}
