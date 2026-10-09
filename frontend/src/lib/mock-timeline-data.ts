import { TimelineEvent, TimelineApiResponse } from "@/types/timeline.types";

// Generate mock timeline events
export function generateMockTimelineEvents(caseId: string): TimelineEvent[] {
  const baseDate = new Date("2024-01-01");

  const events: TimelineEvent[] = [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      caseId,
      title: "Initial complaint filed",
      description:
        "Plaintiff filed formal complaint against defendant for breach of contract",
      date: new Date(
        baseDate.getTime() + 0 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "legal",
      sourceIds: ["doc-001", "doc-002"],
      entityIds: ["entity-001", "entity-002"],
      confidence: 0.95,
      isUserCorrected: true,
      metadata: {
        courtId: "COURT-2024-001",
        caseNumber: "2024-CV-12345",
      },
      createdAt: new Date(
        baseDate.getTime() + 0 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 0 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      caseId,
      title: "Contract signed between parties",
      description: "Original contract agreement signed on January 5, 2023",
      date: new Date(
        baseDate.getTime() + 5 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "evidence",
      sourceIds: ["doc-003"],
      entityIds: ["entity-001", "entity-003"],
      confidence: 0.98,
      isUserCorrected: true,
      metadata: {
        contractValue: "$500,000",
        duration: "24 months",
      },
      createdAt: new Date(
        baseDate.getTime() + 5 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 5 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      caseId,
      title: "First payment received",
      description: "Initial payment of $50,000 received from defendant",
      date: new Date(
        baseDate.getTime() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "evidence",
      sourceIds: ["doc-004", "doc-005"],
      entityIds: ["entity-002"],
      confidence: 0.92,
      isUserCorrected: false,
      metadata: {
        amount: "$50,000",
        paymentMethod: "wire transfer",
      },
      createdAt: new Date(
        baseDate.getTime() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440004",
      caseId,
      title: "Defendant requests contract modification",
      description:
        "Defendant submitted formal request to modify contract terms",
      date: new Date(
        baseDate.getTime() + 20 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "legal",
      sourceIds: ["doc-006"],
      entityIds: ["entity-002"],
      confidence: 0.88,
      isUserCorrected: false,
      metadata: {
        requestType: "modification",
        status: "pending",
      },
      createdAt: new Date(
        baseDate.getTime() + 20 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 20 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440005",
      caseId,
      title: "Strategy meeting scheduled",
      description:
        "Internal strategy meeting with legal team to discuss response",
      date: new Date(
        baseDate.getTime() + 22 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "strategy",
      sourceIds: ["doc-007"],
      entityIds: ["entity-004", "entity-005"],
      confidence: 0.85,
      isUserCorrected: true,
      metadata: {
        attendees: 5,
        duration: "2 hours",
      },
      createdAt: new Date(
        baseDate.getTime() + 22 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 22 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440006",
      caseId,
      title: "Plaintiff rejects modification request",
      description:
        "Plaintiff formally rejected the modification request from defendant",
      date: new Date(
        baseDate.getTime() + 25 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "legal",
      sourceIds: ["doc-008"],
      entityIds: ["entity-001"],
      confidence: 0.96,
      isUserCorrected: true,
      metadata: {
        reason: "Terms not favorable",
        nextStep: "litigation",
      },
      createdAt: new Date(
        baseDate.getTime() + 25 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 25 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440007",
      caseId,
      title: "Deposition scheduled",
      description: "Deposition of defendant scheduled for February 15, 2024",
      date: new Date(
        baseDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "legal",
      sourceIds: ["doc-009"],
      entityIds: ["entity-002"],
      confidence: 0.91,
      isUserCorrected: false,
      metadata: {
        date: "2024-02-15",
        location: "Virtual",
      },
      createdAt: new Date(
        baseDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440008",
      caseId,
      title: "Evidence collection completed",
      description:
        "All relevant documents and evidence collected from both parties",
      date: new Date(
        baseDate.getTime() + 35 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "evidence",
      sourceIds: ["doc-010", "doc-011", "doc-012"],
      entityIds: ["entity-001", "entity-002"],
      confidence: 0.94,
      isUserCorrected: true,
      metadata: {
        documentsCollected: 47,
        status: "complete",
      },
      createdAt: new Date(
        baseDate.getTime() + 35 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 35 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440009",
      caseId,
      title: "Settlement negotiation initiated",
      description: "Both parties agreed to enter settlement negotiations",
      date: new Date(
        baseDate.getTime() + 40 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "strategy",
      sourceIds: ["doc-013"],
      entityIds: ["entity-001", "entity-002"],
      confidence: 0.87,
      isUserCorrected: false,
      metadata: {
        mediator: "John Smith",
        venue: "Neutral location",
      },
      createdAt: new Date(
        baseDate.getTime() + 40 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 40 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440010",
      caseId,
      title: "Settlement agreement reached",
      description: "Both parties reached settlement agreement for $300,000",
      date: new Date(
        baseDate.getTime() + 50 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      layer: "legal",
      sourceIds: ["doc-014", "doc-015"],
      entityIds: ["entity-001", "entity-002"],
      confidence: 0.99,
      isUserCorrected: true,
      metadata: {
        settlementAmount: "$300,000",
        status: "signed",
      },
      createdAt: new Date(
        baseDate.getTime() + 50 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date(
        baseDate.getTime() + 50 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
  ];

  return events;
}

// Generate mock API response
export function generateMockTimelineResponse(
  caseId: string,
): TimelineApiResponse {
  const events = generateMockTimelineEvents(caseId);

  const dates = events.map((e) => new Date(e.date));
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

  const layerCounts = {
    evidence: events.filter((e) => e.layer === "evidence").length,
    legal: events.filter((e) => e.layer === "legal").length,
    strategy: events.filter((e) => e.layer === "strategy").length,
  };

  return {
    events,
    totalCount: events.length,
    dateRange: {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
    },
    layerCounts,
    pagination: {
      limit: 50,
      offset: 0,
      hasMore: false,
    },
  };
}
