# Onboarding & Annotation Nodes — Feature Plan

## Context

New users currently land on a completely empty factory canvas with no guidance. The toolbar shows controls that don't apply yet (scoring methods, infrastructure, solve), the sidebar sections are all empty, and there's no indication of what to do first. The help system exists but is supplementary — a reference, not a starting point. Users who already understand Captain of Industry production chains still struggle to discover the tool's UI flow: Goal → Recipes → Connections → Solve.

## Audience

CoI players who understand production chains but are new to this tool. We can assume domain knowledge (what recipes are, how inputs become outputs) but not UI familiarity. This means onboarding needs to teach *where to click*, not *what production planning is*.

## Approach Decisions

### Why not a guided tour?

Sequential tooltip walkthroughs (Shepherd.js / Intro.js style) were considered and rejected:

- **Poor completion rates** — users dismiss step 2 of 6 and never return
- **State management overhead** — tracking "which step am I on?" across sessions, handling edge cases when users skip ahead or navigate away
- **Maintenance cost** — tours break when layout changes and couple tightly to DOM structure
- **Resumption problem** — once dismissed, tours are hard to re-trigger without annoying returning users

### Why empty states?

Each UI surface independently knows whether it has content. When it doesn't, it shows a contextual hint. This requires:

- **No global onboarding state** — each component owns its own hint
- **No dismissal logic** — hints vanish naturally when the user takes the action they describe
- **No sequencing** — users can explore in any order
- **No maintenance coupling** — hints are co-located with the components they describe

### Why annotation nodes?

Rather than overlay popups or floating tooltips for in-canvas guidance, a new **annotation node type** gives us:

- **A general-purpose feature** — not just onboarding. Users can label sections of their factory, leave notes, document decisions
- **Native to the graph** — moveable, deleteable, selectable, zoomable. Behaves like everything else on the canvas
- **Template factory integration** — the example factory can ship with annotation nodes that explain what the user is looking at, positioned next to the relevant recipe nodes
- **User editability** — double-click to edit text, drag to reposition, delete when no longer needed. No special "onboarding mode"
- **Zero new UI paradigms** — it's just another node type in React Flow

### Why a template factory?

An empty canvas teaches nothing. A pre-built, already-solved example factory lets new users:

- **See the output before learning the input** — they understand what they're working toward
- **Explore interactively** — click nodes, follow edges, read the sidebar, see how the solver populated machine counts
- **Learn by modification** — change a goal, delete a node, re-solve. Lower stakes than building from scratch
- **Read annotation nodes** positioned next to the things they describe, in context

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Template factory editability | Editable, real factory | Simpler than a read-only mode. Users can modify or delete it freely. |
| Template trigger | First visit only (persisted flag) | Returning users who clear data get a fresh start. Long-time users aren't bothered. |
| Template storage | Embedded import string | Uses existing import/export infrastructure. Easy to update — just re-export. |
| Template complexity | Branching example (3-5 nodes) | Shows merges/branches, which is the tool's value. A linear chain undersells it. |
| Empty state hints | Card-style callouts | Visible but not loud. Consistent styling across all surfaces. |
| Feature visibility | All controls always visible | Empty states guide attention naturally without hiding features. Avoids the "where did that button go?" problem. |
| Hint persistence | Show until action taken | No dismiss buttons, no "don't show again". The hint *is* the empty state. |
| Scope | Full breadth, phased delivery | Every surface gets an empty state eventually, but we ship incrementally. |

## Outline

### Annotation Node Type

A new React Flow node type for placing editable text annotations on the factory canvas.

- Renders markdown or plain text in a styled card
- Supports editing (double-click or edit button)
- Moveable, selectable, deleteable — standard React Flow node behavior
- No handles — annotation nodes don't connect to recipe nodes
- Included in import/export so template factories can ship with annotations
- Visually distinct from recipe nodes — different shape/color/border to avoid confusion
- Respects zoom levels like other nodes

### Empty State Hints

Contextual card-style hints in every empty UI surface.

- **Graph canvas** — centered text prompting the user to add a goal
- **Goals section** — prompt to set a production target
- **By-products / Inputs sections** — explain these populate after adding recipes
- **Infrastructure section** — explains costs appear after solving
- **Zone sidebar** — explains zones organize production areas
- **Factory tabs** — explains factories within zones serve different production lines
- **Solve button** — disabled or dimmed with tooltip when graph is empty

### Template Factory

A pre-built, solved example factory loaded on first visit.

- Branching production chain showing 3-5 recipe nodes with realistic connections
- Already solved — machine counts visible, sidebar populated
- Ships with annotation nodes explaining key UI elements (sidebar, goals, solve button, how to add recipes)
- Loaded into the default zone alongside an empty "My Factory" for the user to start fresh in
- First-visit-only flag persisted in IndexedDB

## Steps

### Phase 1: Annotation Node

1. Define the annotation node data type and add it to the existing node type system
2. Build the annotation node view component — renders text, supports read/edit modes
3. Register the node type with React Flow
4. Add a way to create annotation nodes (context menu, toolbar button, or both)
5. Ensure annotation nodes are excluded from the solver (no handles, no graph model participation)
6. Add annotation node support to import/export
7. Test: create, edit, move, delete, import/export round-trip

### Phase 2: Empty State Hints

8. Build a shared empty state card component with consistent styling
9. Add empty state to the graph canvas (highest-impact surface)
10. Add empty state to the goals sidebar section
11. Add empty states to remaining sidebar sections (by-products, inputs, infrastructure)
12. Add empty states to zone sidebar and factory tabs
13. Handle solve button disabled/tooltip state for empty graphs

### Phase 3: Template Factory

14. Design and build the example factory (select recipes, lay out nodes, add annotation nodes with guide text, solve)
15. Export as a base85 import string and embed in the codebase
16. Add first-visit detection flag to the planner store
17. Wire up first-visit logic: on initial hydration, import the template into the default zone
18. Create an empty "My Factory" alongside the template
19. Test: first visit loads template, subsequent visits don't, cleared IndexedDB re-triggers

### Phase 4: Polish

20. Review and refine all hint copy for clarity and tone
21. Verify annotation nodes and empty states work across themes
22. Verify template factory still imports cleanly after any game data updates
23. Add a Cosmos fixture for the annotation node in various states
24. Update help content to reference annotation nodes as a feature
