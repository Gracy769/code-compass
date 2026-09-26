# Onboarding Dashboard — Execution Plan

> **Implementation notes (added after user confirmation):**
> - Output files placed at workspace root: `index.html`, `app.js`, `style.css`
> - Mermaid theme: `dark`
> - Overall UI: dark mode using Tailwind dark-class utilities and a dark base palette

## Top-Level Overview

**Goal:** Build a zero-build-step, client-side web dashboard that renders the four onboarding pack files as interactive views, served from a single `index.html` with optional companion `app.js` and `style.css` files.

**Approach:** Pure vanilla HTML/JS/CSS. All third-party libraries are loaded from CDN at runtime (Tailwind CSS, marked.js, mermaid.js). The four onboarding files are fetched client-side via the Fetch API and rendered into a single-page app with sidebar navigation.

**Scope:**
- `index.html` — structural shell, CDN imports, sidebar nav, content area
- `app.js` — all client-side logic: routing, Markdown rendering, Mermaid init, Quiz state machine
- `style.css` — minimal overrides where Tailwind utility classes are insufficient

**Non-Goals:**
- No build tooling (no Webpack, Vite, Node, npm)
- No server-side rendering
- No user authentication or data persistence beyond in-page session state
- No multiple-choice quiz format (the QUIZ.json is open-ended; use flashcard/reveal model)

**Source files consumed:**
- `onboarding_pack/ARCHITECTURE.md` — contains 2 Mermaid diagrams (stateDiagram-v2, graph TD)
- `onboarding_pack/MODULES.md` — contains markdown tables and pseudocode blocks
- `onboarding_pack/DANGER_ZONES.md` — contains risk matrices and severity tables
- `onboarding_pack/QUIZ.json` — 6 expert questions with `id`, `module`, `difficulty`, `question`, `answer`, `tags`

---

## Sub-Tasks

---

### Sub-Task 1 — Scaffold `index.html`: Shell, CDN Imports, Layout

**Status:** `[ ] pending`

**Intent:**
Establish the top-level HTML document that acts as the single entry point. Wire in all CDN dependencies and define the two-panel layout (sidebar + content area). No logic lives here — this is pure structure and imports.

**Expected Outcomes:**
- `index.html` exists and opens in a browser without errors
- Tailwind CSS is active (utility classes render correctly)
- `app.js` and `style.css` are linked and load without 404s
- The two-panel layout is visible: a fixed sidebar on the left and a scrollable main content area on the right
- The sidebar contains four navigation links: Architecture, Modules, Danger Zones, Quiz

**Todo List:**
1. Create `index.html` with `<!DOCTYPE html>` and standard `<head>` meta tags
2. Add Tailwind CSS CDN `<script>` tag (play CDN, `https://cdn.tailwindcss.com`)
3. Add `marked.js` CDN `<script>` tag (from jsDelivr or unpkg)
4. Add `mermaid.js` CDN `<script>` tag (from jsDelivr)
5. Add `<link rel="stylesheet" href="style.css">` and `<script src="app.js" defer></script>`
6. Build the two-panel layout using Tailwind flex classes: `aside` (sidebar) + `main` (content area)
7. Populate the sidebar with four `<a>` or `<button>` nav items, each with a `data-view` attribute: `architecture`, `modules`, `danger-zones`, `quiz`
8. Add an empty `<div id="content">` inside `<main>` where views will be injected
9. Add a loading state placeholder inside `#content`

**Relevant Context:**
- No JS logic in this file; `app.js` handles all behavior via `defer`
- Tailwind play CDN includes JIT; no config file needed
- `mermaid.js` must be initialized after the DOM is ready; that happens in `app.js`
- The sidebar nav items drive the router in Sub-Task 2

---

### Sub-Task 2 — Implement the Client-Side Router in `app.js`

**Status:** `[ ] pending`

**Intent:**
Build the routing layer that maps sidebar nav clicks to view renders. This is the spine of the SPA — every other sub-task plugs into this router. Uses `location.hash` as the URL mechanism so no server config is needed.

**Expected Outcomes:**
- Clicking any sidebar nav item loads the correct view into `#content`
- The active nav item is visually highlighted
- The browser back/forward buttons work (hash-based navigation)
- On initial page load, the Architecture view is shown by default
- The router dispatches to stub render functions (filled in by later sub-tasks)

**Todo List:**
1. Create `app.js` with a `views` registry object mapping view names to async render functions (stubs initially)
2. Write a `navigate(viewName)` function that: clears `#content`, highlights the active nav item, calls the correct render function
3. Attach `click` listeners to all `[data-view]` sidebar elements; each calls `navigate(this.dataset.view)` and updates `location.hash`
4. Attach a `hashchange` listener on `window` to sync navigation from URL changes
5. On `DOMContentLoaded`, read `location.hash` and navigate to the matching view, defaulting to `architecture`
6. Export nothing — this is a module-free vanilla script

**Relevant Context:**
- Hash-based routing (`#architecture`, `#modules`, etc.) requires zero server configuration
- The `views` registry is the integration point for Sub-Tasks 3, 4, 5, and 6
- Active nav highlighting: toggle a Tailwind class (e.g. `bg-indigo-700`) on the active `[data-view]` element

---

### Sub-Task 3 — Implement Markdown Views: Architecture, Modules, Danger Zones

**Status:** `[ ] pending`

**Intent:**
Fetch and render the three Markdown files into `#content` using `marked.js` for HTML conversion. Architecture and Modules contain Mermaid diagram code fences that must be post-processed by `mermaid.js` after marked renders them. Danger Zones contains rich tables and emoji which need no special handling beyond standard Markdown.

**Expected Outcomes:**
- Navigating to Architecture renders `ARCHITECTURE.md` with both Mermaid diagrams visible (the state diagram and the dependency graph)
- Navigating to Modules renders `MODULES.md` with all tables and code blocks styled
- Navigating to Danger Zones renders `DANGER_ZONES.md` with the risk matrix tables and severity emoji intact
- No raw Markdown or unrendered `graph TD` / `stateDiagram` text is visible to the user
- Rendered content is contained in a readable, prose-width column with Tailwind typography classes

**Todo List:**
1. Write a `fetchText(path)` helper that uses `fetch()` and returns the response as plain text; cache results in a `Map` to avoid re-fetching on repeated navigation
2. Configure `marked.js` options: enable GFM (GitHub Flavored Markdown) for table support; do not sanitize (content is internal/trusted)
3. Write a `renderMarkdown(viewName, filePath)` async function that: fetches the file, calls `marked.parse()`, injects the resulting HTML into `#content`
4. After injecting HTML, find all `<code class="language-mermaid">` elements (which marked wraps fenced blocks in), replace their parent `<pre><code>` with a `<div class="mermaid">` containing the diagram source text
5. Call `mermaid.run()` (or `mermaid.init()` depending on version) to render the substituted `<div class="mermaid">` elements
6. Initialize `mermaid` once at app startup with `mermaid.initialize({ startOnLoad: false, theme: 'default' })`
7. Register `renderMarkdown('architecture', 'onboarding_pack/ARCHITECTURE.md')`, `renderMarkdown('modules', 'onboarding_pack/MODULES.md')`, and `renderMarkdown('danger-zones', 'onboarding_pack/DANGER_ZONES.md')` in the router's `views` registry
8. Add Tailwind `prose` class (via `@tailwindcss/typography` CDN or inline prose styling) to the content wrapper for readable markdown output

**Relevant Context:**
- `ARCHITECTURE.md` has two Mermaid blocks: a `stateDiagram-v2` (lines 25–62) and a `graph TD` (lines 175–185)
- `MODULES.md` has no Mermaid blocks; only tables and fenced code blocks (pseudocode)
- `DANGER_ZONES.md` has no Mermaid blocks; severity emojis (🔴🟠🟡🔵) are plain Unicode and render fine
- Mermaid's `startOnLoad: false` is critical — the diagrams are injected dynamically, not present at page load
- The `marked` CDN from jsDelivr exposes `marked` as a global; access via `window.marked` or `marked.parse()`

---

### Sub-Task 4 — Implement the Quiz View with Module Filtering and Flashcard Interaction

**Status:** `[ ] pending`

**Intent:**
Fetch `QUIZ.json` and render an interactive flashcard-style quiz. The user selects a module to study, sees one question at a time, reveals the answer on demand, and marks each card as "Got it" or "Review Again" to track progress within the session.

**Expected Outcomes:**
- Navigating to Quiz fetches and parses `QUIZ.json`
- A module filter bar shows the distinct modules from the JSON (`src/queue.js`, `src/promise.js`, `src/test/`) plus an "All" option
- Selecting a module filters the deck to only that module's questions
- Each flashcard shows: question text, difficulty badge, tags, and a "Show Answer" button
- Clicking "Show Answer" reveals the full answer text and shows "Got it" and "Review Again" buttons
- "Got it" advances to the next card and marks the current card green in a progress indicator
- "Review Again" advances to the next card and marks it for re-review (orange)
- After all cards in the deck are answered, a session summary shows counts of Got it vs Review Again
- The quiz state resets when the module filter changes

**Todo List:**
1. Write a `renderQuiz()` async function registered in the router's `views` registry
2. Fetch and parse `onboarding_pack/QUIZ.json`; cache the parsed array in a module-level variable
3. Extract distinct `module` values from the array; build the filter bar UI with an "All" button and one button per module
4. Write a `buildDeck(moduleFilter)` function that returns the filtered question array (or all questions if filter is "All")
5. Write a `renderCard(question, index, total)` function that renders the flashcard HTML: question text, metadata (difficulty badge, tags), and a "Show Answer" button
6. Attach a click handler to "Show Answer" that: hides itself, injects the answer text into the card, and shows the "Got it" / "Review Again" buttons
7. "Got it" handler: record result as `correct` in a session `results` array, call `advanceCard()`
8. "Review Again" handler: record result as `review` in session `results`, call `advanceCard()`
9. `advanceCard()`: if more cards remain, call `renderCard()` for the next card; if deck is exhausted, call `renderSummary()`
10. `renderSummary()`: display total cards, got-it count, review-again count, and a "Restart" button that resets state and re-renders the filter bar
11. Module filter buttons reset `results`, rebuild the deck, and render the first card
12. Style cards with Tailwind: card panel (`bg-white shadow rounded-lg p-6`), answer reveal section with a top border, tag pills (`bg-indigo-100 text-indigo-800 rounded-full px-2 py-0.5 text-xs`)

**Relevant Context:**
- QUIZ.json structure: `{ id, module, difficulty, question, answer, tags[] }` — no `options` field
- All 6 questions have `"difficulty": "expert"`
- Modules present in the data: `"src/queue.js"` (Q-QJS-1, Q-QJS-2), `"src/promise.js"` (Q-PJS-1, Q-PJS-2), `"src/test/"` (Q-TEST-1, Q-TEST-2)
- The answer text is long-form prose (200–800 chars); render as plain text in a `<p>` or `<pre>` block — no Markdown parsing needed
- Session state (deck position, results) lives in closure variables inside `renderQuiz()`; it resets on each navigation away and back

---

### Sub-Task 5 — Write `style.css`: Baseline Overrides and Polish

**Status:** `[ ] pending`

**Intent:**
Tailwind covers most styling via utility classes, but a small `style.css` is needed for cases where utility classes are impractical: Mermaid diagram container sizing, Markdown prose overrides (table borders, code block backgrounds), and custom scrollbar or transition polish.

**Expected Outcomes:**
- Mermaid diagrams render at a sensible max-width and do not overflow their container
- Markdown tables rendered by marked.js have visible borders and alternating row shading
- Code blocks in Markdown have a dark background and light text (syntax highlighting via class is fine)
- Sidebar has a smooth active-state transition
- No visual regressions on any of the four views

**Todo List:**
1. Create `style.css` with a comment header describing its purpose
2. Add `.mermaid svg { max-width: 100%; height: auto; }` to prevent diagram overflow
3. Add table styles targeting `#content table` — border-collapse, cell padding, alternating `tr:nth-child(even)` background
4. Add `#content pre` and `#content code` styles for code block appearance (background color, padding, border-radius, monospace font)
5. Add a CSS transition on sidebar nav items for hover/active state smoothness
6. Add `#content` base styles: `max-width`, `line-height`, `color` for readable prose outside the Tailwind prose plugin

**Relevant Context:**
- Tailwind play CDN does not include `@tailwindcss/typography`; prose styles must be written manually or via CDN override
- Mermaid renders inline SVG; the parent `<div class="mermaid">` becomes a `<div>` containing an `<svg>`
- DANGER_ZONES.md has very wide tables (7 columns); overflow handling (`overflow-x: auto` on `#content`) is important

---

### Sub-Task 6 — End-to-End Verification Checklist

**Status:** `[ ] pending`

**Intent:**
Manual verification pass covering all four views, navigation, Mermaid rendering, and quiz interaction to confirm the dashboard works correctly before delivery.

**Expected Outcomes:**
- All acceptance criteria below pass without errors in the browser console

**Todo List:**
1. Open `index.html` directly via `file://` protocol (no server); confirm no CORS errors block the fetch calls — note: `fetch()` of local files may be blocked on `file://`; if so, document that a simple local server (`python -m http.server` or VS Code Live Server) is required and add a note to a `README.md`
2. Architecture view: both Mermaid diagrams render as SVGs, not raw text
3. Modules view: all three API tables render with borders and visible columns
4. Danger Zones view: severity emoji display, wide tables scroll horizontally on narrow viewports
5. Quiz view — "All" filter: step through all 6 cards, reveal each answer, mark alternately Got it / Review Again, confirm summary screen shows correct counts
6. Quiz view — module filter: select `src/queue.js`, confirm only Q-QJS-1 and Q-QJS-2 appear; repeat for other modules
7. Browser back/forward: confirm hash navigation works and the correct view reloads
8. Check browser console for JS errors across all views
9. If `file://` CORS is a blocker, create a minimal `README.md` explaining how to serve locally

**Relevant Context:**
- `fetch()` from `file://` is blocked by default in Chrome and Firefox; a local HTTP server resolves this
- Mermaid and marked.js are both loaded from CDN; an internet connection is required
- No automated tests are in scope; this is a manual QA checklist

---

## File Manifest

| File | Role |
|---|---|
| `index.html` | HTML shell, CDN imports, layout, nav |
| `app.js` | Router, view renderers, quiz state machine |
| `style.css` | Mermaid overflow fix, table styles, prose overrides |
| `README.md` | Local server instructions (created only if needed in Sub-Task 6) |

## Dependency Map

```
index.html
  └── loads: Tailwind CDN, marked.js CDN, mermaid.js CDN
  └── loads: style.css, app.js

app.js
  ├── Router (hash-based)
  │     ├── view: architecture  → fetchText + marked.parse + mermaid.run
  │     ├── view: modules       → fetchText + marked.parse
  │     ├── view: danger-zones  → fetchText + marked.parse
  │     └── view: quiz          → fetch QUIZ.json + flashcard state machine
  └── reads: onboarding_pack/*.md, onboarding_pack/QUIZ.json
```
