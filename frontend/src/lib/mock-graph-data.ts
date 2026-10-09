/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// SUPERSEDED: Mock data no longer used. The useCaseGraph hook now fetches real data from the API.
// This file is preserved for reference but not imported anywhere.

import {
  Entity,
  Evidence,
  Relationship,
  GraphNode,
  GraphConnection,
} from "@/types/knowledge-graph";

export function generateMockGraphData() {
  // Mock entities
  const entities: Entity[] = [
    {
      id: "e1",
      type: "person",
      name: "John Doe",
      description: "CEO of Acme Corp",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    },
    {
      id: "e2",
      type: "person",
      name: "Jane Smith",
      description: "CFO of Acme Corp",
      createdAt: new Date("2024-01-16"),
      updatedAt: new Date("2024-01-16"),
    },
    {
      id: "e3",
      type: "organization",
      name: "Acme Corporation",
      description: "Shell company under investigation",
      createdAt: new Date("2024-01-10"),
      updatedAt: new Date("2024-01-10"),
    },
    {
      id: "e4",
      type: "location",
      name: "Cayman Islands",
      description: "Offshore banking location",
      createdAt: new Date("2024-01-12"),
      updatedAt: new Date("2024-01-12"),
    },
    {
      id: "e5",
      type: "event",
      name: "Wire Transfer",
      description: "$2.5M transfer on Jan 10, 2024",
      createdAt: new Date("2024-01-10"),
      updatedAt: new Date("2024-01-10"),
    },
    {
      id: "e6",
      type: "person",
      name: "Robert Chen",
      description: "Board Member",
      createdAt: new Date("2024-01-18"),
      updatedAt: new Date("2024-01-18"),
    },
    {
      id: "e7",
      type: "organization",
      name: "Offshore Holdings LLC",
      description: "Subsidiary company",
      createdAt: new Date("2024-01-11"),
      updatedAt: new Date("2024-01-11"),
    },
  ];

  // Mock evidence - now treated as nodes
  const evidence: Evidence[] = [
    {
      id: "ev1",
      type: "document",
      title: "Bank Statement Q4 2023",
      content: "Financial records showing suspicious transactions",
      createdAt: new Date("2024-01-20"),
    },
    {
      id: "ev2",
      type: "document",
      title: "Email Thread",
      content: "Internal communications regarding offshore accounts",
      createdAt: new Date("2024-01-21"),
    },
    {
      id: "ev3",
      type: "image",
      title: "Meeting Photo",
      url: "/evidence/meeting.jpg",
      metadata: { location: "Cayman Islands", date: "2024-01-15" },
      createdAt: new Date("2024-01-19"),
    },
    {
      id: "ev4",
      type: "document",
      title: "Wire Transfer Receipt",
      content: "Receipt for $2.5M transfer",
      createdAt: new Date("2024-01-10"),
    },
    {
      id: "ev5",
      type: "audio",
      title: "Board Meeting Recording",
      url: "/evidence/board-meeting.mp3",
      metadata: { duration: "45:30", date: "2024-01-18" },
      createdAt: new Date("2024-01-18"),
    },
  ];

  // Mock relationships - including evidence connections
  const relationships: Relationship[] = [
    {
      id: "r1",
      sourceEntityId: "e1",
      targetEntityId: "e3",
      type: "employment",
      label: "CEO of",
      strength: 0.9,
      createdAt: new Date("2024-01-15"),
    },
    {
      id: "r2",
      sourceEntityId: "e2",
      targetEntityId: "e3",
      type: "employment",
      label: "CFO of",
      strength: 0.9,
      createdAt: new Date("2024-01-16"),
    },
    {
      id: "r3",
      sourceEntityId: "e3",
      targetEntityId: "e4",
      type: "location",
      label: "Registered in",
      strength: 0.8,
      createdAt: new Date("2024-01-12"),
    },
    {
      id: "r4",
      sourceEntityId: "e1",
      targetEntityId: "e5",
      type: "transaction",
      label: "Authorized",
      strength: 0.7,
      createdAt: new Date("2024-01-10"),
    },
    {
      id: "r5",
      sourceEntityId: "e5",
      targetEntityId: "e4",
      type: "transaction",
      label: "Sent to",
      strength: 0.8,
      createdAt: new Date("2024-01-10"),
    },
    {
      id: "r6",
      sourceEntityId: "e6",
      targetEntityId: "e3",
      type: "governance",
      label: "Board member of",
      strength: 0.7,
      createdAt: new Date("2024-01-18"),
    },
    {
      id: "r7",
      sourceEntityId: "e3",
      targetEntityId: "e7",
      type: "ownership",
      label: "Owns",
      strength: 0.9,
      createdAt: new Date("2024-01-11"),
    },
    {
      id: "r8",
      sourceEntityId: "e7",
      targetEntityId: "e4",
      type: "location",
      label: "Based in",
      strength: 0.8,
      createdAt: new Date("2024-01-11"),
    },
    // Evidence relationships
    {
      id: "r9",
      sourceEntityId: "ev1",
      targetEntityId: "e3",
      type: "evidence",
      label: "Documents",
      strength: 0.9,
      createdAt: new Date("2024-01-20"),
    },
    {
      id: "r10",
      sourceEntityId: "ev1",
      targetEntityId: "e5",
      type: "evidence",
      label: "Shows",
      strength: 0.8,
      createdAt: new Date("2024-01-20"),
    },
    {
      id: "r11",
      sourceEntityId: "ev2",
      targetEntityId: "e1",
      type: "evidence",
      label: "From",
      strength: 0.7,
      createdAt: new Date("2024-01-21"),
    },
    {
      id: "r12",
      sourceEntityId: "ev2",
      targetEntityId: "e2",
      type: "evidence",
      label: "To",
      strength: 0.7,
      createdAt: new Date("2024-01-21"),
    },
    {
      id: "r13",
      sourceEntityId: "ev3",
      targetEntityId: "e4",
      type: "evidence",
      label: "Taken at",
      strength: 0.8,
      createdAt: new Date("2024-01-19"),
    },
    {
      id: "r14",
      sourceEntityId: "ev3",
      targetEntityId: "e1",
      type: "evidence",
      label: "Shows",
      strength: 0.6,
      createdAt: new Date("2024-01-19"),
    },
    {
      id: "r15",
      sourceEntityId: "ev4",
      targetEntityId: "e5",
      type: "evidence",
      label: "Proves",
      strength: 0.9,
      createdAt: new Date("2024-01-10"),
    },
    {
      id: "r16",
      sourceEntityId: "ev5",
      targetEntityId: "e6",
      type: "evidence",
      label: "Features",
      strength: 0.8,
      createdAt: new Date("2024-01-18"),
    },
    {
      id: "r17",
      sourceEntityId: "ev5",
      targetEntityId: "e3",
      type: "evidence",
      label: "About",
      strength: 0.7,
      createdAt: new Date("2024-01-18"),
    },
  ];

  // Convert to graph nodes - include evidence as nodes
  const nodes: GraphNode[] = [
    ...entities.map((entity) => ({
      id: entity.id,
      type: "entity" as const,
      data: entity,
      position: { x: 0, y: 0 }, // Will be set by force simulation
      isPinned: false,
    })),
    ...evidence.map((ev) => ({
      id: ev.id,
      type: "evidence" as const,
      data: ev,
      position: { x: 0, y: 0 },
      isPinned: false,
    })),
  ];

  // Convert to graph connections
  const connections: GraphConnection[] = relationships.map((rel) => ({
    id: rel.id,
    source: rel.sourceEntityId,
    target: rel.targetEntityId,
    relationship: rel,
  }));

  return { nodes, connections, entities, evidence, relationships };
}
