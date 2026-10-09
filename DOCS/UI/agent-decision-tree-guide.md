# Agent Decision Tree View - Replication Guide

A guide for replicating the interactive agent decision tree visualization as a standalone React component.

---

## Libraries Required

| Library | Purpose |
|---------|---------|
| `@xyflow/react` | Core graph/flow rendering (nodes, edges, panning, zooming) |
| `dagre` | Automatic graph layout (hierarchical tree positioning) |
| `motion` (earlier called framer-motion) | Node animations (entrance, hover, pulse, floating) |
| `react-icons` / `lucide-react` | Icons for UI elements |
| `tailwindcss` | Utility-first styling |
| `@radix-ui/react-collapsible` | Collapsible sections in sidebar (optional) |

---

## Data Model

The tree is recursive. Each node has a map of child nodes keyed by option name.

```typescript
type DecisionTreeNode = {
  name: string;        // Display label
  id: string;          // Unique identifier
  description: string; // Detailed description
  instruction: string; // Instructions for the agent at this node
  reasoning: string;   // Why this path was chosen
  branch: boolean;     // Whether this is a branching node
  options: { [key: string]: DecisionTreeNode }; // Child nodes (recursive)

  // Frontend-only state (not from backend)
  chosen?: boolean;   // Whether this node is on the chosen path
  blocked?: boolean;   // Whether this node is blocked from selection
};
```

### Supporting Types

```typescript
// Payload when initializing a tree from API
type DecisionTreePayload = {
  conversation_id: string;
  tree: DecisionTreeNode | null;
  error?: string | null;
};

// Payload for real-time tree updates (via WebSocket)
type TreeUpdatePayload = {
  node: string;       // ID of the parent node being updated
  decision: string;   // Key of the chosen child option
  tree_index: number; // Which tree in the array is being updated
  reasoning: string;  // Why this decision was made
  reset: boolean;     // Whether to reset sub-tree options
};
```

---

## Architecture Overview

```
API (fetch tree) ──► State Manager (store tree[]) ──► FlowDisplay
                                                        ├── ReactFlow canvas
WebSocket ──► State Manager (apply TreeUpdatePayload)   ├── DecisionNode (per node)
                                                        └── NodeDetailsSidebar
```

The component accepts an array of `DecisionTreeNode[]` — each element represents a separate tree (one per query in a multi-turn conversation). Trees are laid out vertically and connected via inter-tree edges.

---

## Component Breakdown

### 1. FlowDisplay (Main Container)

**Props:** `{ currentTrees: DecisionTreeNode[] }`

**Responsibilities:**
- Converts `DecisionTreeNode[]` into React Flow `Node[]` and `Edge[]`
- Applies dagre layout for automatic positioning
- Manages sidebar open/close state
- Connects multiple trees with inter-tree edges

**Key logic — Tree to React Flow conversion:**

```typescript
const createNodesEdges = (tree: DecisionTreeNode, treeIndex: number) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let idCounter = 0;
  const getId = () => `node-${idCounter++}-${treeIndex}`;
  const nodeMap = new Map<string, string>(); // original ID → react-flow ID

  const traverse = (node: DecisionTreeNode, parentId: string | null = null) => {
    const nodeId = getId();
    nodeMap.set(node.id, nodeId);

    nodes.push({
      id: nodeId,
      type: "decision",
      data: {
        text: node.name,
        description: node.description,
        choosen: node.choosen,
        instruction: node.instruction,
        reasoning: node.reasoning,
        originalId: node.id,
      },
      position: { x: 0, y: 0 }, // dagre will set this
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        animated: node.choosen, // animate the chosen path
        style: node.choosen
          ? { stroke: "hsl(var(--accent))", strokeWidth: 3,
              filter: "drop-shadow(0 0 6px hsl(var(--accent) / 0.6))" }
          : { stroke: "hsl(var(--secondary) / 0.3)", strokeWidth: 1 },
      });
    }

    if (node.options) {
      Object.keys(node.options).forEach((key) => traverse(node.options[key], nodeId));
    }
  };

  traverse(tree);
  return getLayoutedElements(nodes, edges); // apply dagre
};
```

**Dagre layout configuration:**

```typescript
const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
const nodeWidth = 300;
const nodeHeight = 100;

dagreGraph.setGraph({
  rankdir: "TB",     // top-to-bottom
  ranksep: 120,      // vertical spacing between ranks
  nodesep: 150,      // horizontal spacing between nodes
});

// Set each node, run dagre.layout(), then center each node at its computed position
```

**Multi-tree layout:**
Each tree is offset vertically with organic horizontal variation. Trees alternate left/right with slight angle variations for a natural look. Leaf of tree N connects to root of tree N+1 via a dashed, animated, highlighted inter-tree edge.

**ReactFlow configuration:**

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={{ decision: DecisionNode }}
  connectionLineType={ConnectionLineType.SmoothStep}
  nodesDraggable={false}
  panOnDrag={true}
  zoomOnScroll={true}
  minZoom={0.1}
  maxZoom={2}
  onInit={setReactFlowInstance}
>
  <Background gap={20} size={2} color="hsl(var(--foreground))" />
</ReactFlow>
```

After nodes render, auto-fit viewport:
```typescript
reactFlowInstance.fitView({ duration: 1500, minZoom: 0.1, maxZoom: 1, padding: 0.2 });
```

**Wrap the parent page in `<ReactFlowProvider>`.**

---

### 2. DecisionNode (Custom Node Component)

Registered as `nodeTypes={{ decision: DecisionNode }}` in ReactFlow.

**Node data shape:**

```typescript
{ text: string; description?: string; instruction?: string;
  reasoning?: string; choosen?: boolean; originalId?: string; }
```

**Animations (Framer Motion):**

| Animation | Trigger | Values |
|-----------|---------|--------|
| Entrance | Mount | `scale: 0.9→1, opacity: 0→1` over 0.5s easeOut |
| Floating | `choosen === true` | `y: [0, -2, 0]` infinite, 2s easeInOut |
| Hover | Mouse enter | `scale: 1.05, y: -8` |
| Tap | Click | `scale: 0.98` |
| Pulse border | `choosen === true` | `scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5]` infinite |
| Text glow | `choosen === true` | `textShadow` cycles between glow intensities |

**Styling rules:**

| State | Background | Text | Border |
|-------|-----------|------|--------|
| Chosen | `accent/25 → accent/10` gradient | `accent` | `2px solid accent`, glow shadow |
| Default | `background_alt/70` | `secondary/60` | `1px solid secondary/30` |
| Hovered (default) | `background_alt/90` | `secondary/80` | `secondary/60` |
| Selected (clicked) | Adds `ring-4 ring-highlight` | — | — |

**Tooltip:** On hover, a portal-rendered tooltip appears above the node saying "Click for more details". Positioned via `getBoundingClientRect()`.

**Handles:** React Flow `<Handle>` components at `Position.Top` (target) and `Position.Bottom` (source) for edge connections. Styled accent for chosen, muted for default.

---

### 3. NodeDetailsSidebar

A right-sliding panel that appears when a node is clicked.

**Props:** `{ isOpen: boolean; nodeData: NodeData | null; onClose: () => void }`

**Animation:**
```tsx
<AnimatePresence>
  <motion.div
    initial={{ x: "100%" }}
    animate={{ x: 0 }}
    exit={{ x: "100%" }}
    transition={{ type: "spring", damping: 20, stiffness: 300 }}
    className="fixed right-0 top-0 h-full w-96"
  />
</AnimatePresence>
```

**Content sections** (each color-coded, shown only if data exists):

| Section | Color token | Background |
|---------|------------|------------|
| Reasoning | `alt_color_a` | `alt_color_a/5` bg, `alt_color_a/20` border |
| Description | `accent` | `accent/5` bg, `accent/20` border |
| Instructions | `highlight` | `highlight/5` bg, `highlight/20` border |
| Metadata (ID) | `secondary` | `secondary/5` bg, `secondary/20` border |

Shows a "Selected Path" badge when `choosen === true`.

---

## Tree State Management

### Initialization

1. Fetch tree from backend: `POST /init/tree/{user_id}/{conversation_id}`
2. Reset all `choosen` and `blocked` flags to `false` recursively
3. Set root node `choosen = true`
4. Store as `base_tree` and push a copy into `tree[]` array

### Real-time Updates (WebSocket `tree_update` messages)

When a `TreeUpdatePayload` arrives:

```typescript
const findAndUpdateNode = (tree, base_tree, payload) => {
  // Recursively find node where tree.id === payload.node and !tree.blocked
  // In that node's options, set options[payload.decision].choosen = true
  // Set options[payload.decision].reasoning = payload.reasoning
  // If payload.reset, replace that option's sub-tree with base_tree
  // All sibling options remain unchanged (unchosen)
};
```

### Multi-query flow

Each new user query:
1. `addTreeToConversation()` — push a fresh copy of `base_tree` into `tree[]`
2. `changeBaseToQuery()` — rename the latest tree's root to the query text
3. Tree updates apply to `tree[payload.tree_index]`

---

## Color System (CSS Variables)

Define these HSL variables on `:root` and reference via Tailwind:

```css
:root {
  --background: 0 0% 9%;
  --background_alt: 0 0% 14%;
  --foreground: 0 0% 18%;
  --primary: 0 0% 95%;
  --secondary: 0 0% 50%;
  --accent: 37 97% 52%;       /* Primary highlight — chosen path */
  --highlight: 220 50% 35%;   /* Selection ring, inter-tree edges */
  --alt_color_a: 37 90% 68%;  /* Reasoning section */
  --border: 0 0% 31%;
}
```

In `tailwind.config.ts`, map these to color names:
```typescript
colors: {
  background: "hsl(var(--background))",
  accent: "hsl(var(--accent))",
  highlight: "hsl(var(--highlight))",
  secondary: "hsl(var(--secondary))",
  // ... etc
}
```

---

## Visual Specification (Pixel-Level Reference)

This section describes the exact visual output to reproduce. Use it alongside the code patterns above.

### Canvas

- **Background color**: Near-black (`hsl(0 0% 9%)` / ~`#171717`)
- **Dot grid**: React Flow's `<Background>` component — dots spaced `20px` apart, dot size `2px`, color matches `--foreground` (`hsl(0 0% 18%)` / ~`#2E2E2E`). Subtle — barely visible, gives depth without distraction.
- **Full viewport**: The canvas fills `100vw x 100vh`.

### Node Appearance

All nodes are **300px wide, 100px tall**, with `rounded-lg` corners (~8px radius). Text is bold, `text-lg` (~18px), truncated with ellipsis if overflow.

**Chosen nodes** (on the active decision path):
- Background: Gradient `from-accent/25 to-accent/10` — translucent green/amber tint over the dark canvas
- Border: `2px solid` in accent color (~`hsl(37 97% 52%)`, a warm amber-green)
- Text: Accent color, with a cycling `textShadow` glow (`0 0 5px → 0 0 10px → 0 0 5px`, infinite)
- Box shadow: `0 0 20px rgba(accent / 0.3)` — soft outward glow
- Subtle floating animation: `y: [0, -2px, 0]` on a 2-second loop
- Pulsing border overlay: An absolutely-positioned inner `div` that scales `[1, 1.05, 1]` with fading opacity, creating a breathing border pulse

**Unchosen nodes** (sibling options not taken):
- Background: `background_alt/70` (~`hsl(0 0% 14% / 0.7)`) — dark gray, slightly lighter than canvas
- Border: `1px solid secondary/30` (~`hsl(0 0% 50% / 0.3)`) — faint gray outline
- Text: `secondary/60` (~`hsl(0 0% 50% / 0.6)`) — muted gray
- No shadow, no glow, no animation
- On hover: background brightens to `background_alt/90`, border to `secondary/60`, text to `secondary/80`, adds `shadow-lg`

**Root node of each tree** displays the user's query text (e.g., "Hey, weather in munich"). It follows chosen-node styling since the root is always marked chosen.

### Edge Appearance

**Chosen-path edges** (parent→chosen child):
- Type: `smoothstep` (rounded right-angle connectors)
- Stroke: Accent color, `3px` wide
- `animated: true` — React Flow adds moving dashed dots along the edge
- Drop shadow filter: `drop-shadow(0 0 6px accent/0.6)` — glowing trail

**Unchosen edges** (parent→unchosen children):
- Stroke: `secondary/30` (~gray at 30% opacity), `1px` wide
- No animation, no shadow
- Appear as faint static lines

**Inter-tree connector** (leaf of tree N → root of tree N+1):
- Stroke: Highlight color (`hsl(220 50% 35%)` — muted blue), `5px` wide
- Dashed: `strokeDasharray: "8,4"`
- `animated: true` — moving dashes
- Double drop-shadow glow: `12px` and `24px` at decreasing opacity
- Label badge: "Query N" in highlight color, bold 14px, with text glow. Badge background is `--background` at 90% opacity with highlight-color border and its own drop shadow.

### Layout Geometry

**Single tree**: Dagre arranges nodes top-to-bottom. Root centered at top, children fanned out horizontally below with `150px` horizontal gaps and `120px` vertical rank separation. Produces the classic org-chart shape.

**Multiple trees**: Each subsequent tree is offset both vertically and horizontally:
- Vertical: Previous tree height + `400px` base gap + `50px * treeIndex` (increasing spacing)
- Horizontal: Trees alternate left/right of center using `sin(index * 0.5) * 800px`, plus small organic offsets via `cos/sin` to avoid rigid alignment
- A slight angle (`±0.3 radians`) is applied based on depth, making branches lean naturally rather than being perfectly vertical

The viewport auto-fits all trees with a 1.5s smooth animation, `0.2` padding ratio, clamped between `0.1x` and `1x` zoom.

### Tooltip

When hovering any node, a tooltip appears **above** the node:
- Content: "Click for more details"
- Styling: `bg-background/95` with `backdrop-blur-sm`, `text-sm`, `rounded-lg`, `shadow-2xl`, `border border-foreground/50`
- Positioned via `getBoundingClientRect()` — centered horizontally on the node, `50px` above the top edge
- Has a small CSS triangle arrow pointing down (6px border trick in foreground/50 color)
- Rendered via `ReactDOM.createPortal` to `document.body` to escape React Flow's transform context
- `pointerEvents: none` — doesn't interfere with node clicks

### Interaction States

| Action | Result |
|--------|--------|
| Hover node | Scale 1.05, lift -8px, tooltip appears, border/text brighten |
| Click node | Sidebar slides in from right (spring animation), node gets `ring-4 ring-highlight` |
| Pan canvas | Click-drag on empty space |
| Zoom | Scroll wheel, clamped `0.1x – 2x` |
| Nodes are not draggable | `nodesDraggable={false}` |

---

## Minimal Standalone Setup

To use this as a standalone component in a new project:

1. **Install dependencies:**
   ```bash
   npm install @xyflow/react dagre framer-motion react-icons
   npm install -D @types/dagre
   ```

2. **Import the React Flow CSS:**
   ```typescript
   import "@xyflow/react/dist/style.css";
   ```

3. **Create these files:**
   - `DecisionNode.tsx` — custom node component
   - `NodeDetailsSidebar.tsx` — detail panel
   - `FlowDisplay.tsx` — main container
   - `types.ts` — `DecisionTreeNode` and payload types

4. **Wire up data:**
   - Feed `DecisionTreeNode[]` to `<FlowDisplay currentTrees={trees} />`
   - Wrap in `<ReactFlowProvider>` at the parent level
   - Manage tree state in your own context/store — apply `TreeUpdatePayload` to mutate the chosen path

5. **Customize:** Swap color variables, adjust dagre spacing, and modify animations to match your project's design system.
