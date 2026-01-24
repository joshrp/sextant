# Production Readiness Report

## Executive Summary

This document identifies critical issues, blockers, and missing user journeys that must be addressed before the COI Calculator can be considered production-ready for real users.

**Overall Assessment**: The app has solid core functionality (graph building, solver, import/export), but has several critical gaps in data management, error recovery, and user journey completeness.

**Status Update (2026-01-24)**:
- Zone deletion is implemented and clears zone IDB data
- Factory removal exists, but does not delete factory IDB data
- Bulk export/import UI exists (not yet positioned as full backup/restore)
- Factory archive/restore flow exists

---

## 🔴 CRITICAL ISSUES (Must Fix)

### 1. Factory Deletion Leaves Orphaned Factory Data

**Location**: `app/context/ZoneProvider.tsx`, `app/context/idb.ts`, `app/factory/store.ts`

**Problem**: Zone deletion is implemented and clears its IndexedDB, but factory deletion currently only removes the factory from the zone list. The factory’s IndexedDB entries (graph + history) remain, causing orphaned data.

**Impact**:
- Disk space leaks over time
- Stale factory data remains in IDB after deletion

**Solution**:
1. When deleting a factory, also delete its entries from the zone’s `factories` and `factory-history` stores
2. Add confirmation dialogs to prevent accidental deletion

---

### 3. Weights Feature is Non-Functional

**Location**: `app/components/Settings/FactorySettings.tsx`

**Problem**: As noted in the TODO comment: "Presets save but don't do anything. Weights don't save." The entire weights system for influencing solver priorities is incomplete.

**Impact**:
- Misleading UI that appears functional but isn't
- Users expect product weights to influence optimization but they don't
- Settings tab shows weight inputs that do nothing

**Solution**:
- Either complete the weights integration with the solver
- Or remove/hide the weights tab until implemented

---

**Problem**: Several critical operations fail silently without user feedback:

**Examples**:
- `newZone()` throws on duplicate name but caller doesn't catch (`PlannerProvider.tsx`)
- `renameZone()` throws on zone not found
- `renameFactory()` uses `alert()` for duplicate name but throws for factory not found (`ZoneProvider.tsx`)
- Solver errors are console.logged but not displayed to user (`solverClient.ts`)

**Impact**:
- App can crash without recovery
- Users don't know what went wrong
- Inconsistent error handling (some alert, some throw, some log)

**Solution**:
- Implement consistent error boundary with user-friendly messaging
- Add toast/notification system for transient errors
- Return error states instead of throwing in stores

---

### 4. No Data Validation on Store Hydration

**Location**: All store `migrate` functions

**Problem**: The migration logic only checks for basic field existence. If IndexedDB data is corrupted or partially loaded, the app may behave unpredictably.

**Impact**:
- Corrupted IndexedDB can cause app crash
- No recovery mechanism for bad data
- No user notification of data problems

**Solution**:
- Add schema validation on hydration
- Add "reset to default" option in UI
- Add data export before potential destructive operations

---

## 🟠 HIGH PRIORITY ISSUES

### 6. Store Cache Never Clears

**Location**: `app/context/ZoneProvider.tsx` (line 11), `app/context/FactoryProvider.tsx` (line 16)

**Problem**: Store caches (`storeCache`) grow indefinitely and never clear entries. Memory usage increases as user navigates between many zones/factories.

**Impact**:
- Memory leak with heavy usage
- Stale data if user clears browser storage but doesn't reload app

**Solution**:
- Implement LRU cache or WeakRef-based cleanup
- Clear cache on significant state changes

---

### 7. IndexedDB Version Upgrade is Broken

**Location**: `app/context/idb.ts`, `app/context/PlannerProvider.tsx`

**Problem**: If `oldVersion >= 1` in upgrade handler, it throws an error asking user to clear site data. This is not user-friendly and will cause data loss.

**Impact**:
- Any future IndexedDB schema changes will break the app for existing users
- Users forced to lose all data on upgrades

**Solution**:
- Implement proper migration for each version increment
- Add data export before upgrade
- Consider backup/restore functionality

---

### 8. No "Clear Graph" / "Reset Factory" Option

**Problem**: Users can add nodes to a factory graph but there's no bulk clear operation. Must delete nodes one by one.

**Impact**:
- Tedious to start over with a factory design
- Users may abandon factories rather than cleaning them

**Solution**:
- Add "Clear All Nodes" button in settings or context menu
- Add confirmation dialog

---

### 9. Solver Error States Are Unhelpful

**Location**: `app/context/FactoryControls.tsx`

**Problem**: When solver returns "Infeasible" or "Error", user sees only "Unsolvable" or "Solver Error" with no guidance on what went wrong or how to fix it.

**Impact**:
- Users don't understand why their graph doesn't solve
- No actionable feedback

**Solution**:
- Provide hints based on solver state (e.g., "No goals set", "Disconnected graph", "Contradicting constraints")
- Link to help documentation

---

### 10. Undo/Redo Not Implemented

**Location**: `app/factory/store.ts`, `app/context/FactoryControls.tsx`

**Problem**: There is no undo/redo state management or UI controls. The store includes a minimal historical timestamp but no undo/redo stacks.

**Impact**:
- Accidental deletions are permanent
- Users must manually recreate deleted work

**Solution**:
- Add undo/redo keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Add undo/redo buttons to factory controls

---

## 🟡 MEDIUM PRIORITY ISSUES

### 11. No Mobile/Responsive Design


**Problem**: App uses fixed pixel widths (sidebar 240px-600px) and assumes desktop viewport. No touch support considerations for React Flow.

**Impact**:
- Unusable on mobile devices
- Poor experience on tablets

**Not solving this**

---

### 12. No Empty State Guidance

**Problem**: When a factory graph is empty, there's no onboarding or guidance on how to get started.

**Impact**:
- New users don't know what to do
- Discovery is required to understand workflow

**Solution**:
- Add a tutotial flow for first-time users with an option to restart it
  - It should walk them through adding a goal, adding nodes, adding the inputs for it 
  - It should have them create a new factory tab to see what's possible with splitting them
- Link to help documentation for further reading


---

### 13. Position (0,0) for New Nodes from Sidebar

**Location**: `app/factory/graph/sidebar.tsx`

**Problem**: When adding producers/consumers from sidebar menus, position is hardcoded to `{x: 0, y: 0}`.

**Impact**:
- New nodes stack on top of each other
- User must manually move them

**Solution**:
- Calculate smart placement based on existing nodes
 - Can be a simple algorithm to just find space somewhere. 
 - Highlight the node once it's placed

---

### 14. Incomplete Help Content

**Location**: `app/help/content/recycling.mdx`

**Problem**: Help documentation contains unfinished TODOs ("TODO::link to settings page here?")

**Impact**:
- Broken user experience in help system
- Incomplete documentation

---

### 15. Recipe Picker Sorting is Suboptimal

**Location**: `app/factory/RecipePicker.tsx`

**Problem**: Recipe grouping uses first recipe as parent with no intelligent sorting: "TODO better sort here? Fastest first? Preference?"

**Impact**:
- Suboptimal recipe suggestions for users

---

## 🔵 MISSING USER JOURNEYS

### A. First-Time User Onboarding
- No introduction or tutorial
- No sample factory to explore
- User must discover functionality themselves

### B. Data Backup and Restore (Partial)
- Bulk export works fine for this

### C. Factory Duplication
- Can't duplicate an existing factory
- Must recreate from scratch or use import/export
- An internal export / import would do this fine

### C1. Factory Archive/Restore (Implemented)
- Archive/restore flow exists for factories

### D. Zone Deletion (Implemented)
- Zone deletion exists in the UI/store and clears the zone’s IDB

### E. Factory Deletion (Partial)
- Factory removal exists, but it doesn’t delete factory IDB data (see Critical #1)

### F. Graph Validation Before Solve
- No visual indicators of potential problems
- No warnings about disconnected subgraphs
- No check for missing inputs/outputs

### G. Offline Support (PWA)
- No service worker for offline access
- App requires internet for HiGHS WASM (currently loads from CDN)
- Should move Highs into this repo and load locally, maybe even do the build here too

---

## 🛠️ TECHNICAL DEBT SUMMARY

From TODO comments found in codebase:

1. **solver.ts**: Objectives should always be negative for consistent scoring
2. **solver.ts**: Infrastructure weights need proper implementation
3. **solver.ts**: Constraint group marking for debugging infeasible solutions
4. **solver.ts**: Better feedback for time limit (likely unbounded) errors
5. **graphReducers.ts**: Several complex action refactoring TODOs

---

## RECOMMENDED PRIORITIES

### Phase 1: Critical Fixes (Block Launch)
1. Fix orphaned factory IDB data on delete
2. Either complete or hide the weights feature
3. Add consistent error handling with user feedback

### Phase 2: User Experience (Pre-Launch)
4. Add empty state guidance
5. Improve solver error messaging
6. Fix node positioning from sidebar
7. Complete help documentation

### Phase 3: Enhancement (Post-Launch)
9. Expose undo/redo functionality
10. Add data backup/restore
11. Implement factory duplication
12. Mobile responsiveness

---

## TESTING GAPS

The test suite is solid for the solver but lacks:
- E2E tests for user journeys
- Tests for store hydration edge cases
- Tests for error boundaries
- Tests for IndexedDB operations

---

*Report generated: January 2026*
*Based on commit: Current HEAD*
