# Testing Tasks - Quick Reference for AI Agents (Updated)

## Current Progress

**✅ Completed Tasks:**
- Task 5: Game Data Utils (100%)
- Task 6: Component Testing Setup (100%)
- Task 4: Store Reducers - GraphStore only (60%)
- Task 8: E2E Smoke Tests - baseline coverage (partial)

**📊 Overall Progress: ~30% complete** (3 of 8 tasks with partials in Task 4 and Task 8)

---

## Time Estimates

All tasks show two time estimates:
- **👤 Experienced Developer** - Someone familiar with the codebase and tools
- **🤖 AI Agent** - Agent with context but needs iteration/validation

**Agent Multiplier:** ~2-2.5x due to validation cycles, tool learning, and conservative iteration.

---

## 🔴 CRITICAL: Start Here

### Task 1: Expand Solver Coverage
**Time:** 👤 2-4h | 🤖 4-8h  
**Why:** Core business logic, silent failures possible  
**What:** Add edge case tests for circular dependencies, disconnected graphs, scoring methods  
**Tool:** Vitest (already configured)  
**Blocks:** Nothing, extends existing `app/factory/solver/solver.test.tsx`  
**Agent Notes:** Use real recipe IDs from `gameData.ts`, test frequently  

### Task 2: Import/Export Testing
**Time:** 👤 3-4h | 🤖 5-8h  
**Why:** Data loss prevention, user trust  
**What:** Round-trip encoding, version migration, malformed input handling  
**Tool:** Vitest  
**Blocks:** Nothing, pure functions  
**Agent Notes:** Extract encoding logic first, preserve existing API, use `testExports.json`  

---

### ✅ Task 5: Game Data Utils (COMPLETED)
**Time Actual:** ~3-4h  
**Status:** ✅ COMPLETE  
**What was done:** 
- Created `app/gameData/utils.ts` with 6 utility functions
- Wrote `app/gameData/utils.test.ts` with 38 comprehensive tests
- All functions tested with real game data
- Performance validated (searches < 100ms)
**Key files:**
- `app/gameData/utils.ts` - All utility functions
- `app/gameData/utils.test.ts` - Comprehensive test suite
**Next steps:** None - fully complete

---

### ✅ Task 6: Component Testing Setup (COMPLETED)
**Time Actual:** ~6-8h  
**Status:** ✅ COMPLETE  
**What was done:**
- Set up complete component testing infrastructure
- Created `vitest.component.config.ts` for separate jsdom environment
- Implemented full test helper suite in `renderHelpers.tsx`
- Extracted `recipeNodeLogic.ts` pure functions
- Wrote comprehensive tests for RecipeNode and RecipeNodeView
**Key files:**
- `vitest.component.config.ts` - Component test config
- `app/test/setup/componentTests.ts` - RTL setup
- `app/test/setup/indexeddb.ts` - IndexedDB polyfill
- `app/test/helpers/renderHelpers.tsx` - Test helpers
- `app/factory/graph/recipeNodeLogic.ts` - Pure logic functions
- `app/factory/graph/RecipeNode.component.test.tsx` - 17 tests
**Next steps:** Expand to more components as needed

---

### 🔄 Task 4: Store Action Testing (60% COMPLETE)
**Time Actual:** ~6h | **Remaining:** ~6-8h  
**Status:** 🔄 GraphStore complete, ZoneStore and PlannerStore pending  
**What was done:**
- Extracted `graphReducers.ts` with all GraphStore reducers
- Wrote comprehensive tests (50+ test cases)
- Created `graphStates.ts` test fixtures
- All reducers proven immutable
**Key files:**
- `app/context/reducers/graphReducers.ts` - Pure reducer functions
- `app/context/reducers/graphReducers.test.ts` - 50+ tests
- `app/test/fixtures/graphStates.ts` - Test fixtures
**Next steps:**
- Extract and test ZoneStore reducers
- Extract and test PlannerStore reducers
- Add IndexedDB integration tests
- Test cross-store cascading deletes

---

## 🟡 HIGH VALUE: Do Next (Priority Order)
**Time:** 👤 4-6h | 🤖 8-12h  
**Why:** Complex transformation between UI and solver  
**What:** Refactor to pure functions, test constraint generation, manifold logic  
**Tool:** Vitest  
**Status:** ⏳ TODO  
**Dependencies:** Best done after Task 1 (solver tests provide baseline)
**Agent Notes:** Extract logic from `graphModel.ts`, avoid React Flow types, test solver still works

### Task 7: Hydration Testing
**Time:** 👤 2h | 🤖 3-4h  
**Why:** Map/Set serialization correctness  
**What:** Test round-trips, nested structures, edge cases  
**Tool:** Vitest  
**Status:** ⏳ TODO  
**Dependencies:** None, quick win
**Agent Notes:** Round-trip = serialize → deserialize → compare, test with real store data

### Task 8: E2E Smoke Tests
**Time:** 👤 4-6h | 🤖 8-12h  
**Why:** Integration confidence  
**What:** 3 critical paths only (create factory, import, navigate)  
**Tool:** Playwright (configured)  
**Status:** 🔄 PARTIAL (baseline tests exist)  
**Dependencies:** Benefits from Task 6 (component testing foundation)
**Agent Notes:** Keep tests minimal, clear IndexedDB between tests when needed, prefer `npm run test:e2e`

---

## Task Priority Matrix (Updated)

| Task | Priority | Agent Time | Status | Dependencies | ROI |
|------|----------|------------|--------|--------------|-----|
| 1. Solver Tests | 🔴 CRITICAL | 4-8h | ⏳ TODO | None | ⭐⭐⭐⭐⭐ |
| 2. Import/Export | 🔴 CRITICAL | 5-8h | ⏳ TODO | None | ⭐⭐⭐⭐⭐ |
| 3. Graph Model | 🟡 High | 8-12h | ⏳ TODO | Task 1 | ⭐⭐⭐⭐ |
| 4. Store Actions | 🟡 High | 6-8h rem | 🔄 60% | None | ⭐⭐⭐ |
| 5. Game Data | 🟡 High | -- | ✅ DONE | -- | ⭐⭐⭐⭐ |
| 6. Components | 🟢 Foundation | -- | ✅ DONE | -- | ⭐⭐⭐ |
| 7. Hydration | 🟢 Foundation | 3-4h | ⏳ TODO | None | ⭐⭐⭐ |
| 8. E2E | 🟢 Foundation | 8-12h | 🔄 PARTIAL | Task 6 ✅ | ⭐⭐ |

---

## Recommended Sequence (Updated)

### For AI Agents (Conservative, ~5-7h/week)

**✅ COMPLETED (Weeks 1-3):** Tasks 5, 6, partial Task 4 (~15-20h invested)

**Weeks 4-5 (DO NEXT):** Tasks 1, 2 **(10-16h)** 🔴 HIGHEST PRIORITY
- Critical safety net for core functionality
- Must be done before major refactoring
- Lowest complexity, highest value

**Week 6:** Task 7 **(3-4h)**
- Quick win, completes data persistence testing
- Can overlap with other work

**Week 7:** Complete Task 4 **(6-8h remaining)**
- Finish ZoneStore and PlannerStore reducers
- Add IndexedDB integration tests

**Weeks 8-9:** Task 3 **(8-12h)**
- Higher complexity, benefits from Tasks 1, 2
- Graph model testing

**Week 10:** Task 8 **(8-12h)**
- Final E2E smoke tests
- Integration confidence

**Remaining Time:** 35-52 hours over 7 weeks

### For Experienced Developer (Aggressive, ~4-6h/week)

**✅ COMPLETED:** Tasks 5, 6, partial Task 4 (~10-12h invested)

**Week 4 (DO NEXT):** Tasks 1, 2 **(5-8h)** 🔴 PRIORITY  
**Week 5:** Task 7 + Complete Task 4 **(4-6h)**  
**Week 6:** Task 3 **(4-6h)**  
**Week 7:** Task 8 **(4-6h)**

**Remaining Time:** 17-26 hours over 4 weeks

---

## Decision Guide (Updated)

**Need quick safety net?** → Do Tasks 1, 2 NOW (critical bugs prevented) 🔴  
**Want to complete foundations?** → Finish Task 4 + do Task 7 (store testing)  
**About to refactor solver?** → Do Task 3 before breaking changes  
**Preparing for beta release?** → Do Task 8 last (integration confidence)  
**Limited time (< 5h)?** → Do Task 7 (quick win)  
**Want to learn testing?** → Review completed Tasks 5, 6 (good examples)

**Current Status:**
- ✅ Component testing infrastructure ready
- ✅ Game data utilities complete
- 🔄 Store testing 60% done
- 🔄 E2E baseline tests in place (needs expansion)
- ⏳ Core solver and import/export tests NEEDED URGENTLY  

---

## Quick Start Commands

### Initial Setup
```bash
# Install dependencies
npm ci

# Install Playwright browsers (if not already cached)
npx playwright install chromium
```

### Running Tests
```bash
# All unit tests
npm test

# Watch mode (during development)
npm test -- --watch

# Specific test file
npm test -- solver
npm test -- importexport

# Coverage report
npm test -- --coverage

# E2E tests (build required)
npm run build
npm run test:e2e

# E2E with visible browser
npm run test:e2e -- --headed

# Update snapshots (after intentional changes)
npm test -- -u
```

### Test File Locations
```
app/
  factory/
    solver/
      solver.test.tsx              # Task 1: Expand this
      constraintBuilder.test.ts    # Task 3: Create this
    importexport/
      encoder.test.ts              # Task 2: Create this
  gameData/
    utils.test.ts                  # Exists (Task 5)
  hydration.test.ts                # Task 7: Create this
  test/
    fixtures/
      graphs.ts                    # Task 1 & 3: Create this
      exports.ts                   # Task 2: Create this
    setup/
      indexeddb.ts                 # Exists (IndexedDB polyfill)
      componentTests.ts            # Exists (RTL setup)
    helpers/
      renderHelpers.tsx            # Exists (test helpers)
  context/
    reducers/
      graphReducers.test.ts        # Exists (Task 4)
      zoneReducers.test.ts         # Task 4: Create this
      plannerReducers.test.ts      # Task 4: Create this
e2e/
  app.spec.ts                      # Baseline E2E
  factory-import.spec.ts           # Baseline E2E
  # Add more specs here as Task 8 expands
```

---

## Agent Success Checklist

### Before Starting a Task
- [ ] Read this summary and the core docs: `TESTING_TASKS_SUMMARY.md`, `TESTING_ROADMAP.md`, `COMPONENT_TESTING.md`, `E2E_TESTING.md`
- [ ] Read full task description in `TESTING_ROADMAP.md`
- [ ] Check dependencies are complete
- [ ] Run `npm test` to establish baseline
- [ ] Review files mentioned in task
- [ ] Understand what "success" looks like

### During Implementation
- [ ] Make small, incremental changes
- [ ] Run tests after each logical step
- [ ] For refactoring: verify app still works in UI
- [ ] Add comments explaining non-obvious logic
- [ ] Commit after completing each phase

### Before Marking Complete
- [ ] All new tests pass
- [ ] All existing tests still pass (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Manual testing (if refactored UI)
- [ ] Tests run in expected time (see task metrics)
- [ ] Code follows existing patterns

### Common Agent Pitfalls
❌ **Changing too much at once** → Refactor incrementally  
❌ **Skipping validation** → Test refactor before adding tests  
❌ **Mock-heavy testing** → Use real data when possible  
❌ **Flaky E2E tests** → Add explicit waits  
❌ **Breaking existing code** → Run full test suite  

### When Stuck
1. Run test in isolation: `npm test -- <filename>`
2. Add debug logging: `console.log()` in test
3. Check type errors: `npm run typecheck`
4. Review similar existing tests
5. Use `test.only()` to focus on one test
6. For E2E: use `page.pause()` to debug interactively
7. Ask for help with specific error messages

---

## Expected Test Metrics

After completing all tasks:

### Coverage Goals (Focus on High-Risk)
- Solver: 90%+ (core business logic)
- Import/Export: 90%+ (data integrity)
- Store actions: 80%+ (state management)
- Game data utils: 70%+ (utility functions)
- Components: 50%+ (UI logic)
- Overall: 60-70% (targeting high-risk areas)

### Performance Targets
- Unit tests: < 5 seconds total
- Component tests: < 10 seconds total
- Integration tests: < 15 seconds total
- E2E tests: < 2 minutes total
- Full suite (without E2E): < 30 seconds

### Quality Indicators
✅ Zero flaky tests (all pass consistently)  
✅ Clear error messages (actionable failures)  
✅ Snapshots are reviewed (not blindly updated)  
✅ Tests catch real bugs (validate with intentional breaks)  
✅ Tests are maintainable (follow patterns, not brittle)  

---

## Maintenance After Initial Implementation

### Adding New Tests (Ongoing)
- **New solver features** → Add to Task 1 tests
- **New store actions** → Follow Task 4 reducer pattern
- **New components** → Follow Task 6 patterns
- **New import formats** → Add to Task 2 fixtures
- **New critical paths** → Consider Task 8 E2E (sparingly)

### Test Health Checks
```bash
# Weekly: Check test speed
npm test -- --reporter=verbose

# Monthly: Update dependencies
npm update @testing-library/react @playwright/test

# Before release: Full coverage
npm test -- --coverage

# After refactoring: Verify no regressions
npm test && npm run build && npm run test:e2e
```

---

## Total Effort Summary (Updated)

| Role | Total Time | Completed | Remaining | Progress |
|------|-----------|-----------|-----------|----------|
| 🤖 AI Agent | 52-79h total | 15-20h | 35-52h | ~30% |
| 👤 Experienced Dev | 27-43h total | 10-12h | 17-26h | ~30% |

**What's Done:**
- ✅ Game Data Utils (Task 5) - 3-4h
- ✅ Component Testing (Task 6) - 6-8h  
- 🔄 Store Reducers (Task 4) - 6h (60% complete)
- 🔄 E2E Baseline (Task 8) - 2 specs (partial)

**What's Next (Priority Order):**
1. 🔴 Tasks 1, 2 - Solver and Import/Export (10-16h) - CRITICAL
2. 🟡 Task 7 - Hydration (3-4h) - Quick win
3. 🟡 Complete Task 4 - Remaining stores (6-8h)
4. 🟡 Task 3 - Graph Model (8-12h)
5. 🟢 Task 8 - E2E (8-12h)

**Recommendation for Agents:** Focus on Tasks 1 and 2 next - these are critical for code quality and should be completed before any major refactoring work.

---

## Next Steps

1. **Choose starting task** based on decision guide above
2. **Read full task details** in `TESTING_ROADMAP.md`
3. **Set up environment** (install dependencies if needed)
4. **Start with Phase 1** (review/refactor)
5. **Iterate through phases** (don't skip validation)
6. **Mark complete** after checklist verified

---

## Questions?

See detailed implementation steps in `TESTING_ROADMAP.md` for each task.

Common issues and solutions documented in each task's "Agent Notes" section.

Remember: **Quality over speed.** Better to complete one task thoroughly than rush through all tasks with flaky tests.
