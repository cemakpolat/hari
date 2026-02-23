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

## 📋 Planned (v0.3 - Future)

### Enhanced Form Capabilities
- [ ] File upload preview and progress
- [ ] Multi-step forms with wizard navigation
- [ ] Form auto-save and recovery
- [ ] Rich text editor field type
- [ ] Date range picker
- [ ] Color picker field
- [ ] Autocomplete/typeahead fields with async data

### Enhanced Document Capabilities
- [ ] Interactive code blocks with syntax highlighting library integration
- [ ] Full charting library integration (e.g., Recharts, Chart.js)
- [ ] Table sorting and filtering
- [ ] Expandable/collapsible sections
- [ ] Table of contents auto-generation
- [ ] Document search and navigation
- [ ] Export to PDF/Markdown

### New Intent Types
- [x] **Workflow** — multi-step guided processes (schema + renderer + onboarding scenario)
- [x] **Timeline** — chronological event visualization (schema + renderer + deploy history scenario)
- [ ] **Chat/Conversation** — conversational UI pattern
- [x] **Kanban** — task board visualization (schema + renderer + sprint board scenario)
- [x] **Calendar** — event scheduling and planning (month/week/agenda views, density-aware)
- [x] **Tree/Hierarchy** — organizational structure visualization (interactive expand/collapse, search, breadcrumb)

### Accessibility (WCAG 2.2 AA)
- [ ] Comprehensive keyboard navigation audit
- [ ] Screen reader optimization
- [ ] Focus management improvements
- [ ] ARIA label completeness check
- [ ] Color contrast verification
- [ ] Motion/animation reduction preferences

### Trust & Validation
- [ ] User testing of blast radius comprehension
- [ ] A/B test confirmation delay effectiveness
- [ ] Confidence score calibration
- [ ] Error recovery patterns

### Performance
- [ ] Streaming JSON parser integration for progressive rendering
- [ ] Large form performance optimization (virtualization)
- [ ] Document lazy loading for long reports
- [ ] Bundle size optimization

### Real Integrations
- [ ] MCP server integration examples (2–3 connectors)
- [ ] WebSocket transport for real-time updates
- [ ] Server-Sent Events for live document refresh
- [ ] Agent SDK integration guide

### Schema Versioning
- [ ] Schema migration utilities
- [ ] Backward compatibility layer
- [ ] Version negotiation protocol
- [ ] Capability discovery API

### Hypothetical Mode
- [ ] Isolated "what-if" overlay system
- [ ] State branching without mutation
- [ ] Compare hypothetical vs actual
- [ ] Rollback/commit flow

### Developer Experience
- [ ] Storybook integration for all components
- [ ] Component playground
- [ ] Intent payload builder/validator UI
- [ ] TypeScript strict mode
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
- [ ] Real-time collaboration indicators
- [ ] Version control for intent payloads
- [ ] Undo/redo for intent modifications

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

*Last updated: 2026-02-23 (v0.2.3)*
