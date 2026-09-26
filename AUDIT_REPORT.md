# Code Compass — Full-Stack Red Team Audit Report

| | |
|---|---|
| **Date** | 2025-07-14 |
| **Scope** | `index.html`, `style.css`, `app.js`, `src/queue.js`, `src/index.d.ts`, `src/package.json`, `onboarding_pack/` |
| **Methodology** | Static analysis, manual code review, cross-reference of documentation against source, WCAG 2.2 contrast evaluation, OWASP Top 10 (2021) mapping, MITRE CWE classification |
| **Auditors** | Sub-1: UI/UX Critic (WCAG 2.2) · Sub-2: Frontend Architect · Sub-3: Backend Security (OWASP/CWE) · Sub-4: Backend Systems · Sub-5: Staff Engineer (Synthesis + Documentation) |
| **Report Version** | 1.0 — Final |

---

## Executive Summary

### Finding Counts by Severity

| Severity | UX/Accessibility | Frontend Logic | Backend Security | Backend Systems | Documentation | **Total** |
|---|---|---|---|---|---|---|
| **Critical** | 9 | 3 | 2 | 2 | 0 | **16** |
| **Major** | 14 | 5 | 4 | 3 | 3 | **29** |
| **Minor** | 7 | 2 | 4 | 8 | 5 | **26** |
| **Total** | **30** | **10** | **10** | **13** | **8** | **71** |

### Top 5 Highest-Risk Items

| Rank | ID | Title | Why It Tops the List |
|---|---|---|---|
| 1 | **FE-001** | XSS via raw `marked.parse()` injected into `innerHTML` | Remote code execution in browser. Any `.md` file served (or MITM'd) with `<img onerror=...>` or `<script>` executes with full page privileges. Zero mitigations present. |
| 2 | **SEC-002** | Synchronous throw in `asyncWrapper` crashes Node process | A sync throw before `await` in a user async worker escapes all `.catch(noop)` guards and becomes an unhandled exception. Single bad task kills the entire server process. |
| 3 | **SEC-001** | Prototype pollution via unvalidated `context` parameter | Caller can pass `Object.prototype` as context; every `worker.call(this, ...)` assignment mutates the global prototype chain. Affects all objects in the process. |
| 4 | **SYS-001** | `drain()` fires while live workers are still executing | `_running <= _concurrency` in `release()` vs `_running >= _concurrency` in `push()` — the asymmetric gates allow `drain` to fire prematurely. Graceful-shutdown logic receives a false "done" signal. |
| 5 | **SEC-003** | `errorHandler` fires on ALL completions; throwing it freezes queue permanently | No `&& err` guard means success completions invoke the error handler. If the handler throws, `release()` is never called and the concurrency slot leaks forever, deadlocking the queue. |

---

## Risk Matrix

*Impact* (rows) × *Exploitability* (columns). Finding IDs placed by worst-case intersection.

|  | **Exploitability: High** | **Exploitability: Medium** | **Exploitability: Low** |
|---|---|---|---|
| **Impact: High** | FE-001, SEC-001, SEC-002, SYS-001, SYS-002, A-005, A-007, A-008, UX-002 | SEC-003, SEC-004, SEC-005, FE-002, FE-003, SYS-004, SYS-005 | SEC-006, SEC-007, SYS-003, FE-007 |
| **Impact: Medium** | A-001, A-002, A-003, A-009, CSS-001, CSS-004, UX-003 | FE-004, FE-005, FE-006, SEC-008, SEC-009, SYS-006, SYS-007, A-006, A-010, DOC-001, DOC-002 | SEC-010, SYS-008, CSS-002, CSS-003, CSS-005, CSS-006, DOC-003, DOC-004 |
| **Impact: Low** | UX-004, UX-007, A-012, A-013 | FE-008, FE-009, FE-010, SYS-009–SYS-013, CSS-007–CSS-009, UX-005–UX-009 | A-004, A-011, A-014, DOC-005, DOC-006, DOC-007, DOC-008 |

---

## Quick Wins

High-impact fixes that require one line of code or a single attribute addition.

| ID | Fix | Effort |
|---|---|---|
| **SEC-003** | Change `if (self.errorHandler)` → `if (self.errorHandler && err)` in `worked()` at line 261 of `src/queue.js` | 1 line |
| **A-005** | Add `<a href="#content" class="sr-only focus:not-sr-only">Skip to content</a>` as first child of `<body>` | 1 line |
| **A-006** | In `navigate()` in `app.js` line 299: add `el.setAttribute('aria-current', isActive ? 'page' : 'false')` | 1 line |
| **A-007** | Add `aria-live="polite" aria-atomic="true"` to `<div id="content">` in `index.html` line 86 | 1 attribute |
| **A-010** | Add `aria-hidden="true"` to all 4 SVG elements in `index.html` lines 48, 56, 64, 72 | 4 attributes |
| **A-012** | Set `document.title` inside `navigate()` in `app.js` when switching views | 1 line |
| **FE-009** | Change `content.innerHTML = \`...${err.message}...\`` → use `textContent` for the message fragment | 1 line |
| **SEC-004** | Add `Number.isFinite(value) && Number.isInteger(value)` to the concurrency setter validation at `src/queue.js` line 40 | 1 line |
| **SYS-008** | Replace `idle()` body with `return _running === 0 && queueHead === null` — eliminates O(n) walk | 1 line |
| **DOC-002** | Fix `index.d.ts` line 33 JSDoc: `err will be not null` → `err will be non-null only when an error occurred` (then fix the actual source bug, SEC-003) | 1 line |

---

## Section 1: UI/UX & Accessibility Findings

### Accessibility — WCAG 2.2

| ID | Severity | WCAG 2.2 SC | Affected File:Line | Description | Recommended Action |
|---|---|---|---|---|---|
| A-001 | Critical | SC 1.4.3 Contrast (Min) | `style.css:~45`, `index.html:87` | Blockquote text `#94a3b8` on `#2a2a3e` background = 3.7:1. Fails 4.5:1 AA threshold. Italic rendering degrades effective contrast further. | Increase blockquote text to ≥ `#b0b8cc` or darken background to pass 4.5:1. |
| A-002 | Critical | SC 1.4.3 Contrast (Min) | `style.css`, `index.html:19` | Accent color `#7c6af7` on panel bg `#2a2a3e` = 4.3:1. Fails for body-text-sized links inside blockquotes (< 18pt/14pt bold). | Adjust accent to `#8b7fff` minimum or reserve it for large/bold text only. |
| A-003 | Critical | SC 1.4.3 Contrast (Min) | `style.css`, `index.html:87` | Muted color `#8b8ba0` on `#1e1e2e` surface = 3.5:1 at 12px. Fails 4.5:1 AA. Used for loading spinner text and multiple subtitles. | Lighten muted to `#a5a5be` or higher; or increase font-size to ≥18px to apply 3:1 large-text threshold. |
| A-004 | Critical | SC 1.4.3 Contrast (Min) | `index.html:79` | Same muted `#8b8ba0` at 12px in sidebar footer ("Zero-build · Client-side only"). Fails 4.5:1 at this size. | Same as A-003: lighten or enlarge. |
| A-005 | Critical | SC 2.4.1 Bypass Blocks | `index.html:36` | No skip navigation link. Keyboard and AT users must tab through all 4 sidebar nav buttons on every page load before reaching `<main>`. | Insert `<a href="#content" class="sr-only focus:not-sr-only">Skip to main content</a>` as first child of `<body>`. |
| A-006 | Critical | SC 4.1.2 Name/Role/Value | `app.js:299` | No `aria-current` on active nav button. Screen reader users cannot identify their current location in the app. | Add `el.setAttribute('aria-current', isActive ? 'page' : 'false')` inside the `navigate()` loop. |
| A-007 | Critical | SC 4.1.3 Status Messages | `index.html:86` | `#content` div has no `aria-live` region. Dynamic content swaps (view transitions, loading states) are completely invisible to screen readers. | Add `aria-live="polite" aria-atomic="true"` to `<div id="content">`. |
| A-008 | Critical | SC 2.4.3 Focus Order | `app.js:294–312` | No focus management on view transitions. After clicking a nav button, focus stays on the button. AT users must manually navigate to the new content. | After `views[name]()` resolves, call `document.getElementById('content').focus()` (requires `tabindex="-1"` on the element). |
| A-009 | Major | SC 2.4.7 Focus Visible / SC 2.4.12 Focus Appearance (WCAG 2.2 new) | `index.html:9` (CDN script) | Tailwind CDN resets all browser default outlines. No `:focus-visible` styles defined anywhere in `style.css`. Keyboard users have zero visible focus indicator across the entire application. | Add explicit `:focus-visible` styles in `style.css`: `outline: 2px solid #7c6af7; outline-offset: 2px` minimum. |
| A-010 | Major | SC 1.1.1 Non-text Content | `index.html:48,56,64,72` | All 4 inline SVG icons lack `aria-hidden="true"`. Screen readers announce raw SVG path data as navigable text content. | Add `aria-hidden="true"` to all decorative SVGs. Ensure button text nodes provide the full accessible name. |
| A-011 | Major | SC 2.4.6 Headings and Labels | `index.html:85` | `<main>` landmark has no `aria-label`. When multiple landmarks exist, they must be distinguishable. | Add `aria-label="Main content"` to `<main>`. |
| A-012 | Major | SC 2.4.2 Page Titled | `app.js:294` | `document.title` never updated on navigation. Every view shows "Code Compass — Onboarding Dashboard". Browser history, tab titles, and AT page announcements are permanently wrong. | Add `document.title = \`Code Compass — \${viewName}\`` at the top of `navigate()`. |
| A-013 | Major | SC 2.5.3 Label in Name | `index.html:46–76` | SVG child nodes pollute the accessible name computation of each nav button. Voice control command "Click Architecture" may fail if AT computes name from mixed SVG path content. | Apply `aria-hidden="true"` to all SVGs (A-010 fix) and add explicit `aria-label` to each button as fallback. |
| A-014 | Minor | SC 1.4.4 Resize Text | `style.css:~12` / `index.html:86` | `overflow-x: hidden` on `#content` clips content at 200% zoom. Wide prose, code blocks, and tables become inaccessible. | Remove `overflow-x: hidden`; use `overflow-x: auto` and ensure inner elements handle their own overflow. |

### UX Findings

| ID | Severity | WCAG 2.2 SC | Affected File:Line | Description | Recommended Action |
|---|---|---|---|---|---|
| UX-001 | Critical | SC 1.4.3 | `index.html:87`, `app.js:34,70` | Loading state uses failing-contrast muted text with no skeleton, no structural preview, and no context. A blank pulse on dark background is contextless. | Replace with structured skeleton loader that matches the expected content layout. |
| UX-002 | Critical | — | `app.js:59–61,77–79` | No error state defined beyond generic red text. A fetch failure produces "⚠ Error loading content: Failed to fetch…" which is permanent. No retry mechanism, no actionable guidance. Also: zero `<noscript>` fallback — JS-disabled users see only a loading spinner forever. | Add a `<noscript>` tag in `index.html`. Add retry button and user-friendly error messaging. |
| UX-003 | Critical | — | `index.html:39`, `style.css` | Zero responsive design. No `@media` queries. The 240px sidebar consumes 64% of a 375px iPhone screen. The app is completely non-functional on any mobile viewport. | Implement a collapsible sidebar with a hamburger toggle for viewports < 768px. At minimum, add `@media (max-width: 768px)` rules. |
| UX-004 | Major | — | `index.html:46–76`, `app.js:295–312` | No visual active state on any nav button on initial page paint (before JS executes). All four buttons are visually identical. Users cannot determine which view is active during load. | Add `aria-current="page"` (see A-006) and apply CSS based on it, so the active state is declarative and server-renderable. |
| UX-005 | Major | — | `app.js:294–312` | No visible page heading or breadcrumb updates when navigating. The content area has no `<h1>` that changes with the view, leaving AT users and skimming sighted users without orientation. | Render a consistent `<h1>` for each view; update `document.title` (see A-012). |
| UX-006 | Major | — | `index.html:86` | Fixed `px-8` (32px) horizontal padding is non-responsive. On narrow viewports it compresses already-small content and never reduces on mobile. | Replace with `px-4 sm:px-8` or CSS clamp for fluid padding. |
| UX-007 | Major | — | `index.html:41` | App logo "Code Compass" is a plain `<span>`. It violates the universal 25-year convention that a site logo navigates to home. | Wrap in `<a href="#architecture">` or a button that calls `navigate('architecture')`. |
| UX-008 | Minor | SC 2.3.3 (AAA) | `index.html:87`, `app.js:34,70` | `animate-pulse` class on loading indicators ignores `prefers-reduced-motion`. Continuous animation can trigger vestibular disorders. | Add `@media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none; } }` to `style.css`. |
| UX-009 | Minor | SC 2.4.6 | `index.html:45` | `<nav>` has no `aria-label`. When the page has only one `<nav>`, this is acceptable; however, best practice and SR user convention expects a descriptive label. | Add `aria-label="Site navigation"` to `<nav id="sidebar-nav">`. |

### CSS / Design Failures

| ID | Severity | WCAG 2.2 SC | Affected File:Line | Description | Recommended Action |
|---|---|---|---|---|---|
| CSS-001 | Critical | SC 1.4.3 | `index.html:36`, `style.css` | Application is hardcoded dark-mode only (`class="dark"`). No `prefers-color-scheme` support. Users with light-mode system preferences or photosensitive conditions have no recourse. | Implement a `prefers-color-scheme: light` media query and/or a user-controlled toggle. |
| CSS-002 | Critical | — | `style.css:~1–10` | Custom scrollbar styled exclusively via `::-webkit-scrollbar` pseudo-elements. These are entirely unsupported in Firefox and partially in Safari. 35%+ of desktop users have broken/default scrollbars. | Use the `scrollbar-width` and `scrollbar-color` CSS properties (Firefox/standards) alongside the webkit prefix. |
| CSS-003 | Major | — | `style.css:~1` | Font stack references JetBrains Mono, Fira Code, and Cascadia Code but none have `@font-face` declarations or CDN `<link>` tags. All users receive the system monospace fallback. | Either add Google Fonts/CDN links for the desired fonts, or simplify the stack to only list system fonts. |
| CSS-004 | Major | — | `index.html:9` | Tailwind Play CDN is explicitly marked "not for production" in Tailwind's own documentation. It ships the full compiler, executes JIT at runtime, blocks initial render, and fails completely without JavaScript. | Replace with a pre-compiled Tailwind CSS build, a CDN-hosted pre-compiled version, or switch to a lightweight utility library. |
| CSS-005 | Major | SC 1.4.10 Reflow | `style.css:~12` / `index.html:86` | `overflow-x: hidden` on `#content` silently clips wide child elements. Mermaid diagrams, wide code blocks, and data tables are truncated without any scrollable overflow. | Change to `overflow-x: auto` to allow horizontal scrolling instead of clipping. |
| CSS-006 | Major | — | `index.html:36` | `overflow: hidden` on `<body>` breaks browser native Find-in-Page (Ctrl+F / Cmd+F) for content not in the visible viewport and breaks native anchor navigation. | Use `overflow: hidden` only on a wrapper element, not `<body>`, or manage scroll exclusively in `<main>`. |
| CSS-007 | Minor | — | `style.css:~60–80` | `display: block` applied to `<table>` elements for responsive overflow destroys the implicit ARIA table role. Screen readers can no longer navigate by row/column. | Use `overflow-x: auto` on a wrapper `<div>` around the table instead of changing table display semantics. |
| CSS-008 | Minor | SC 2.3.3 (AAA) | `style.css:~30` | Hover transition on `.nav-item` (color, background) ignores `prefers-reduced-motion`. | Add `@media (prefers-reduced-motion: reduce) { .nav-item { transition: none; } }`. |
| CSS-009 | Minor | SC 1.4.10 Reflow | `style.css:~65` | `white-space: nowrap` on table header cells guarantees horizontal overflow on any viewport narrower than the table. | Remove `nowrap` or replace with a responsive table strategy. |

---

## Section 2: Frontend Architecture Findings

| ID | Severity | Category | Affected File:Line | Description | Recommended Action |
|---|---|---|---|---|---|
| FE-001 | Critical | Security / XSS | `app.js:42` | `wrapper.innerHTML = html` receives raw `marked.parse()` output. `marked` does **not** sanitize HTML. Any `<img onerror=...>`, `<script>`, or `<svg onload=...>` tag inside any fetched `.md` file executes with full page privileges. No DOMPurify or equivalent present. | Pipe `marked.parse(raw)` through `DOMPurify.sanitize()` before assigning to `innerHTML`: `wrapper.innerHTML = DOMPurify.sanitize(html)`. Add DOMPurify CDN to `index.html`. |
| FE-002 | Critical | Memory Leak | `app.js:176,234,261–268` | `attachFilterListeners()` is called on every `renderCard()`, `renderSummary()`, and empty-deck render. Each call adds **new** `click` event listeners to the freshly rendered `.filter-btn` elements without removing the previous ones. Because the outer `renderQuiz` closure (and the `window` `hashchange` listener) keeps old scopes alive, listener count grows unboundedly with every card interaction. | Replace `addEventListener` accumulation with event delegation: attach a single `click` listener to a stable parent container using `e.target.closest('.filter-btn')`. |
| FE-003 | Critical | Architecture | `app.js:13,66` | `_cache` Map has no TTL, max-size cap, or cache invalidation strategy. It grows forever for the lifetime of the page session. Additionally, `_quizData` is a separate in-memory copy of the same data that `_cache` already holds as raw JSON text — two copies of the same data with different representations. | Cap `_cache` with an LRU strategy (max 10 entries for this use case). Derive quiz data from `_cache` rather than duplicating it. |
| FE-004 | Major | Security | `app.js:250` | Module names and tag values from `QUIZ.json` are interpolated directly into HTML attribute values in `renderFilterBar()` (e.g., `data-module="${m}"`). A quote character (`"` or `'`) in a module name terminates the attribute and allows attribute injection. | Use `escapeHtml()` (which already exists in `app.js:275`) on all values interpolated into HTML attributes: `data-module="${escapeHtml(m)}"`. |
| FE-005 | Major | Architecture | `app.js:294–295` | Hash router has no 404/unknown-route handler. An invalid hash silently falls back to `'architecture'` without any user notification, URL correction, or navigation guard. Mid-quiz navigation loss (e.g., typing a bad hash) is silently unrecoverable — quiz state is discarded. | Log or display an "Unknown view" message before falling back. Optionally call `history.replaceState` to correct the URL to `#architecture`. |
| FE-006 | Major | DOM/Performance | `app.js:133,176` | `content.innerHTML = ...` on every card advance rebuilds the entire DOM subtree — progress dots, filter bar, flashcard, all buttons — from scratch. Browser focus is destroyed on every card interaction. This is a string-template engine being used as a rendering framework. | Separate static structure (filter bar, card shell) from dynamic data (question text, progress dots). Only update the changing nodes. Or use `replaceChildren()` with a document fragment. |
| FE-007 | Major | Architecture / Race | `app.js:68–272` | `_quizData` is module-scoped; all session state (`deck`, `currentIndex`, `results`, `_activeModule`) lives in the `renderQuiz()` closure. A slow fetch followed by rapid hash navigation launches two concurrent `renderQuiz()` async closures writing to `#content`. The second render completes, then the first one overwrites it — producing a ghost session with stale data. | Add an AbortController to `fetchText()` and cancel in-flight requests on navigation. Or use a render generation counter and bail out if a newer render has started. |
| FE-008 | Major | Error Handling | `app.js:57–61` | `mermaid.run()` is called inside the outer `try/catch`. A diagram parse failure produces the same generic "⚠ Error loading content" message as a network failure. Mermaid rendering failures are indistinguishable from fetch failures for debugging. | Wrap `mermaid.run()` in a separate `try/catch`. On Mermaid failure, display the diagram source as a fenced code block fallback rather than a full-page error. |
| FE-009 | Minor | Security | `app.js:60,78` | Error `catch` blocks inject `err.message` raw into `innerHTML`: `` content.innerHTML = `...${err.message}...` ``. Current error messages are safe strings, but any future code path that wraps an external string (e.g., a fetch response body fragment) into an Error object would create an XSS vector. | Use `textContent` for the message fragment: create the element, set `.textContent = err.message`, then append it. |
| FE-010 | Minor | Architecture | `app.js:319` | No double-registration guard on the `DOMContentLoaded` listener. If `app.js` is loaded twice (e.g., via a dynamic script injection or a bundler mistake), two render cycles fire simultaneously, spawning two concurrent quiz sessions writing to the same `#content` element. | Add a module-level `let initialized = false` guard at the top of the `DOMContentLoaded` callback. |

---

## Section 3: Backend Security Findings

| ID | Severity | OWASP 2021 | CWE | Affected File:Line | Description | Attack Scenario | Recommended Action |
|---|---|---|---|---|---|---|---|
| SEC-001 | Critical | A03:2021 Injection | CWE-1321 | `src/queue.js:12–17,120,137,161` | `context` parameter is never validated. Caller can pass `Object.prototype` directly as context. Every `worker.call(this, ...)` and `current.context = context` assignment then mutates the global prototype, poisoning all objects in the process. | `fastqueue(Object.prototype, worker, 1)` → every subsequent `{}` in the process gains worker-injected properties. | Add guard: `if (context !== null && (typeof context !== 'object' && typeof context !== 'function') \|\| context === Object.prototype) throw new Error(...)`. Or use `Object.isFrozen()` check. |
| SEC-002 | Critical | A09:2021 Logging Failures | CWE-755 | `src/queue.js:276–281` | `asyncWrapper` calls `worker.call(this, arg)` with no `try/catch`. If the user's async function throws **synchronously** before its first `await` (e.g., argument validation), it returns a rejected Promise but the `.then()` chain is not yet established. The synchronous throw escapes `asyncWrapper`, bypasses `.catch(noop)`, and propagates as an unhandled exception, crashing the Node.js process. | `queue.push(badInput)` where `worker` does `if (!validate(task)) throw new Error(...)` synchronously → process crash. | Wrap `worker.call(this, arg)` in a `try/catch`: `try { return worker.call(this,arg).then(...,cb) } catch(e) { cb(e) }`. |
| SEC-003 | Major | A09:2021 Logging Failures | CWE-390 | `src/queue.js:261–265` | `if (self.errorHandler)` has no `&& err` check. The `errorHandler` is invoked on **every** task completion, including successes where `err === null`. Additionally, if `errorHandler` itself throws, `self.release(self)` at line 265 is never reached — the concurrency slot leaks permanently and the queue deadlocks. | Any registered error handler that throws a conditional exception (e.g., network log on non-null errors) will freeze the queue on the next successful task that accidentally triggers it. | Guard: `if (self.errorHandler && err) { ... }`. Wrap invocation in `try/finally { self.release(self) }`. |
| SEC-004 | Major | A05:2021 Security Misconfiguration | CWE-20 | `src/queue.js:39–50` | Concurrency setter validates only `!(value >= 1)`. `Infinity`, `1.5`, `NaN` (edge: `!(NaN >= 1)` is `true`, caught) pass through. `Infinity` causes an unbounded synchronous `for` loop dispatching every queued task in the current tick, blocking the event loop until the queue is empty. | Queue with 100,000 pending tasks + `queue.concurrency = Infinity` → event loop blocked for duration of all 100,000 synchronous dispatch iterations. | Change validation to: `if (!Number.isFinite(value) \|\| !Number.isInteger(value) \|\| value < 1)`. |
| SEC-005 | Major | A05:2021 Security Misconfiguration | CWE-400 | `src/queue.js:99–111` (`resume()`) | `resume()` dispatches all tasks up to `_concurrency` in a synchronous `for` loop. If workers are synchronous (non-async), each dispatch chain completes synchronously before returning, creating a fully synchronous call stack that never yields the event loop until all tasks are processed. | A pause-resume cycle on a queue with 10,000 synchronous workers blocks the event loop for the entire execution duration. | Document that sync workers are unsupported, or yield via `setImmediate`/`nextTick` inside the dispatch loop when the queue has more than N items. |
| SEC-006 | Major | A05:2021 Security Misconfiguration | CWE-362 | `src/queue.js:189–193` (`kill()`) | `kill()` does not reset `_running`. In-flight workers complete after `kill()` and their `worked()` callbacks call `release()`, which finds `_running` > 0 and `queueHead === null`, decrements `_running`, and fires `self.drain()`. But `kill()` already set `self.drain = noop`. This is benign in isolation, but if a new queue is constructed from the same `drain` reference before `kill()` returns, the post-kill drain fires on the wrong queue's drain handler. | Pattern: save `old = q.drain`, call `q.kill()`, create new queue reusing the handler. Old workers completing fire drain on the new queue. | Reset `_running = 0` in `kill()` or document that `kill()` does not interrupt in-flight workers and that drain may still fire post-kill. |
| SEC-007 | Major | A05:2021 Security Misconfiguration | CWE-362 | `src/queue.js:202–236` (`abort()`) | `abort()` calls `callback.call(context, new Error('abort'))` at line 226 **before** `cache.release(current)` at line 230. If the callback calls `queue.push()` (retry-on-abort pattern), `cache.get()` may return a `Task` object that is still mid-iteration in the `abort()` while-loop if the pool is empty and reusify reuses the just-in-progress node. | High-throughput abort-retry loop with pool exhaustion → task object aliasing → two concurrent logical tasks sharing one `Task` struct → value/callback corruption. | Move `cache.release(current)` to **before** `callback.call(...)`, or capture all fields before the callback and release immediately after field capture. |
| SEC-008 | Minor | A05:2021 Security Misconfiguration | CWE-400 | `src/queue.js:75–85` (`length()`) | `length()` is an O(n) linked-list walk. `idle()` at line 113–115 calls `self.length()` internally, making `idle()` also O(n). Any polling loop that calls `idle()` or `length()` in a hot path creates unbounded CPU consumption proportional to queue depth. | `setInterval(() => { if (queue.idle()) doWork() }, 10)` with 1,000 queued items → 100 O(1000) walks per second = 100,000 pointer chases per second. | Cache queue length as a counter incremented/decremented on enqueue/dequeue. Replace `idle()` with `return _running === 0 && queueHead === null` (O(1)). |
| SEC-009 | Minor | A03:2021 Injection | CWE-843 / CWE-20 | `src/queue.js:123,147` | `current.callback = done \|\| noop` accepts any truthy value without verifying `typeof done === 'function'`. A non-function truthy value (e.g., `{}`, `true`, `1`) passes silently. At `callback.call()` time (line 264), a `TypeError` throws, which — combined with SEC-003 — means `self.release(self)` is never called. Concurrency slot leaks permanently. | `queue.push(task, "notAFunction")` → TypeError on completion → queue deadlock. | Add `if (done && typeof done !== 'function') throw new TypeError('callback must be a function')` in both `push()` and `unshift()`. |
| SEC-010 | Minor | A06:2021 Vulnerable Components | CWE-20 | `src/index.d.ts:16–31`, `src/package.json` | `kill()`, `pause()`, `resume()`, `abort()` are typed as returning `any` in `index.d.ts`. This suppresses TypeScript's ability to catch misuse of return values. Additionally, `reusify` is pinned with `^1.0.4` semver range — a compromised patch release could introduce stale `Task` object fields, leaking sensitive task data across queue consumers via the object pool. | Supply-chain attack on `reusify` patch release → sensitive task values from previous consumer visible in next consumer's task object. | Fix return types to `void`. Pin `reusify` to an exact version (`1.0.4`) and verify integrity via `package-lock.json` / npm audit. |

---

## Section 4: Backend Systems Findings

| ID | Severity | Category | Affected File:Line | Description | Impact | Recommended Action |
|---|---|---|---|---|---|---|
| SYS-001 | Critical | Concurrency | `src/queue.js:170` vs `126,150` | `release()` uses `_running <= _concurrency` (permits dispatch at exactly-at-capacity), while `push()`/`unshift()` use `_running >= _concurrency` (blocks at-capacity). This asymmetry means: when `_running` equals `_concurrency`, `push()` queues new tasks (correctly), but `release()` dispatches from the queue (incorrectly). Net result: a momentary over-concurrency of exactly 1. For `concurrency=1` queues this means two workers run simultaneously, violating the serial execution guarantee. | Drain can fire while `_running > 0`; serial queues lose their serial guarantee; integration logic depending on single-threaded execution ordering breaks silently. | Standardize both gates to `_running < _concurrency`. Audit all five comparison sites in `queue.js` for consistency. |
| SYS-002 | Critical | Lifecycle | `src/queue.js:102–105` (`resume()`) | When `resume()` is called on a queue where `queueHead === null` (empty queue, all tasks in-flight), the code unconditionally executes `_running++; release()`. `release()` finds no queue item → decrements `_running` → if `_running` reaches 0, fires `drain()`. This is a **spurious drain** on an idle-but-running queue, and a **spurious `_running` increment** that permanently inflates the counter. Note: the actual code condition is `if (queueHead === null)` with **no** `_running > 0` guard — the bug fires even when `_running === 0`. | `drain()` fires before all workers complete. `idle()` returns false incorrectly. Graceful shutdown receives false "done" signal. `_running` counter desync is permanent for the queue's lifetime. | Remove the `if (queueHead === null)` branch from `resume()` entirely; `release()` already handles the non-empty case correctly when called from the `for` loop below. |
| SYS-003 | Major | Memory | `src/queue.js:165–187` | `reusify` sets `obj.next = freeHead` on `cache.release()`, but `push()`/`unshift()` do **not** zero `current.next` after `cache.get()`. If a Task retrieved from the pool still has a stale `next` pointer from a previous queue cycle, and that task becomes the sole item in the queue (`queueHead === queueTail`), then `queueHead = next.next` at line 175 sets `queueHead` to the stale freelist pointer instead of `null`. The queue then believes it has a next task when it does not. | Phantom queue entries. Workers dispatched with `undefined` values. `empty()` and `drain()` never fire. | After `cache.get()`, explicitly zero the pointer: `current.next = null`. |
| SYS-004 | Major | Memory | `src/queue.js:189–193` (`kill()`) | `kill()` sets `queueHead = null; queueTail = null` directly, without traversing the linked list to release nodes back to `cache`. The entire pending task linked list is orphaned — those `Task` objects never return to the `reusify` pool. Compare with `abort()` (lines 202–236) which correctly iterates and calls `cache.release(current)` for every node. | Object pool depletion after repeated `kill()` calls. `cache.get()` allocates new objects instead of reusing pooled ones. GC pressure proportional to queue depth at kill time. Memory leak scales with queue depth × kill frequency. | Traverse the linked list in `kill()` and call `cache.release(current)` for each node, mirroring `abort()`'s iteration pattern. |
| SYS-005 | Major | Lifecycle | `src/queue.js:195–200` (`killAndDrain()`) | `killAndDrain()` calls `self.drain()` synchronously at line 198, then sets `self.drain = noop` at line 199. If workers are in-flight when `killAndDrain()` is called, `drain()` fires with `_running > 0`. In-flight workers completing later will call `release()`, which (with `_running > 0`, empty queue) decrements and may fire `drain()` again — but `drain` is now `noop`, so the second drain is silently dropped. The user's drain callback received a premature "done" signal. | Graceful shutdown code that awaits `drain` before tearing down resources (DB connections, server close) proceeds while workers are still executing. Data loss / torn writes possible. | Do not call `self.drain()` immediately in `killAndDrain()`. Instead, let in-flight workers complete naturally and fire the real drain through `release()`. Only suppress further drains after the legitimate one fires. |
| SYS-006 | Minor | Lifecycle | `src/queue.js:126–134,150–158` | `saturated()` fires only when the first item is queued into a previously-empty queue (`queueTail === null` check). Subsequent pushes while the queue is non-empty and the system is at capacity produce no `saturated()` event. Consumers using `saturated` for backpressure signaling only receive one notification per saturation cycle. | Backpressure systems that count `saturated` events miss all but the first. Rate limiters based on `saturated` undercount saturation. | Document this single-fire-per-saturation-cycle behavior explicitly. Consider adding an `oversaturated` callback or changing to fire on every at-capacity push. |
| SYS-007 | Minor | Lifecycle | `src/queue.js:177–179` | `empty()` fires when the last item is **dequeued** from the queue (handed to a worker), not when it **completes**. At fire time, `_running >= 1`. User code in the `empty()` callback that attempts teardown or relies on "no active work" semantics races the live worker. | Teardown logic in `empty` callback runs while a worker is still executing. For example, closing a database connection in `empty()` causes the live worker's DB query to fail. | Rename or re-document `empty()` as "queue exhausted (last item dispatched)". If "all work complete" semantics are needed, `drain()` is the correct callback. |
| SYS-008 | Minor | Performance | `src/queue.js:113–115` | `idle()` calls `self.length()`, which is an O(n) linked-list walk. The correct O(1) implementation is `return _running === 0 && queueHead === null`. Every `idle()` call incurs unnecessary O(n) cost. | O(n) per `idle()` call; polling patterns become quadratic. | Replace `idle()` body with `return _running === 0 && queueHead === null`. |
| SYS-009 | Minor | Test Gap | `src/test/test.js` (absent) | No test asserts exact worker fan-out count after `pause()` → `concurrency++` → `resume()` sequence. The interaction between the concurrency setter's dispatch loop and `resume()`'s dispatch loop is untested. | SYS-001 and SYS-002 bugs would not be caught by the current test suite in this combined-scenario form. | Add test: pause queue with N items, increase concurrency from 1 to 3, resume, assert exactly 3 workers start simultaneously. |
| SYS-010 | Minor | Test Gap | `src/test/test.js` (absent) | No test verifies `killAndDrain()` ordering semantics when multiple workers are in-flight. The SYS-005 bug (premature drain) is not caught. | `killAndDrain()` drain timing bug goes undetected in CI. | Add test: push 3 tasks to concurrency-3 queue, call `killAndDrain()` while all 3 are running, assert drain fires only after all 3 `worked()` callbacks have returned. |
| SYS-011 | Minor | Test Gap | `src/test/test.js` (absent) | All `abort()` tests pause the queue first, then abort. No test exercises `abort()` while a worker is actively mid-execution. The SEC-007 use-after-free race is not covered. | Pool aliasing bug (SEC-007) goes undetected. | Add test: push 2 tasks to concurrency-1 queue without pausing, call `abort()` while first task is running, assert second task's callback receives `Error('abort')` and pool is clean. |
| SYS-012 | Minor | Test Gap | `src/test/test.js` (absent) | `concurrency = Infinity` is silently accepted by the setter. The event-loop blocking behavior (SEC-004) is never asserted. | Infinity concurrency DoS vector ships untested. | Add test: set `queue.concurrency = Infinity` while queue has items, assert all items are dispatched but no exception is thrown (to document current behavior), then separately assert this is caught when `Number.isFinite` validation is added. |
| SYS-013 | Minor | Test Gap | `src/test/test.js` (absent) | `empty()` callback at `concurrency > 1` is never tested; the fire-count and the `_running` value at time of fire are unverified. | SYS-007's semantics (empty fires with `_running >= 1`) go unverified. Consumers may incorrectly assume `_running === 0` inside `empty()`. | Add test: concurrency-3 queue, push 5 tasks, assert `empty()` fires exactly once, assert `queue.running() >= 1` at fire time, assert `drain()` fires after `empty()`. |

---

## Section 5: Documentation Accuracy Findings

| ID | Severity | Affected File | Inaccurate Claim | Correct Reality | Recommended Action |
|---|---|---|---|---|---|
| DOC-001 | Major | `onboarding_pack/ARCHITECTURE.md:112` | Resume edge case described as: "if queue EMPTY but `_running > 0`: spurious `_running++`" — implies the branch fires only when workers are active. | Actual code (`src/queue.js:102–105`): the branch fires when `queueHead === null` with **no** `_running > 0` guard. It fires even when `_running === 0` (e.g., empty idle queue resumed after a no-op pause). The severity and trigger condition are both wider than documented. | Update §4 to: "if queue is empty (`queueHead === null`), regardless of `_running` value: spurious `_running++`" and note that SYS-002 fires even on zero-running queues. |
| DOC-002 | Major | `src/index.d.ts:33` | JSDoc for `error()` method states: "err will be not null if the task has thrown an error" — implying the handler fires only on errors. | Actual behavior (confirmed by `src/queue.js:261`): errorHandler fires for ALL task completions, including successes where `err === null`. The JSDoc is factually incorrect and will cause every consumer who reads the types to register broken error handlers. | Update JSDoc to: "handler is called for every task completion; check `err !== null` inside the handler to filter actual errors." Then fix the underlying bug (SEC-003). |
| DOC-003 | Major | `onboarding_pack/QUIZ.json:Q-QJS-2` (answer) | Answer states the over-concurrency scenario results in `_running=3` from a concurrency=1→2 change: "the setter loop increments `_running` to 2, calls release which checks `2 <= 2`, dispatches a **third** worker, making `_running=3`." | `release()` does **not** increment `_running` — the calling loop does (`_running++; release()`). The setter loop exits after dispatching one worker (making `_running=2`). The over-concurrency occurs because `release()` at `_running=2, _concurrency=2` finds `2 <= 2` true and dispatches one more worker (from the queue), but `_running` stays at 2 because the `_running++` was already done by the loop. The maximum transient `_running` is `_concurrency + 1` in the worst case, not the arithmetic in the answer. | Correct Q-QJS-2 answer to accurately trace the `_running` counter through each step of the setter loop + `release()` interaction. |
| DOC-004 | Major | `onboarding_pack/DANGER_ZONES.md:DZ-Q2 code snippet` | Code snippet shows `} else if (self._running > 0) {` as the condition in `resume()`. | Actual code at `src/queue.js:102–105` is `if (queueHead === null) {` — unconditional on `_running`. There is no `else if` and no `_running > 0` check. The documented code pattern does not exist in the source. | Replace the code snippet with the actual source code. Update the scenario description to reflect that the bug fires regardless of `_running` value. |
| DOC-005 | Minor | `onboarding_pack/MODULES.md:§1.1` | `abort` side effects description: "calls each task's `errorHandler(err,val)` + `callback(err)`" — implies callback receives only one argument. | Actual code at `src/queue.js:226`: `callback.call(context, new Error('abort'))` — callback receives only the error, no second argument. The signature matches `done(err)` not `done(err, result)`. This is accurate for callback behavior but the side effects column omits `self.drain = noop` which `abort()` also does (line 235). | Add "resets `drain` to `noop`" to `abort` side effects. Clarify callback signature as `done(err)` with no result argument on abort path. |
| DOC-006 | Minor | `onboarding_pack/MODULES.md:§1.1` | `unshift` side effects: "fires `saturated()`" — implies it fires like a general at-capacity signal. | Actual code (lines 150–158): `saturated()` only fires on `unshift` when `queueHead` was null (first item added to an empty queue while at capacity). Subsequent `unshift` calls while queue is non-empty never fire `saturated()`. Same partial inaccuracy as for `push`. | Add note: "`saturated()` fires only on the transition from empty to non-empty queue while at capacity (not on every enqueue)." |
| DOC-007 | Minor | `onboarding_pack/ARCHITECTURE.md:§4` | Pause/resume flow states: "`resume()` if queue EMPTY: loop, `_running++`, call `release()` → drains queue up to concurrency limit". This suggests the loop only runs when the queue is non-empty. | The actual flow has two separate branches: (1) `if (queueHead === null)` fires the spurious increment; (2) the `for` loop runs when queue IS non-empty. The diagram conflates both into one flow path. | Separate the two branches visually in the §4 flow diagram. Label the `if (queueHead === null)` path clearly as the bug path. |
| DOC-008 | Minor | `onboarding_pack/MODULES.md:§3.1` | States "tape \| 32" tests in `test.js` and "~24" for `promise.js`. | The `~` qualifier on promise test count signals uncertainty. The test file should be counted precisely for documentation accuracy. More critically, MODULES.md does not document the known test gap findings (SYS-009 through SYS-013) — the test inventory presents the suite as more comprehensive than it is by listing only what exists, not what is absent. | Count tests exactly. Add a "Known Coverage Gaps" row or section to §3.2 cross-referencing SYS-009–SYS-013. |

---

## Appendix: Standards Cross-Reference

### WCAG 2.2 Success Criteria

| WCAG 2.2 SC | Title | Finding IDs |
|---|---|---|
| SC 1.1.1 | Non-text Content | A-010 |
| SC 1.4.3 | Contrast (Minimum) | A-001, A-002, A-003, A-004, UX-001 |
| SC 1.4.4 | Resize Text | A-014 |
| SC 1.4.10 | Reflow | CSS-005, CSS-009 |
| SC 2.3.3 | Animation from Interactions (AAA) | UX-008, CSS-008 |
| SC 2.4.1 | Bypass Blocks | A-005 |
| SC 2.4.2 | Page Titled | A-012 |
| SC 2.4.3 | Focus Order | A-008 |
| SC 2.4.6 | Headings and Labels | A-011, UX-009 |
| SC 2.4.7 | Focus Visible | A-009 |
| SC 2.4.12 | Focus Appearance (WCAG 2.2 new) | A-009 |
| SC 2.5.3 | Label in Name | A-013 |
| SC 3.2.3 | Consistent Navigation | UX-004 |
| SC 4.1.2 | Name, Role, Value | A-006 |
| SC 4.1.3 | Status Messages | A-007 |

### OWASP Top 10 (2021)

| OWASP Category | Title | Finding IDs |
|---|---|---|
| A03:2021 | Injection | SEC-001, SEC-009, FE-001, FE-004 |
| A05:2021 | Security Misconfiguration | SEC-004, SEC-005, SEC-006, SEC-007, SEC-008 |
| A06:2021 | Vulnerable and Outdated Components | SEC-010, CSS-004 |
| A09:2021 | Security Logging and Monitoring Failures | SEC-002, SEC-003 |

### MITRE CWE

| CWE ID | Title | Finding IDs |
|---|---|---|
| CWE-20 | Improper Input Validation | SEC-004, SEC-009, SEC-010 |
| CWE-79 | XSS (Improper Neutralization) | FE-001, FE-004, FE-009 |
| CWE-362 | Race Condition | SEC-006, SEC-007 |
| CWE-390 | Detection of Error Condition Without Action | SEC-003 |
| CWE-400 | Uncontrolled Resource Consumption | SEC-004, SEC-005, SEC-008 |
| CWE-401 | Memory Leak (missing release) | SYS-003, SYS-004, FE-002, FE-003 |
| CWE-674 | Uncontrolled Recursion | SEC-005 |
| CWE-755 | Improper Handling of Exceptional Conditions | SEC-002, SEC-003 |
| CWE-843 | Type Confusion / Access of Wrong-Type Resource | SEC-009, SEC-010 |
| CWE-1321 | Prototype Pollution | SEC-001 |

---

*Report generated by the Code Compass Red Team — Principal Staff Engineer synthesis pass.*
