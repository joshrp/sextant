# Onboarding & Annotation Nodes — Task List

> Reference: [ONBOARDING_FEATURE_PLAN.md](../ONBOARDING_FEATURE_PLAN.md)

## Dependency Graph

```
T1 (type system) ─┬─► T2 (view component) ─► T3 (edit dialog) ─► T5 (creation UX)
                   │                                                      │
                   ├─► T4 (solver exclusion)                              ▼
                   │                                              T6 (import/export)
                   │                                                      │
                   └──────────────────────────────────────────────────────►│
                                                                          ▼
T7 (empty state component) ─► T8 (canvas empty state) ─► T9 (sidebar empty states)
                                                                          │
                                                                          ▼
                                                          T10 (template factory) ◄── USER INPUT NEEDED
                                                                          │
                                                                          ▼
                                                          T11 (first-visit logic)
                                                                          │
                                                                          ▼
                                                          T12 (polish & fixtures)
```

---

## T1 — Annotation node data type

**Depends on:** Nothing  
**Blocks:** T2, T4, T6  
**User input:** None

### Goal
Add a new node data type for annotations to the existing type system. Currently all nodes share a base type (`NodeBaseData`) with a discriminated union on `type` field (`"recipe" | "balancer" | "settlement"`). The annotation type must join this union.

### What
- Register a **new React Flow node type** `"annotation-node"` in the `nodeTypes` map (alongside the existing `"recipe-node"`). This is the `node.type` field that React Flow uses to pick which component renders — it is **not** a new variant of `node.data.type` (which is the `"recipe" | "balancer" | "settlement"` discriminator inside `RecipeNode`)
- Define `AnnotationNodeData` — needs at minimum: `text: string`, and optionally a `width`/`height` or layout hint. It does **not** need `recipeId`, `solution`, `ltr`, or handle-related fields
- Define a new `AnnotationNode` type alias: `Node<AnnotationNodeData, "annotation-node">`
- Update `CustomNodeType` to be a union: `RecipeNodeType | AnnotationNodeType`
- The existing `RecipeNode` component and its `data.type` dispatcher are **not touched** — annotation is a completely separate component tree

### Acceptance
- TypeScript compiles with the new type in the union
- No runtime changes yet — this is type-level only

---

## T2 — Annotation node view component

**Depends on:** T1  
**Blocks:** T3, T5  
**User input:** None

### Goal
Build the React Flow node component that renders an annotation. It should be visually distinct from recipe nodes — different shape, border, or background color to avoid confusion. It renders markdown text as read-only content.

### What
- Create a new React Flow node component registered under its own node type key (e.g., `"annotation-node"`)
- Render markdown content using `react-markdown` (standard markdown, not MDX)
- No handles — annotation nodes don't participate in connections
- Visually distinct from recipe nodes — consider a different border style, subtle background, or a "note" aesthetic
- Must be selectable, moveable, and deleteable via standard React Flow interactions
- Respect zoom level scaling like other nodes (the codebase uses `data-zoomlevel` attributes)
- Register the new node type in the `nodeTypes` map alongside `"recipe-node"`

### Acceptance
- An annotation node can be rendered on the canvas with markdown text
- It can be dragged, selected, and deleted
- It has no connection handles
- It is visually distinguishable from recipe/balancer/settlement nodes

---

## T3 — Annotation edit dialog

**Depends on:** T2  
**Blocks:** T5  
**User input:** None

### Goal
Users need to edit annotation text. This should use a modal dialog (consistent with the existing dialog pattern in the app) with a textarea and a live or side-by-side markdown preview.

### What
- Build an edit dialog for annotation nodes — opens on double-click or an edit button on the node
- The dialog should have a textarea for raw markdown input and render a preview of the result
- On save, update the node's `text` field in the store via the existing `setNodeData` action
- On cancel, discard changes
- Reuse the existing `Dialog` component pattern from the codebase

### Acceptance
- Double-clicking (or clicking edit on) an annotation node opens the edit dialog
- User can modify text and see a preview
- Save persists the change, cancel discards it
- The rendered node updates to reflect the new text

---

## T4 — Exclude annotation nodes from solver

**Depends on:** T1  
**Blocks:** T6  
**User input:** None

### Goal
The solver builds a graph model from nodes and edges, then runs HiGHS to optimize. Annotation nodes must be invisible to this process — they have no recipe, no handles, no production meaning.

### What
- The graph model builder, solver input generation, and any node iteration that feeds the solver must **filter by React Flow node type** — only include nodes where `node.type === "recipe-node"`. Since annotation nodes have `node.type === "annotation-node"`, they are excluded by this check. Do **not** filter on `node.data.type` (that's the recipe/balancer/settlement discriminator within recipe-node)
- The `graphUpdateAction` in the store must not include annotation nodes when constructing the `GraphModel`
- Node count, machine calculations, etc. should exclude annotations
- The `onConnect` handler should not allow connections to/from annotation nodes (this should already be handled by having no handles, but verify)

### Acceptance
- Adding/removing annotation nodes does not trigger a re-solve
- Annotation nodes don't appear in the graph model or solver input
- No errors when annotation nodes coexist with recipe nodes in a factory

---

## T5 — Annotation node creation UX

**Depends on:** T2, T3  
**Blocks:** T6  
**User input:** None

### Goal
Users need multiple ways to create annotation nodes: a toolbar/controls button and double-clicking empty canvas space. The creation should open the edit dialog immediately so users can enter text.

### What
- Add an "Add Note" button to the factory controls area or toolbar
- Implement double-click on empty canvas to create an annotation at the click position
- Both methods should create the node and immediately open the edit dialog (T3)
- Smart positioning: toolbar button places the node in the visible viewport area (similar to existing node positioning logic); double-click uses the click coordinates
- Default text can be empty or a placeholder like "Double-click to edit"

### Acceptance
- Users can create annotation nodes from the toolbar
- Users can create annotation nodes by double-clicking empty canvas
- The edit dialog opens immediately on creation
- Nodes appear at sensible positions

---

## T6 — Annotation nodes in import/export

**Depends on:** T1, T4  
**Blocks:** T10  
**User input:** None

### Goal
Annotation nodes must survive import/export so template factories (and user-shared factories) can include them. The existing import/export uses a versioned minified tuple format.

### What
- Add `"annotation-node"` to the `NodeTypes` short code map (this maps **React Flow node types** to short codes, e.g., `"annotation-node": "a"`). This is separate from the `DataTypes` map which handles the `data.type` discriminator within recipe-node — annotation nodes don't use `DataTypes` at all since they have no `data.type` field
- Define the serialized tuple format for annotation nodes — it differs from recipe nodes because it has `text` instead of `recipeId`. This likely requires a new export version (V4) or a branching format within V3
- Handle import: reconstruct `AnnotationNodeData` from the minified tuple
- Handle export: serialize annotation nodes including their text content
- Text content may need encoding considerations (it can contain any characters, including the delimiter characters used in minification)

### Acceptance
- A factory with annotation nodes can be exported and re-imported with text preserved
- Backward compatibility: importing older formats (V3) still works
- Round-trip test: export → import → export produces identical output

---

## T7 — Empty state card component

**Depends on:** Nothing (can run in parallel with T1-T6)  
**Blocks:** T8, T9  
**User input:** None

### Goal
Build a shared, reusable component for empty state hints. Card-style callout — light background, optional icon, text. Consistent styling used everywhere.

### What
- A single `EmptyStateCard` component with props: `icon` (optional), `text` (string or ReactNode), `action` (optional button with label + onClick)
- Card styling: light background, subtle border, centered within its container. Should feel like a hint, not a modal or alert
- Should work in both the main canvas area (absolutely positioned center) and in sidebar sections (inline within the section)
- Match the app's existing theme/color system

### Acceptance
- Renders a styled card with text content
- Accepts optional icon and action button
- Looks appropriate in both wide (canvas) and narrow (sidebar) contexts

---

## T8 — Graph canvas empty state

**Depends on:** T7  
**Blocks:** T10  
**User input:** None

### Goal
When the factory graph has no nodes, display a centered prompt on the canvas directing the user to add a goal from the sidebar. This is the highest-impact empty state — it's the first thing a new user sees.

### What
- Detect when the graph has zero nodes (or zero non-annotation nodes, if you want to be precise)
- Render an `EmptyStateCard` centered on the React Flow canvas
- Text along the lines of: "Add a production goal from the sidebar to start building"
- The hint should disappear as soon as any node exists
- Should not interfere with React Flow interactions (panning, zooming)

### Acceptance
- Empty factory shows the hint centered on canvas
- Adding a node makes it disappear
- Panning/zooming still work with the hint visible

---

## T9 — Sidebar section empty states

**Depends on:** T7  
**Blocks:** T10  
**User input:** None

### Goal
Add empty state hints to all sidebar sections, zone sidebar, and factory tabs. Also handle the solve button state for empty graphs.

### What

Each surface gets an `EmptyStateCard` when its content is empty:

| Surface | Condition | Hint |
|---|---|---|
| Goals section | No goals | "What do you want to produce? Click + to set a target" |
| By-products | No by-products | "By-products appear here once you add recipes" |
| Inputs section | No inputs | "Required inputs will show here after adding recipes" |
| Infrastructure | No infra data | "Power, workers, and maintenance costs appear after solving" |
| Zone sidebar | Only default zone | "Organize production into zones — one per area of your island" |
| Factory tabs | Only one factory | "Create factories within a zone to plan different production lines" |
| Solve button | Empty graph | Disabled with tooltip: "Add goals and recipes first" |

### Acceptance
- Each surface shows its hint when empty and hides it when populated
- No global state tracking — each component checks its own content
- Solve button is disabled/dimmed for empty graphs

---

## T10 — Template factory content

**Depends on:** T6, T8, T9  
**Blocks:** T11  
**User input:** ⚠️ **YES — User builds and exports the factory**

### Goal
Create the example factory that ships with the app for first-time users. This is a branching production chain (3-5 recipe nodes) with annotation nodes explaining the UI.

### What the user provides
- Build the factory manually in the running app: select recipes, position nodes, connect edges, set goals, solve
- Add annotation nodes with guide text positioned next to relevant UI elements/nodes explaining:
  - What Goals are and how to add them
  - How recipe nodes work and how to add more
  - What the solve button does
  - How to read the sidebar
  - How to create a new factory for their own use
- Export the factory as a base85 string using the existing export feature

### What the agent does
- Embed the export string as a constant in the codebase (e.g., `app/onboarding/templateFactory.ts`)
- Add a function that imports the string using the existing import infrastructure
- Verify the import round-trips correctly

### Acceptance
- The export string imports into a clean app and produces a solved factory with annotation nodes
- Import round-trip test passes

---

## T11 — First-visit detection and template loading

**Depends on:** T10  
**Blocks:** T12  
**User input:** None

### Goal
On the very first app visit, automatically load the template factory into the default zone. On subsequent visits, don't.

### What
- Add a `hasCompletedFirstVisit: boolean` flag to the planner store (persisted in IndexedDB)
- During initial hydration in `PlannerProvider`, check the flag
- If `false` (or absent): import the template factory into the default zone, create an empty "My Factory" alongside it, set the flag to `true`
- If `true`: do nothing, normal startup
- The flag should persist across sessions via the existing IndexedDB persistence

### Acceptance
- Fresh app (no IndexedDB data): template factory loads automatically
- Second visit: template does not reload
- User can delete the template factory — it does not come back
- Cleared IndexedDB: treated as first visit again (flag is gone)

---

## T12 — Polish, fixtures, and documentation

**Depends on:** T11  
**Blocks:** Nothing  
**User input:** None

### Goal
Final pass — Cosmos fixtures for visual testing, theme verification, help content updates, and copy review.

### What
- Add React Cosmos fixture for the annotation node in states: short text, long markdown text, selected, during zoom levels
- Add Cosmos fixture for `EmptyStateCard` in wide and narrow contexts
- Verify all empty states and annotation nodes render correctly in all themes
- Review and refine hint copy across all surfaces for clarity and consistent tone
- Update help content to document annotation nodes as a user feature (not just onboarding)

### Acceptance
- Cosmos fixtures render correctly
- All themes display hints and annotations properly
- Help docs reference annotation nodes

---

## Summary

| Task | Description | Depends on | User input? |
|---|---|---|---|
| T1 | Annotation node data type | — | No |
| T2 | Annotation node view component | T1 | No |
| T3 | Annotation edit dialog | T2 | No |
| T4 | Solver exclusion for annotations | T1 | No |
| T5 | Annotation creation UX | T2, T3 | No |
| T6 | Import/export support | T1, T4 | No |
| T7 | Empty state card component | — | No |
| T8 | Canvas empty state | T7 | No |
| T9 | Sidebar empty states | T7 | No |
| T10 | Template factory content | T6, T8, T9 | **Yes** |
| T11 | First-visit detection & loading | T10 | No |
| T12 | Polish, fixtures, docs | T11 | No |

### Parallelism

These groups can run concurrently:
- **Group A:** T1 → T2 → T3 → T5, and T1 → T4, feeding into T6
- **Group B:** T7 → T8 + T9 (independent of Group A)
- **Convergence:** T10 needs both groups complete + user input
- **Sequential tail:** T10 → T11 → T12
