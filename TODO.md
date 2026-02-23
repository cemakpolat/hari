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

## 🚧 In Progress (v0.2)

### Demo Integration
- [ ] Wire up form scenario to demo App.tsx scenario switcher
- [ ] Wire up product analysis scenario to demo App.tsx
- [ ] Add scenario selection in demo UI

### Component Registry
- [ ] Register FormRenderer in demo registry
- [ ] Create FormWrapper component for form intent type
- [ ] Register enhanced DocumentRenderer with new block types

### Testing
- [x] Add unit tests for form validation logic (`packages/core/src/__tests__/form.test.ts` — 61 tests)
- [x] Add integration tests for FormRenderer (`packages/ui/src/__tests__/FormRenderer.test.tsx` — 27 tests)
- [x] Add tests for new document block types (table, image, quote, dataviz, embed added to `document.test.ts`)
- [x] Test conditional field visibility (covered in `form.test.ts` and `FormRenderer.test.tsx`)
- [x] Test form submission flows (covered in `FormRenderer.test.tsx`)

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
- [ ] **Workflow** — multi-step guided processes
- [ ] **Timeline** — chronological event visualization
- [ ] **Chat/Conversation** — conversational UI pattern
- [ ] **Kanban** — task board visualization
- [ ] **Calendar** — event scheduling and planning
- [ ] **Tree/Hierarchy** — organizational structure visualization

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
- [ ] ESLint configuration
- [ ] Prettier configuration

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

*Last updated: 2026-02-22*
