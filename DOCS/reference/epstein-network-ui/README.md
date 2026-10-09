# Epstein Doc Explorer — Frontend Reference for Legal Lens Phase 7.2

**Source:** https://github.com/maxandrews/Epstein-doc-explorer/tree/main/network-ui
**Purpose:** Reference implementation for Legal Lens Knowledge Graph visualization (Phase 7.2)
**Adapt, don't copy:** Legal Lens has a different design system (Liquid Glass), different data model (curated KG entities vs raw actor-target relationships), and different scale (~15-50 nodes vs 19,000+ actors).

---

## Architecture Overview

```
network-ui/src/
  App.tsx              -- Main app: 3-panel layout, 15+ useState hooks, data fetching
  api.ts               -- REST API client (8 endpoints)
  types.ts             -- TypeScript types (Relationship, GraphNode, GraphLink, Stats)
  components/
    NetworkGraph.tsx    -- D3.js force-directed graph (SVG, 5 forces, radial layout)
    Sidebar.tsx         -- Left sidebar: filters, search, graph settings (320px)
    RightSidebar.tsx    -- Right sidebar: entity timeline + document excerpts (384px)
    DocumentModal.tsx   -- Full-text viewer with dual-term entity highlighting
    MobileBottomNav.tsx -- Mobile tabs
    WelcomeModal.tsx    -- First-visit onboarding
```

---

## Graph Library: Pure D3.js (v7.9.0)

Uses raw `d3.forceSimulation` inside React `useRef` + `useEffect`. NOT vis-network or react-force-graph (despite being in package.json — unused).

---

## Force Simulation — 5 Forces

```typescript
const simulation = d3.forceSimulation(graphData.nodes)
  .force('link', d3.forceLink(graphData.links)
    .id((d: any) => d.id)
    .distance(50))
  .force('charge', d3.forceManyBody().strength(-400))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius((d: any) => radiusScale(d.val) + 5))
  .force('radial', d3.forceRadial((d: any) => {
    return (50 - Math.min(d.val, 50)) * 33 + 200;
  }, width / 2, height / 2).strength(0.5));
```

| Force | Config | Purpose |
|-------|--------|---------|
| link | distance=50 | Connected nodes stay close |
| charge | strength=-400 | Repels all nodes |
| center | (width/2, height/2) | Gravitational anchor |
| collision | radius = sqrt-scaled size + 5px | Prevents overlap |
| radial | `(50 - min(val, 50)) * 33 + 200`, strength=0.5 | **Gravity well**: high-connection nodes → center, low → periphery |

### Radial Force Formula (adapt for Legal Lens)
- Epstein: `(50 - min(val, 50)) * 33 + 200` — maps connection count [0-50] to radius [200-1850px]
- Legal Lens adaptation: Use entity degree (connection count) from KG, but with smaller range since graphs are smaller

---

## Node Rendering: SVG Circles

```typescript
// Square-root scaling for node radius
const radiusScale = d3.scalePow()
  .exponent(0.5)        // Square root
  .domain([1, maxConnections])
  .range([5, 100])      // 5px min, 100px max
  .clamp(true);

// SVG group per node
node.append('circle')
  .attr('r', (d) => radiusScale(d.val))
  .attr('fill', (d) => d.color)
  .attr('stroke', '#fff')
  .attr('stroke-width', 1);

// Label below circle
node.append('text')
  .text((d) => d.name)
  .attr('y', (d) => radiusScale(d.val) * 1.5)
  .attr('text-anchor', 'middle')
  .attr('font-size', '5px');
```

### Legal Lens adaptation for node colors
Epstein uses BFS-from-central-node distance coloring (4 tiers: red → orange/yellow → purple → green).
Legal Lens should use **domain-based colors**: entity_type → color mapping from Liquid Glass palette.

---

## Edge Rendering

```typescript
const link = g.append('g')
  .selectAll('line')
  .data(graphData.links)
  .join('line')
  .attr('stroke', '#4b5563')    // Gray-600
  .attr('stroke-width', 2)
  .attr('stroke-opacity', 0.6);
```

Edge deduplication: Multiple relationships between same (actor, target) → single edge with `count`.
Selection highlighting: Epstein uses cyan (#06b6d4) for connected edges. **Legal Lens adaptation: use white for connected edges, dim unconnected edges.**

---

## Selection Highlighting (Separate useEffect)

Performance pattern: selection changes DON'T re-run the simulation. Uses stored D3 selection refs:

```typescript
// Stored refs from initial render
const nodeGroupRef = useRef<d3.Selection<...>>();
const linkGroupRef = useRef<d3.Selection<...>>();

// Separate effect for selection only
useEffect(() => {
  nodeGroupRef.current?.select('circle')
    .attr('fill', (d) => d.id === selectedActor ? '#06b6d4' : d.baseColor);
  linkGroupRef.current
    .attr('stroke', (d) => isConnected ? '#06b6d4' : '#4b5563')
    .attr('stroke-opacity', (d) => isConnected ? 1 : 0.6);
}, [selectedActor]);
```

---

## Density Threshold Filtering (Client-Side)

Per-hop-level relative pruning. At density 50%, nodes below half the average connections for their hop level are removed:

```typescript
// Calculate average connections per hop distance
const connectionsByHop = new Map<number, number[]>();
// ... group, compute averages

const densityThreshold = minDensity / 100;
for (const node of nodeMap.values()) {
  const avgForHop = averageByHop.get(hopDistance);
  if (node.val >= avgForHop * densityThreshold) {
    nodesToKeep.add(node.id);
  }
}
```

### Legal Lens adaptation
Replace "per-hop-level" with "per-entity-type" or "per-domain" averages. Legal Lens doesn't have a BFS from a central entity.

---

## Three-Panel Layout

```
Desktop (>= 1024px):
+------------------+-------------------------------+------------------+
|  Left Sidebar    |       NetworkGraph             | Right Sidebar    |
|  (Sidebar.tsx)   |       (D3 SVG Canvas)         | (RightSidebar)   |
|  w-80 (320px)    |       flex-1                   | w-96 (384px)     |
|  Always visible  |                                | Appears on       |
|                  |                                | entity select    |
+------------------+-------------------------------+------------------+
```

Bottom instruction bar: "Click nodes to explore relationships · Scroll to zoom · Drag to pan"

---

## Right Sidebar: Entity Timeline

When an entity (actor) is selected:
- Header: entity name, relationship count, close button
- Filter by related entity name (text input)
- Chronological list sorted by timestamp
- Each entry:
  - Date/year label
  - `Actor → action → Target` (selected entity highlighted in green, others in red)
  - Click to expand → source document metadata + summary
  - Click document → opens DocumentModal

---

## Document Excerpt Modal

- Full document text with dual-term highlighting:
  - Primary (selected entity): yellow (#fef08a) background
  - Secondary (related entity from relationship): orange (#fed7aa) background
- Right-side scroll position indicator showing match locations
- Smooth scroll navigation to matches
- Document metadata header (summary, category, date range)

---

## Data Types

```typescript
interface Relationship {
  id: number;
  doc_id: string;
  timestamp: string | null;
  actor: string;
  action: string;       // Semantic: "employed by", "met with", "paid"
  target: string;
  location: string | null;
  tags: string[];
}

interface GraphNode {
  id: string;
  name: string;
  val: number;           // Connection count (drives size + radial position)
  totalVal?: number;     // Pre-filter count
  color?: string;
  baseColor?: string;    // For reset after deselection
}

interface GraphLink {
  source: string;
  target: string;
  action: string;
  location?: string;
  timestamp?: string;
}
```

---

## Backend Pipeline (analysis_pipeline)

The Epstein backend uses:
- **Claude (Anthropic SDK)** for document analysis and entity/relationship extraction
- **RDF triples** schema: `(actor, action, target, timestamp, location, tags)` per document
- **SQLite** for storage (better-sqlite3)
- **LLM-based deduplication** (`dedupe_with_llm.ts`) — uses Claude to merge duplicate actors
- **Tag clustering** with embeddings (Qwen3 model) + Claude for cluster naming
- **Express API** server for frontend consumption

Key insight: The entire entity extraction AND relationship extraction is done by the **LLM in a single pass** per document. The LLM reads the document and outputs structured `(actor, action, target, timestamp, location, tags)` triples directly — no separate programmatic relationship-building step.

---

## Key Patterns to Adapt for Legal Lens Phase 7.2

| Pattern | Epstein | Legal Lens Adaptation |
|---------|---------|-------------------|
| Graph library | Raw D3.js | Keep D3.js (enhance existing) |
| Radial force | BFS from Epstein | Entity degree centrality |
| Node colors | Distance tiers | Domain-based (entity_type → color) |
| Node sizing | sqrt(connection count) | sqrt(degree) from KG |
| Layout | 3-panel (320 \| flex \| 384) | Same pattern but panels are LOCAL to KG canvas (not app-wide sidebar) |
| Right panel | Entity timeline | Entity relationship timeline + citation navigation index |
| Source viewer | Full text + dual highlighting | Multi-media source viewer (doc/video/audio/image) — coexists with right panel |
| Density filter | Per-hop-level pruning | Per-domain or global pruning |
| Edge dedup | count aggregation | Same — multiple rels → single edge |
| Selection perf | Separate useEffect + refs | Same pattern |
| Initial zoom | 0.15 (19K nodes) | 0.5-1.0 (15-50 nodes) |
| Data format | Flat Relationship[] | Structured {nodes, edges} from KG API |
