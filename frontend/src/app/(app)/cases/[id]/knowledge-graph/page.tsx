"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { KnowledgeGraphCanvas } from "@/components/knowledge-graph/KnowledgeGraphCanvas";
import { useCaseGraph } from "@/hooks/use-case-graph";

export default function KnowledgeGraphPage() {
  const params = useParams();
  const { data, loading, error } = useCaseGraph(params.id as string);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-stone" />
        <p className="ml-3 text-sm text-stone">Loading knowledge graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500 text-sm">
          Error loading graph: {error.message}
        </p>
      </div>
    );
  }

  if (!data || data.entity_count === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-smoke text-lg font-medium mb-2">
          No Knowledge Graph Data
        </p>
        <p className="text-stone text-sm max-w-md">
          Run the analysis pipeline from the Command Center to generate the
          knowledge graph.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <KnowledgeGraphCanvas
        caseId={params.id as string}
        entities={data.entities}
        relationships={data.relationships}
      />
    </div>
  );
}
