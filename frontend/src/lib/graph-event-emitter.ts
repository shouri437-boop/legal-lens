/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// SUPERSEDED: Event emitter for the old knowledge-graph.tsx monolith.
// No longer used by the decomposed component system. Preserved for reference.
import { GraphEvent } from "@/types/knowledge-graph";

export class GraphEventEmitter {
  private listeners: Map<string, Set<(event: GraphEvent) => void>> = new Map();

  on(
    eventType: GraphEvent["type"],
    handler: (event: GraphEvent) => void,
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => this.off(eventType, handler);
  }

  off(
    eventType: GraphEvent["type"],
    handler: (event: GraphEvent) => void,
  ): void {
    this.listeners.get(eventType)?.delete(handler);
  }

  emit(event: GraphEvent): void {
    this.listeners.get(event.type)?.forEach((handler) => handler(event));
  }

  clear(): void {
    this.listeners.clear();
  }
}
