# Project State — where-is-my-model

## Phase: EXECUTION
## Started: 2026-06-06

---

## GPU Calculator Feature — Task List

| # | Status | Task | Type | File(s) |
|---|--------|------|------|---------|
| 1 | ✅ DONE | Create `calculatorEngine.js` — pure calculation functions for the GPU calculator | new_file | `frontend/src/utils/calculatorEngine.js` |
| 2 | ✅ DONE | Create `ModelFormSection.jsx` — model architecture inputs | new_file | `frontend/src/components/GpuCalculator/ModelFormSection.jsx` |
| 3 | ✅ DONE | Create `PrecisionFormSection.jsx` — precision/dtype selects | new_file | `frontend/src/components/GpuCalculator/PrecisionFormSection.jsx` |
| 4 | ✅ DONE | Create `HardwareFormSection.jsx` — hardware specification inputs | new_file | `frontend/src/components/GpuCalculator/HardwareFormSection.jsx` |
| 5 | ✅ DONE | Create `WorkloadFormSection.jsx` — workload parameters inputs | new_file | `frontend/src/components/GpuCalculator/WorkloadFormSection.jsx` |
| 6 | ✅ DONE | Create `ResultsDisplay.jsx` — visual results with bars and color coding | new_file | `frontend/src/components/GpuCalculator/ResultsDisplay.jsx` |
| 7 | ✅ DONE | Create `GPUCalculatorPage.jsx` — page container orchestrating form + results | new_file | `frontend/src/components/GpuCalculator/GPUCalculatorPage.jsx` |
| 8 | ✅ DONE | Modify `Header.jsx` — add tab switcher between Dashboard and Calculadora GPU | modify | `frontend/src/components/Header.jsx` |
| 9 | ✅ DONE | Modify `App.jsx` — add page routing state and conditional rendering | modify | `frontend/src/App.jsx` |
| 10 | ✅ DONE | Create directory structure and verify import chain | config | `frontend/src/components/GpuCalculator/` (directory) |

---

## Dependencies Graph

```
Task 1 (calculatorEngine) ───────────────────────────────┐
Task 2 (ModelFormSection)                  ┌─────────────┤
Task 3 (PrecisionFormSection)    ┌─────────┤             ├───→ Task 7 (GPUCalculatorPage) ────┬───→ Task 9 (App.jsx)
Task 4 (HardwareFormSection)     │         │                                               │
Task 5 (WorkloadFormSection)     │         │               Task 8 (Header.jsx) ───────────────┤
Task 6 (ResultsDisplay) ─────────┘         │
                             Task 10 (dirs + import chain verification) ←─┘
```

## Task Details

### TASK [1]: Create `calculatorEngine.js` — pure calculation functions for the GPU calculator
- **Type:** new_file
- **File(s):** `frontend/src/utils/calculatorEngine.js`
- **Description:** Implement a module of exported pure functions:
  - `calculateModelSizeGB(num_parameters, dtype_bytes)` → model weights size in GB = `(num_parameters × dtype_bytes) / (1024³)`
  - `calculateKvCachePerSeqGB(num_hidden_layers, num_key_value_heads, head_dim, max_model_len, kv_cache_dtype_bytes)` → per-sequence KV cache in GB = `(2 × num_hidden_layers × num_key_value_heads × head_dim × max_model_len × kv_cache_dtype_bytes) / (1024³)`
  - `calculateTotalKvCacheGB(kv_cache_per_seq_gb, max_num_seqs)` → total = `kv_cache_per_seq_gb × max_num_seqs`
  - `getAvailableVram(vram_total_gb, gpu_memory_utilization)` → `vram_total_gb × gpu_memory_utilization`
  - `getUsedVramWithPrefixCache(model_size_gb, total_kv_cache_gb, prefix_cache_hit_ratio)` → effective KV = `total_kv_cache × (1 - prefix_cache_hit_ratio)`, then sum with model size
  - `getRemainingVram(available_vram_gb, used_vram_gb)` → clamped to ≥ 0
  - `getVramUsagePercent(used_vram_gb, available_vram_gb)` → percentage for color-coding bars
- **Acceptance criteria:** Each function exported as pure JS, takes only primitives, returns numbers. Round to 2 decimals where appropriate. Input validation handles null/undefined/NaN gracefully (returns 0).
- **Dependencies:** none

### TASK [2]: Create `ModelFormSection.jsx` — model architecture inputs
- **Type:** new_file
- **File(s):** `frontend/src/components/GpuCalculator/ModelFormSection.jsx`
- **Description:** Form section with emoji label "📐 Modelo", containing 5 controlled number inputs: `num_hidden_layers`, `num_key_value_heads`, `head_dim`, `hidden_size`, `num_parameters`. Each input shows the field name as `<label>`, has type="number", min="0", step="any". The component accepts `values` (object with all field keys) and `onChange` callback `(fieldName, value)` → void. Uses existing Tailwind styling conventions (`bg-bg-input`, `border-border`, etc.).
- **Acceptance criteria:** Five labeled inputs render. Dispatching onChange updates parent state. Visual style matches existing modal inputs in the codebase (font-sans, text-text-primary, rounded-md).
- **Dependencies:** none

### TASK [3]: Create `PrecisionFormSection.jsx` — precision/dtype selects
- **Type:** new_file
- **File(s):** `frontend/src/components/GpuCalculator/PrecisionFormSection.jsx`
- **Description:** Form section with emoji label "🔢 Precisión", containing 2 `<select>` dropdowns: `dtype_bytes` (options mapping to FP32/4, FP16/BF16/2, FP8/1) and `kv_cache_dtype_bytes` (same options). Component accepts `values` object and `onChange(fieldName, value)` callback. The selects should have descriptive labels showing both name and description.
- **Acceptance criteria:** Two labeled `<select>` elements render with meaningful options. onchange dispatches to parent. Default selection is FP16/BF16 (value=2).
- **Dependencies:** none

### TASK [4]: Create `HardwareFormSection.jsx` — hardware specification inputs
- **Type:** new_file
- **File(s):** `frontend/src/components/GpuCalculator/HardwareFormSection.jsx`
- **Description:** Form section with emoji label "🖥️ Hardware", containing 2 number inputs: `vram_total_gb` (VRAM in GB, min=0, step=1) and `gpu_memory_utilization` (fraction 0–1, min=0, max=1, step=0.01). Component accepts `values`, `onChange`. The utilization input should display as percentage visually (e.g., label shows "GPU Memory Utilization (%)") but store as decimal internally.
- **Acceptance criteria:** Two labeled inputs render correctly. Input values round-trip through the parent state correctly. Defaults to reasonable values (vram_total_gb=80, gpu_memory_utilization=0.95).
- **Dependencies:** none

### TASK [5]: Create `WorkloadFormSection.jsx` — workload parameters inputs
- **Type:** new_file
- **File(s):** `frontend/src/components/GpuCalculator/WorkloadFormSection.jsx`
- **Description:** Form section with emoji label "🎯 Carga de trabajo", containing 5 number inputs: `max_model_len`, `max_num_seqs`, `avg_prompt_len`, `avg_output_len`, `prefix_cache_hit_ratio`. The prefix_cache_hit_ratio input has min=0, max=1, step=0.01 (decimal). Others have min=0. Component accepts `values`, `onChange`.
- **Acceptance criteria:** Five labeled inputs render. onchange dispatches correctly. Sensible defaults provided in the parent's initial state.
- **Dependencies:** none

### TASK [6]: Create `ResultsDisplay.jsx` — visual results with bars and color coding
- **Type:** new_file
- **File(s):** `frontend/src/components/GpuCalculator/ResultsDisplay.jsx`
- **Description:** Read-only display component showing calculation results as labeled progress bars. Accepts `results` prop (object with keys: modelSizeGB, kvCachePerSeqGB, totalKvCacheGB, availableVramGB, usedVramGB, remainingVramGB, vramUsagePercent, prefixCacheSavingsGB). Each metric renders a label row showing the value in bold monospace + color-coded bar using the existing `getGpuColorClass()` and `clamp()` from `gpuHelpers.js`. The VRAM usage bar must reuse the GPUBar visual pattern (bg-bg-input track, rounded-full overflow-hidden, animated fill). Include a summary card at top: used/available VRAM with green/yellow/red accent dot using the color classes. Results should only render if all values are > 0 (show empty state message otherwise).
- **Acceptance criteria:** When given a populated results object, displays numeric readouts and color-coded bars. Green for ≤35%, yellow 36-70%, red >70%. Matches existing GPUBar/GPUDetails visual style. No layout shift when transitioning from empty → populated.
- **Dependencies:** none (runtime dependency on gpuHelpers.js which already exists)

### TASK [7]: Create `GPUCalculatorPage.jsx` — page container orchestrating form + results
- **Type:** new_file
- **File(s):** `frontend/src/components/GpuCalculator/GPUCalculatorPage.jsx`
- **Description:** Main calculator page component. Manages unified `formState` via `useState` initialized with sensible defaults for all 14 input fields. On every render, imports functions from `calculatorEngine.js` and derives results synchronously (no useEffect needed — computed during render). Renders a layout with 4 form sections on the left/center and ResultsDisplay panel on the right. Responsive: single column on mobile, two columns on large screens (using Tailwind `md:` and `lg:` breakpoints). Reuses existing page container styling conventions from App.jsx (`min-h-screen bg-bg-primary`, etc.) but scoped within a `<main>` element. Include a "Reset" button that restores all fields to defaults.
- **Acceptance criteria:** All 4 form sections render in a grid layout. Modifying any input causes results to update immediately. Reset button restores defaults. Layout is responsive. No unnecessary re-renders (use derived state pattern per Vercel best practices — compute during render, not in effects).
- **Dependencies:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6

### TASK [8]: Modify `Header.jsx` — add tab switcher between Dashboard and Calculadora GPU
- **Type:** modify
- **File(s):** `frontend/src/components/Header.jsx`
- **Description:** Add a tab switcher component to the header. The existing title stays on the left. Between the title and the action buttons, insert a horizontal tab group with two tabs: "Dashboard" and "Calculadora GPU". Each tab is a `<button>` styled with active/inactive states consistent with the project's aesthetics (bg-bg-input for inactive, bg-accent for active). Accept new props: `currentPage` (string: 'dashboard' | 'calculator') and `onPageChange(page)` callback. Export button logic remains unchanged — it stays on the right side as before. The layout adapts: on mobile the tabs go below the title in a flex row; on desktop they flow inline with existing elements.
- **Acceptance criteria:** Two tabs render between title area and action buttons. Clicking a tab calls `onPageChange` with the correct page name. Active tab visually distinguished from inactive. Add PC / Export JSON buttons remain functional and visible only when Dashboard is active — pass new prop `showActions` or conditionally hide them based on `currentPage`.
- **Dependencies:** none

### TASK [9]: Modify `App.jsx` — add page routing state and conditional rendering
- **Type:** modify
- **File(s):** `frontend/src/App.jsx`
- **Description:** Add `currentPage` state (`useState('dashboard')`) to App. Import `GPUCalculatorPage`. Wire Header's new `currentPage` and `onPageChange` props. Conditionally render `<PCGrid>` + dashboard content when `currentPage === 'dashboard'`, and `<GPUCalculatorPage />` when `currentPage === 'calculator'`. Pass `showActions={currentPage === 'dashboard'}` to Header so action buttons only appear on dashboard page. The modal routing logic remains unchanged and is scoped to the dashboard view.
- **Acceptance criteria:** App renders Dashboard by default. Clicking "Calculadora GPU" tab shows calculator page. Clicking "Dashboard" tab returns to dashboard with all existing functionality intact. No console errors. Modal state resets or persists appropriately when switching pages (modals should close on page switch).
- **Dependencies:** Task 7, Task 8

### TASK [10]: Create directory structure and verify import chain
- **Type:** config
- **File(s):** `frontend/src/components/GpuCalculator/` (directory)
- **Description:** Ensure the `GpuCalculator/` subdirectory exists under components. Verify all internal imports resolve: GPUCalculatorPage imports ModelFormSection, PrecisionFormSection, HardwareFormSection, WorkloadFormSection, ResultsDisplay from `./ModelFormSection`, etc. calculatorEngine.js is importable from both GPUCalculatorPage and ResultsDisplay via relative paths. Confirm no circular dependencies exist between the new files.
- **Acceptance criteria:** `npm run dev` (or equivalent Vite command) starts without module resolution errors. All 6 new components + 1 utility file are discovered by Vite. No Tree-shakable imports verified — each component only imports what it uses.
- **Dependencies:** Task 1 through Task 7

---

## Execution Log

| Time | Task | Result |
|------|------|--------|
| 2026-06-06 | Task [1] calculatorEngine.js | ✅ Verified: 7 pure functions correct (modelSize, kvCachePerSeq, totalKvCache, availableVram, usedVramWithPrefixCache, remainingVram, vramUsagePercent). Approved by coder-reviewer. Documentation updated in `docs/documentation/frontend/src/utils.md`. |
| 2026-06-06 | Task [2] ModelFormSection.jsx | ✅ Created: controlled stateless component with 5 number inputs (num_hidden_layers, num_key_value_heads, head_dim, hidden_size, num_parameters). Inline positive-value validation + error messaging. Styling matches modal patterns exactly. Approved by coder-reviewer. Documentation updated in `docs/documentation/frontend-components-phase4.md`. |
| 2026-06-06 | Task [3] PrecisionFormSection.jsx | ✅ Created: controlled stateless component with 2 `<select>` dropdowns (dtype_bytes, kv_cache_dtype_bytes) for precision/quantization. Shared options array (float32/int4 to int8/bfloat16). Fields config + `.map()` pattern mirrors ModelFormSection exactly. Approved by coder-reviewer. Documentation updated in `docs/documentation/frontend-components-phase4.md`. |
| 2026-06-06 | Task [4] HardwareFormSection.jsx | ✅ Created: controlled stateless component with 2 number inputs (vram_total_gb, gpu_memory_utilization). Dual validation logic (utilization bounded to (0,1], vram positive-only). Dynamic percentage hint for utilization field. Defaults: vram=80, utilization=0.95. Pattern mirrors ModelFormSection exactly. Approved by coder-reviewer. Documentation updated in `docs/documentation/frontend/src/components/GpuCalculator.md`. |
| 2026-06-06 | Task [5] WorkloadFormSection.jsx | ✅ Created: controlled stateless component with 5 number inputs (max_model_len, max_num_seqs, avg_prompt_len, avg_output_len, prefix_cache_hit_ratio). Bimodal validation: ratio bounded to [0,1], remaining fields positive-only. Defaults: {4096, 256, 256, 1024, 0.5}. Pattern mirrors HardwareFormSection exactly (conditional step/max/attributes via id check inside .map()). Approved by coder-reviewer. Documentation updated in `docs/documentation/frontend/src/components/GpuCalculator.md`. |
| 2026-06-06 | Task [6] ResultsDisplay.jsx | ✅ Documented: read-only visualization component accepting `results` prop (8 keys). Renders empty state guard, summary card with color-coded dot/main VRAM bar, and 7 metric rows with proportional bars. Color coding: green ≤35%, yellow 36-70%, red >70%. Imports `clamp`, `getGpuColorClass` from `gpuHelpers.js`. Accessibility: role="progressbar" + ARIA attributes. Documentation added (105 lines) to `docs/documentation/frontend/src/components/GpuCalculator.md`. |
| 2026-06-06 | Task [7] GPUCalculatorPage.jsx | ✅ Created: orchestrator page with unified formState (14 fields), derived-state pattern (no useEffect), responsive layout (single-column mobile → 2-column desktop lg:), sticky results panel, Reset button. All sibling components wired via {values, onChange}. Approved by coder-reviewer against Vercel React Best Practices. Documentation updated in `docs/documentation/frontend/src/components/GpuCalculator.md`. |
| 2026-06-06 | Task [8] Header.jsx | ✅ Modified: tab switcher added between title and action buttons. Two tabs ("Dashboard", "Calculadora GPU") rendered as `<button role="tab">` with dynamic `aria-selected`. New props: `currentPage` (string, default 'dashboard'), `onPageChange` (optional callback, guard-checked). Layout updated to `items-start` for mobile stacking; left zone is full-width on mobile, auto-width on desktop. Action buttons conditionally rendered only when `currentPage === 'dashboard'`. File grew from 94 to 127 lines (+33 lines). Approved by coder-reviewer. Documentation updated in `docs/documentation/frontend/src/components.md`. |
| 2026-06-06 | Task [9] App.jsx | ✅ Modified: page routing state (`currentPage`) added via `useState('dashboard')`. `handlePageChange` callback switches page and resets modal state, ensuring modals close on navigation. `GPUCalculatorPage` imported. Header wired with `currentPage` + `onPageChange`. Dashboard content (PCGrid + 5 modals) wrapped in ternary conditional; calculator view rendered as else branch. File grew from 230 to 252 lines (+22 lines). Approved by coder-reviewer. Documentation updated by child-documenter. |
| 2026-06-06 | Task [10] GpuCalculator/ verification | ✅ Verified: directory structure complete (6 components + 1 utility file). All import paths resolve correctly. Import graph is acyclic (DAG). Vite dev server starts cleanly. `vite build` transforms 47 modules with exit 0. No wildcard imports — all tree-shakeable. Zero code changes needed. Approved by coder-reviewer. |
