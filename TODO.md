# HARI Development Roadmap

## ✅ Completed (v0.1)

- [x] Core intent-based architecture
- [x] Comparison intent type (travel scenario)
- [x] Diagnostic intent type (cloudops, iot scenarios)
- [x] Document intent type with 12 block types
- [x] Form intent type with 9 field types
- [x] Ambiguity controls (4 types)
- [x] Action safety layer with blast radius
- [x] Density-aware rendering (Executive/Operator/Expert)
- [x] Explainability panels
- [x] Component registry system
- [x] Living documents with auto-refresh
- [x] Form validation and conditional fields

---

## ✅ Completed (v0.2)

### Demo Integration
- [x] Wire up form scenario to demo App.tsx scenario switcher
- [x] Wire up product analysis scenario to demo App.tsx
- [x] Add scenario selection in demo UI
- [x] Add timeline scenario (API Gateway deploy history, `timeline-deployments.ts`)
- [x] Add workflow scenario (Service onboarding wizard, `workflow-onboarding.ts`)
- [x] Add kanban scenario (Sprint 17 board, `kanban-sprint.ts`)
- [x] App.tsx expanded to 11 scenarios (Travel, CloudOps, IoT, SRE Doc, Form, Analysis, Calendar, OrgChart, Timeline, Workflow, Kanban)

### Component Registry
- [x] Register FormRenderer in demo registry
- [x] Create FormWrapper component for form intent type
- [x] Register enhanced DocumentRenderer with new block types
- [x] TimelineWrapper / WorkflowWrapper / KanbanWrapper registered (ops, onboarding, project + __generic__ domains)
- [x] CalendarWrapper registered (engineering + __generic__ domains)
- [x] TreeWrapper registered (hr + __generic__ domains)

### Enhancements Landed (v0.2.1)
- [x] DocumentWrapper: expose search, TOC, PDF export, markdown export features
- [x] FormWrapper: enable autoSave (localStorage draft restore) and isSubmitting state
- [x] App.tsx REGISTERED_INTENT_TYPES: added timeline, workflow, kanban
- [x] Architecture Notes panel updated to reflect all scenarios and new renderers

### New Intent Types (v0.2.2)
- [x] **Timeline** — deployment/incident history, density-aware, groupBy, status badges, category legend
- [x] **Workflow** — multi-step guided wizard (info/form/confirmation/review steps), progress bar
- [x] **Kanban** — sprint board with columns, WIP limits, priorities, assignees, tags, metadata
- [x] **Calendar** — month/week/agenda views, all-day + timed events, on-call rotation scenario
- [x] **Tree/Hierarchy** — interactive expand/collapse, search, breadcrumb, status dots, org chart scenario

### Testing (v0.2.2)
- [x] Add unit tests for form validation logic (`packages/core/src/__tests__/form.test.ts` — 61 tests)
- [x] Add integration tests for FormRenderer (`packages/ui/src/__tests__/FormRenderer.test.tsx` — 27 tests)
- [x] Add tests for new document block types (table, image, quote, dataviz, embed added to `document.test.ts`)
- [x] Test conditional field visibility (covered in `form.test.ts` and `FormRenderer.test.tsx`)
- [x] Test form submission flows (covered in `FormRenderer.test.tsx`)
- [x] Schema tests for Timeline, Workflow, Kanban, Calendar, Tree (`new-intent-schemas.test.ts` — 66 tests; total core: 321)
- [x] Renderer tests for Timeline, Workflow, Kanban, Calendar, Tree (`new-renderers.test.tsx` — 53 tests; total UI: 99)

---

## ✅ Completed (v0.3)

### New Intent Types (v0.3.0)
- [x] **Chat/Conversation** — conversational UI pattern (schema + renderer + support chat scenario, streaming support, attachments, density-aware)

### Developer Experience (v0.3.1)
- [x] **Component Playground** (§10b) — interactive JSON editor in demo app: paste any intent payload, get live schema validation feedback + rendered output side-by-side; 12 IntentPayloadSchema round-trip tests added (core total: 349)

### Enhanced Document Capabilities (v0.3.2)
- [x] **Syntax highlighting** (§2b) — lightweight regex tokenizer in `DocumentRenderer` (no library); TS/JS/TSX/JSX, Python, Bash/Shell, JSON; keyword/string/number/comment token colours; `prefers-color-scheme` dark/light theme; 30 unit tests added (`syntax-highlight.test.ts`; UI total: 145)

---

## 📋 Planned (v0.4 - Future)

### Enhanced Form Capabilities
- [x] File upload preview and progress (done — `showPreview` + `URL.createObjectURL`)
- [x] Multi-step forms with wizard navigation (done — `WizardStepIndicator`)
- [x] Form auto-save and recovery (done — localStorage draft restore)
- [ ] Rich text editor field type
- [x] Date range picker (done — `date_range` field type)
- [x] Color picker field (done — native `<input type="color">`)
- [x] Autocomplete/typeahead fields with async data (done — `autocomplete` field type)

### Enhanced Document Capabilities
- [x] Interactive code blocks with syntax highlighting (done — inline regex tokenizer, `syntaxTokenize` export)
- [ ] Full charting library integration (e.g., Recharts, Chart.js) — custom SVG charts exist; external library would add scatter/area
- [x] Table sorting and filtering (done — column sort, filter input > 4 rows)
- [x] Expandable/collapsible sections (done — `collapsible`/`defaultCollapsed` flags)
- [x] Table of contents auto-generation (done — `showToc` with `tocSections`)
- [x] Document search and navigation (done — `showSearch` prop)
- [x] Export to PDF/Markdown (done — `showPdfExport` + `onExportMarkdown`)

### New Intent Types
- [x] **Workflow** — multi-step guided processes (schema + renderer + onboarding scenario)
- [x] **Timeline** — chronological event visualization (schema + renderer + deploy history scenario)
- [x] **Chat/Conversation** — conversational UI pattern (schema + renderer + support chat scenario, streaming support, attachments, density-aware)
- [x] **Kanban** — task board visualization (schema + renderer + sprint board scenario)
- [x] **Calendar** — event scheduling and planning (month/week/agenda views, density-aware)
- [x] **Tree/Hierarchy** — organizational structure visualization (interactive expand/collapse, search, breadcrumb)

### Accessibility (WCAG 2.2 AA)
- [x] Comprehensive keyboard navigation (Enter/Space on Calendar events, h3 collapsible in DocumentRenderer, tabIndex on interactive divs)
- [x] Screen reader optimization (live regions for streaming, form errors)
- [x] Focus management improvements (return focus to trigger on modal/drawer close)
- [x] ARIA label completeness check (all renderers: Why?, Attach, Send, Expand/Collapse, Export, Print, step nav — v0.3.3)
- [x] Color contrast verification (min 4.5:1 normal text, 3:1 large text)
- [x] Motion/animation reduction (`prefers-reduced-motion` on blink cursor — v0.3.3)

### Trust & Validation
- [x] User testing of blast radius comprehension (BlastRadiusTestingTracker)
- [x] A/B test confirmation delay effectiveness (ConfirmationDelayABTest)
- [x] Confidence score calibration (ConfidenceScoreCalibrator — ECE, Brier score)
- [x] Error recovery patterns (ErrorRecoveryTracker)

### Performance
- [x] Streaming JSON parser integration for progressive rendering (NdjsonStreamParser in streaming.ts; feed() chunks, receive updates via onValue callbacks)
- [x] Large form performance optimization (virtualization — VirtualFieldList + useIntersectionMount; lazy-mounts off-screen fields via IntersectionObserver; activates for sections with > 15 fields; first 5 fields always eager; jsdom/SSR fallback mounts all immediately)
- [x] Document lazy loading for long reports (LazySectionLoader in DocumentRenderer; activates when doc has > 5 sections; first 3 sections always eager; shimmer placeholder preserves layout height; mount-once semantics)
- [x] Bundle size optimization (sideEffects:false in both packages; splitting:true + minify:true in tsup configs; NODE_ENV inlining for dead-code elimination; bundle:analyze script; 18 new performance tests)

### Real Integrations
- [ ] MCP server integration examples (2–3 connectors)
- [ ] WebSocket transport for real-time updates
- [ ] Server-Sent Events for live document refresh
- [ ] Agent SDK integration guide

### Schema Versioning
- [x] Schema migration utilities — `migrate()`, `migrateIfNeeded()`, `needsMigration()`, `MigrationError`; chained v0.1→0.2→0.3→1.0; 39 tests (v0.3.4)
- [ ] Backward compatibility layer (accept one major version behind, shim missing fields)
- [ ] Version negotiation protocol
- [ ] Capability discovery API

### Hypothetical Mode
- [x] Isolated "what-if" overlay system (HypotheticalOverlay already existed; extended with full branch state)
- [x] State branching without mutation (`branchHypothetical()` deep-clones currentIntent via JSON round-trip; Immer mutations isolated to hypothetical branch)
- [x] Compare hypothetical vs actual (`HypotheticalCompare` side-by-side panel with diff summary; `hypotheticalDiff` tracks changed keys)
- [x] Rollback/commit flow (`rollbackHypothetical()` discards branch; `commitHypothetical()` promotes to currentIntent + pushes to history; 10 unit tests)

### Developer Experience
- [x] Storybook integration for all components (`.storybook/main.ts` + `preview.ts`; stories for BlastRadiusBadge, DensitySelector, ExplainPanel, HypotheticalOverlay, HypotheticalCompare, DocumentRenderer, FormRenderer, ChatRenderer)
- [x] Component playground (done in v0.3.1 — `PayloadPlayground.tsx`)
- [x] Intent payload builder/validator UI (`IntentPayloadBuilder.tsx` — form-based payload construction with live Zod validation and preview)
- [x] TypeScript strict mode (`strict: true` already set; added `noImplicitReturns`, `noFallthroughCasesInSwitch`; fixed all resulting type errors across core, ui, and demo packages)
- [x] ESLint configuration (eslint.config.mjs, flat config, React + TS rules)
- [x] Prettier configuration (.prettierrc, .prettierignore, format/format:check scripts)

### Documentation
- [ ] Architecture decision records (ADRs)
- [ ] Component API documentation
- [ ] Schema reference guide
- [ ] Integration tutorials
- [ ] Migration guides
- [ ] Video walkthroughs

---

## 🎯 Research & Exploration

### Advanced Features
- [ ] Voice input for forms
- [ ] Collaborative editing for documents
- [ ] Offline mode with sync
- [x] Real-time collaboration indicators *(done — Collaborator schema with displayName/color/focusedDataKey/currentAction; addCollaborator/removeCollaborator/updateCollaboratorFocus/getCollaborators actions; session-level persistence; 22 unit tests; collaborators panel in demo UI)*
- [x] Version control for intent payloads *(done — snapshots with diff tracking; export/import JSON; create/restore/delete; 18 unit tests; snapshot UI panel in demo)*
- [x] Undo/redo for intent modifications *(done — `redoStack` in IntentStore; ⌘Z / ⌘⇧Z shortcuts + toolbar buttons in demo; 14 unit tests)*

### AI/ML Integration
- [ ] Intent prediction based on context
- [ ] Smart defaults from user history
- [ ] Anomaly detection in diagnostic views
- [ ] Natural language form filling
- [ ] Document summarization

### Platform Expansion
- [ ] Mobile-native components (React Native)
- [ ] Web Components variant
- [ ] Vue.js adapter
- [ ] Svelte adapter
- [ ] Desktop app (Electron/Tauri)

---

## 📊 Metrics & Analytics

Track these metrics to measure HARI effectiveness:
- [ ] Time to complete forms vs traditional UIs
- [ ] User comprehension of blast radius indicators
- [ ] Confidence score accuracy vs actual outcomes
- [ ] Ambiguity control usage patterns
- [ ] Density mode preferences by role
- [ ] Error rates on high-risk actions
- [ ] Document engagement (scroll depth, time spent)
- [ ] Form abandonment rates
- [ ] Explainability panel open rates

---

## 🐛 Known Issues / Tech Debt

- [ ] FormRenderer doesn't handle async validation yet
- [ ] DocumentRenderer dataviz is placeholder (needs library)
- [ ] Image block doesn't support expandable/lightbox mode
- [ ] Table block doesn't support row actions
- [ ] No responsive breakpoints defined for density modes
- [ ] Missing error boundaries for individual block types
- [ ] Form sections don't support nested sections
- [ ] No built-in rate limiting for form submissions

---

## 💡 Community Requests

Track user-requested features here:
- [ ] Dark mode support for all components
- [ ] Custom theme configuration
- [ ] Localization/i18n support
- [ ] Right-to-left (RTL) language support
- [ ] Export scenarios to JSON
- [ ] Import scenarios from JSON
- [ ] Component CSS variables for easy customization

---

*Last updated: 2026-02-24 (v0.5.2 — Undo/redo (14 tests) + Version control snapshots (18 tests) + Real-time presence indicators (22 tests); All Advanced Features UIs in demo with save/restore/add collaborator controls; 520 core tests passing)*
