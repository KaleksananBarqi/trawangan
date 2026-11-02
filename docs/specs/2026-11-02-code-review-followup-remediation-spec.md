# Specification: Code Review Follow-Up — Plan State Cleanup, Workspace Context Switch Fix, Settings De-duplication, and Code Smells Remediation

## Problem Statement

Following the initial implementation of the workspace-scoped drawing persistence, theme isolation, settings taxonomy revamp, and direct grid control features, a two-axis code review (Standards and Spec) identified several technical defects, partial implementations, and code smells that require remediation:

1. **Stale Plan Memory & Broken Plan Reverse Lookup on Restore**:
   - In the drawing controller, when `restoreDrawings` is executed during a context switch, existing `activePlans`, `drawingMetadata`, and `planDrawingIds` are not purged before loading the new state. If a user switches to an empty workspace or an instrument without plans, residual trade setup cards and calculations remain in memory.
   - The bidirectional reverse mapping table (`drawingPlanMap`, which maps `drawingId` back to `planId`) is not reconstructed during restoration. Consequently, when a trader selects and deletes an anchor or line belonging to a trade setup on the canvas, the system fails to cascade the deletion to the corresponding trading plan and floating thesis cards.

2. **Workspace Drawing Restoration Omission on Identical Symbols**:
   - In the chart view layer, the workspace reactivity effect updates the controller's workspace context, but fails to trigger a drawing reload when switching between workspaces that happen to have the same active symbol (e.g. switching from Workspace A on BTCUSDT to Workspace B on BTCUSDT). As a result, the drawings from Workspace A remain visible in Workspace B instead of loading Workspace B's distinct drawings.

3. **Storage Write Race Condition on Unawaited Context Flushes**:
   - The drawing persistence flush (`flushDrawings()`) is invoked synchronously without `await` in symbol change and new workspace action handlers. Because underlying I/O is asynchronous, rapid transitions risk write race conditions where stale data overwrites newly modified canvas states.

4. **Duplicated Settings Controls in Chart Tab**:
   - Default timeframe selection, workspace auto-save, and workspace startup auto-load toggles were successfully integrated into the General Settings tab, but the original legacy controls were not removed from the Chart Settings tab. This leaves confusing duplicate controls across two tabs.

5. **Code Smells & Readability Debt**:
   - **Duplicated Font Fallback Logic**: Multiple markup locations in the Typography Settings tab recalculate the active font size with redundant ternary fallbacks based on UI density.
   - **Duplicated Grid Color Calculations**: Canvas session controller repeats ternary logic for normal, dimmed, and hidden grid styling in multiple locations.
   - **Data Clumps**: Multiple discrete getter functions are passed together across controller attachment boundaries without a unified parameter structure.
   - **Cryptic Variable Naming**: Local provider and symbol resolution uses single-character abbreviations instead of descriptive domain identifiers.

---

## Solution

1. **Rigorous Plan State Cleanup & Bidirectional Map Rebuilding**:
   - At the beginning of `restoreDrawings`, clear `activePlans`, `drawingMetadata`, `planDrawingIds`, and `drawingPlanMap`.
   - When deserializing `_trawangan_meta`, repopulate the state and reconstruct `drawingPlanMap` for every drawing ID referenced by each active plan.

2. **Reactive Workspace-Change Drawing Reload**:
   - Enhance the workspace change effect in the chart view to compare previous and current workspace identifiers. Whenever the active workspace changes, trigger `restoreDrawings` immediately, ensuring correct workspace-scoped drawings load even when the trading pair remains identical.

3. **Async-Safe Context Flushes**:
   - Convert event handlers involving context shifts (such as symbol selection, workspace switching, and new workspace creation) to `async` functions and explicitly `await flushDrawings()` before switching the context.

4. **Purge Duplicated Controls from Chart Settings Tab**:
   - Remove the legacy Default Timeframe selector, Workspace Auto-Save toggle, and Startup Auto-Load toggle from the Chart tab, cementing the General tab as the single authority for workspace and session persistence.

5. **Refactor Code Smells**:
   - Derive font size through a single reactive rune in the Typography tab.
   - Extract grid color and alpha calculation into a centralized helper method in the session controller.
   - Consolidate contextual getters in the drawing controller into a clean resolver interface.
   - Rename abbreviated variables to descriptive domain names (`provider`, `normalizedSymbol`).

---

## User Stories

1. As a technical trader switching between workspaces that track the same crypto pair, I want the chart to immediately reload drawings belonging specifically to the target workspace, so that setups from my scalping workspace never linger when I open my swing workspace.
2. As an active trader deleting a drawn target level on the canvas after a restored session, I want the associated trading plan and thesis card to delete automatically in sync, so that orphaned plan metrics do not clutter my dashboard.
3. As a trader navigating from a symbol with extensive trade setups to a fresh symbol with no drawings, I want all previous plan cards and calculations cleared from memory, so that phantom trade thesis cards do not appear on clean charts.
4. As a user rapidly switching symbols or workspaces, I want drawing flush operations to complete asynchronously before the context changes, so that rapid clicks do not cause storage race conditions or lost lines.
5. As a user exploring the settings dialog, I want default timeframe and workspace auto-save options to appear exclusively in the General tab, so that I am never confused by duplicate settings in the Chart tab.
6. As a trader adjusting UI scaling, I want font sizes evaluated consistently and reactively across all sample previews, so that text scaling remains fluid without stutter or lag.
7. As a developer maintaining the chart session controller, I want grid line styling and alpha evaluation consolidated in one place, so that theme adjustments to grid lines never drift across different canvas rendering pathways.
8. As a developer maintaining the drawing controller, I want contextual workspace and symbol resolution bundled in a typed interface, so that method signatures remain clean and easy to extend.
9. As a developer reading codebase services, I want clear, descriptive domain variable names instead of single-letter abbreviations, so that onboarding and code audits remain frictionless.

---

## Implementation Decisions

- **State Lifecycle in Drawing Controller**:
  - `restoreDrawings` must reset internal collections prior to I/O:
    - Empty `activePlans` map.
    - Empty `drawingMetadata` map.
    - Empty `planDrawingIds` map.
    - Empty `drawingPlanMap` lookup.
  - When parsing `_trawangan_meta.planDrawingIds`, iterate over each plan entry and register `drawingPlanMap.set(drawingId, planId)` so that drawing mutation and deletion events correctly find their parent plans.

- **Chart Component Workspace Reactivity**:
  - Track previous workspace ID using a local state variable or rune.
  - In the reactive `$effect` watching `workspaceId`, if the ID changes from the previous value, invoke `restoreDrawings()` regardless of whether the symbol has changed.

- **Asynchronous Transition Pipelines**:
  - In the root page router, update `handleSymbolChange`, `handleProviderChange`, `handleLoadWorkspace`, and `handleNewWorkspace` to be asynchronous, executing `await flushDrawings()` before updating active state variables or resetting stores.

- **Settings Cleanup**:
  - In the Chart settings component, delete the section containing `defaultTimeframe` and workspace persistence options, leaving only canvas visual options (grid mode, watermark, current price line, crosshair).

- **Code Smell Refactorings**:
  - In Typography settings: introduce `$derived(effectiveFontSize)` consolidating density fallbacks.
  - In Chart Session controller: introduce private `resolveEffectiveGridColor(textColor: string, isDark: boolean): string`.
  - In Drawing controller: introduce `DrawingContextResolvers` interface and replace discrete function parameters.

---

## Testing Decisions

- **What makes a good test**: Tests should assert observable external behavior—verifying that switching workspaces with identical symbols loads distinct drawings, that plan deletions succeed on restored canvases, and that duplicate UI elements are absent from DOM snapshots—without binding to private class internals.
- **Modules to test**:
  - `ChartDrawingController`:
    - Clearing plan memory when restoring an empty workspace or clean canvas.
    - Reconstruction of `drawingPlanMap` and verifying that canvas drawing deletion triggers plan deletion on restored drawings.
  - `Chart.svelte` integration seam:
    - Verifying that changing the `workspaceId` prop triggers `restoreDrawings` even when `symbol` and `providerId` remain unchanged.
  - Root event pipeline:
    - Verifying that context shifts await flush resolution before committing new context state.
  - Settings component assertions:
    - Inspecting Chart Settings markup to verify absence of `defaultTimeframe` and workspace auto-save controls.
- **Prior Art**:
  - `tests/workspaceDrawingAndGridDecoupling.test.ts`
  - `tests/drawingContextPreservation.test.ts`
  - `tests/settingsModal.test.ts`

---

## Out of Scope

- Rewriting the underlying WebGL2 canvas rendering engine.
- Adding new drawing tool types or new indicator calculation algorithms.
- Modifying cloud storage or external API endpoints.

---

## Further Notes

- Addressing these code review findings closes the loop on technical debt before code is merged into the mainline release branch, ensuring optimal memory hygiene and clean UI separation.
