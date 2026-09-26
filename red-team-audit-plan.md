# Red Team Audit — Execution Plan

## Top-Level Overview

**Goal:** Execute a 5-agent Red Team audit of the Code Compass workspace — a zero-build client-side SPA (frontend) backed by the `fastq` high-performance queue library (backend). Four specialist subagents audit their scoped targets in parallel, then a synthesis agent aggregates every finding into `/AUDIT_REPORT.md`.

**Scope:**
- Frontend audit: `index.html`, `style.css`, `app.js`
- Backend audit: `src/queue.js`, `src/index.d.ts`, `src/package.json`, `src/bench.js`, `src/test/`
- Synthesis: workspace root

**Non-Goals:**
- No code changes are made during this phase
- No fixes are implemented — findings only

**In Scope (clarified):**
- `onboarding_pack/` markdown content files (`ARCHITECTURE.md`, `MODULES.md`, `DANGER_ZONES.md`, `QUIZ.json`) are IN SCOPE for Subagent 5 — reviewed for documentation accuracy against the actual source code

**Orchestration Model:**
- Subagents 1–4 run in **parallel**
- Subagent 5 runs **after** 1–4 complete, consuming their outputs via `fork_context: true` — no intermediate files written to disk
- Only `/AUDIT_REPORT.md` is written to disk

---

## Sub-Task 1 — Brutal UI/UX Audit (Frontend: index.html, style.css)

**Status:** [ ] pending

**Intent:** A maximally harsh UX and accessibility critic tears apart every visual, structural, and accessibility decision in `index.html` and `style.css`. No complaint is too minor. The goal is to surface every real user-facing failure.

**Persona:** Extremely harsh, unforgiving design critic — zero tolerance for mediocrity.

**Expected Outcomes:**
- A numbered list of UX flaws (information hierarchy, navigation affordance, empty state handling)
- A numbered list of accessibility violations (WCAG 2.1 Level AA compliance: missing ARIA roles, contrast ratios, keyboard nav, focus management, screen reader traps)
- A numbered list of CSS/design failures (inconsistent spacing, fragile layout, scrollbar styling hacks, print unsuitability)
- Severity rating (Critical / Major / Minor) for each finding

**Standards Reference:** WCAG 2.2 (Level AA conformance target)

**Todo List:**
1. Read `index.html` in full — audit DOM structure, semantic HTML, ARIA attributes, landmark roles, tab order, focus traps
2. Read `style.css` in full — audit contrast ratios against WCAG 2.2 SC 1.4.3 (minimum 4.5:1 normal text, 3:1 large text), hover/focus states against SC 1.4.11 and SC 2.4.11 (Focus Appearance), mobile responsiveness
3. Check CDN-loaded Tailwind Play JIT — identify concerns about production unsuitability, CLS, FOUC risk; reference WCAG 2.2 SC 1.4.13 (Content on Hover or Focus) for any tooltip/overlay patterns
4. Audit the sidebar nav — `data-view` buttons: are they `<button>` or `<a>`? Missing `aria-current` (SC 4.1.2), `aria-label`, landmark role (`<nav>`)
5. Audit the `#content` div as a dynamic region — missing `aria-live` region (SC 4.1.3 Status Messages); no loading/error state announced to assistive tech
6. Assess the overall dark-mode-only design — no `prefers-color-scheme` support; check WCAG 2.2 SC 1.4.3 contrast on the specific hex palette (#1e1e2e bg, #a5b4fc code text, #7c6af7 accent)
7. Check keyboard navigation completeness — WCAG 2.2 SC 2.1.1 (Keyboard), SC 2.4.3 (Focus Order), SC 2.4.7 (Focus Visible), SC 2.4.12 (Focus Appearance — new in 2.2)
8. Check for WCAG 2.2 SC 2.5.3 (Label in Name) on SVG icon buttons, SC 3.2.3 (Consistent Navigation) across views
9. Compile findings into a structured critique block for Subagent 5, citing the specific WCAG 2.2 Success Criterion for each violation

**Relevant Context:**
- `index.html` (93 lines): 4 `data-view` nav buttons, CDN Tailwind/marked/mermaid, sidebar + main layout, `id="content"` target div
- `style.css` (182 lines): `.prose-dark`, `.mermaid`, table styles, `.nav-item` transitions, webkit scrollbar overrides
- Dark palette: surface #1e1e2e, panel #2a2a3e, border #3b3b54, accent #7c6af7

---

## Sub-Task 2 — Frontend Architecture Audit (app.js)

**Status:** [ ] pending

**Intent:** A 50-year frontend architecture veteran dissects the client-side JavaScript for architectural rot, memory leaks, inefficient DOM operations, and state management failures. Nothing is excused by "it's just a demo."

**Persona:** Elite, uncompromising 50-year web architecture veteran.

**Expected Outcomes:**
- A numbered list of architectural flaws (routing design, state management, coupling)
- A numbered list of memory leak vectors (detached DOM nodes, unremoved event listeners, unbounded cache growth)
- A numbered list of DOM repaint / layout thrash inefficiencies
- A numbered list of security-relevant frontend issues (XSS via innerHTML, markdown injection)
- Severity rating for each finding

**Todo List:**
1. Read `app.js` in full (329 lines)
2. Audit the `_cache` Map — unbounded growth, no TTL, no size cap, cache invalidation strategy absent
3. Audit `renderMarkdown` — `innerHTML` assignment of server-fetched, marked-parsed content: XSS surface; mermaid string injection via `language-mermaid` blocks
4. Audit the quiz state machine — closure variables (`deck`, `currentIndex`, `results`, `_activeModule`): module-level mutable state, no encapsulation, no reset on re-entry
5. Audit `renderCard()` and `renderSummary()` — check for innerHTML template literal injection with `escapeHtml` usage vs. raw interpolation
6. Audit `attachFilterListeners()` — called on every render; check for listener accumulation on re-render
7. Audit the hash router — no 404/unknown route handling; no navigation guard; hash manipulation XSS risk
8. Audit `mermaid.run()` invocations — called after every markdown render; check for duplicate render calls on same element
9. Assess the `fetchText` error propagation — no user-visible error UI on fetch failure beyond a thrown exception
10. Compile findings into a structured critique block for Subagent 5

**Relevant Context:**
- `app.js` (329 lines): `_cache` Map, `fetchText`, `renderMarkdown`, quiz closure state (`deck`, `currentIndex`, `results`, `_activeModule`), `escapeHtml`, hash router, `navigate()`, `views` registry
- Known pattern: `innerHTML` used for Mermaid injection at `renderMarkdown` line ~50 area
- Known pattern: `attachFilterListeners()` called inside `renderFilterBar()` which is called inside `renderQuiz()` on every state transition

---

## Sub-Task 3 — Backend Security Audit (src/)

**Status:** [ ] pending

**Intent:** A paranoid 30-year cybersecurity veteran hunts for every exploitable vulnerability in the fastq backend: prototype pollution, unhandled rejections that crash Node processes, event-loop blocking, and race conditions under adversarial input.

**Persona:** Paranoid, adversarial cybersecurity veteran — assumes all inputs are malicious.

**Expected Outcomes:**
- A numbered list of prototype pollution vectors
- A numbered list of unhandled promise rejection crash paths
- A numbered list of event-loop blocking / denial-of-service vectors
- A numbered list of race conditions and TOCTOU bugs
- A numbered list of type-confusion / input validation gaps in the public API
- Severity rating for each finding

**Standards Reference:** OWASP Top 10 (2021) and MITRE CWE classifications

**Todo List:**
1. Read `src/queue.js` in full (354 lines)
2. Audit `fastqueue(context, worker, _concurrency)` — prototype pollution via `context` object (CWE-1321: Improperly Controlled Modification of Object Prototype Attributes): can a caller pass `Object.prototype` or `__proto__` as context? Does `this` binding to context pollute the prototype chain? Map to OWASP A03:2021 (Injection)
3. Audit `concurrency` setter — input validation gap (CWE-20: Improper Input Validation): only checks `isNaN`, misses `Infinity`, negative values, floats; could allow over-concurrency. Map to OWASP A05:2021 (Security Misconfiguration)
4. Audit `Task.prototype.worked` — errorHandler fires for ALL completions (CWE-755: Improper Handling of Exceptional Conditions): line 261–264 bug. Adversarial: if errorHandler throws, does it propagate uncaught and crash the process?
5. Audit `queueAsPromised` — `asyncWrapper` + `.catch(noop)` pattern (CWE-390: Detection of Error Condition Without Action): confirm unhandledRejection suppression is complete; check edge case of synchronous throw inside async worker; map to OWASP A09:2021 (Security Logging and Monitoring Failures) — errors silently swallowed
6. Audit `resume()` — calls `_release()` in a loop (CWE-400: Uncontrolled Resource Consumption): with a large concurrency delta, synchronous loop can block the event loop; classify as DoS vector
7. Audit `abort()` — walks the linked list calling callbacks (CWE-674: Uncontrolled Recursion / CWE-835: Loop with Unreachable Exit Condition): if a callback synchronously calls `push()` again, is there an infinite loop risk?
8. Audit `length()` — O(n) linked-list walk (CWE-400: Uncontrolled Resource Consumption): DoS vector if polled externally with large queue
9. Audit `kill()` / `killAndDrain()` — race condition (CWE-362: Concurrent Execution Using Shared Resource with Improper Synchronization): worker completing after `kill()` may trigger `drain` unexpectedly
10. Audit `src/package.json` — dependency surface: `reusify` as sole runtime dep; flag supply-chain risk (OWASP A06:2021 Vulnerable and Outdated Components)
11. Audit `src/index.d.ts` — TypeScript type safety gaps: `drain` typed as `any`, `kill()` returns `any`; type confusion attack surface (CWE-843: Access of Resource Using Incompatible Type)
12. Compile findings into a structured critique block for Subagent 5, citing OWASP category and CWE ID for each finding

**Relevant Context:**
- `src/queue.js` (354 lines): `fastqueue()`, `Task` constructor, `queueAsPromised()`, `asyncWrapper`, `_release`, `abort`, `resume`, `length`, `kill`, `killAndDrain`
- Known bugs from QUIZ.json: Q-QJS-1 (errorHandler fires for all completions), Q-QJS-2 (inconsistent `<` vs `<=` concurrency check at lines 46 vs 170)
- `src/index.d.ts` (59 lines): TypeScript interface — audit for type safety gaps (e.g. `drain` typed as `any`, `kill()` returns `any`)

---

## Sub-Task 4 — Backend Systems Audit (src/)

**Status:** [ ] pending

**Intent:** A hardened 30-year systems engineer dissects the concurrency model, object pooling strategy, worker lifecycle, and memory behavior of fastq under stress — particularly during queue drain, pause/resume, and high-concurrency edge cases.

**Persona:** Hardened, demanding systems engineer who has debugged production outages at 3am.

**Expected Outcomes:**
- A numbered list of concurrency model flaws (fencepost errors, over-concurrency paths)
- A numbered list of object pooling defects (reusify lifecycle, object resurrection risks)
- A numbered list of memory management failures (linked-list leak paths, unbounded growth scenarios)
- A numbered list of lifecycle callback reliability issues (drain, saturated, empty callback ordering guarantees)
- A numbered list of test coverage gaps

**Todo List:**
1. Read `src/queue.js` in full (354 lines)
2. Audit the linked-list implementation — `queueHead`/`queueTail` management: can `queueTail` become stale (detached node), leaving orphaned tasks unreachable?
3. Audit the `_running < _concurrency` vs `_running <= _concurrency` fencepost at lines 46 and 170 — model the exact scenario where concurrency is over-saturated
4. Audit `reusify` object pool integration — `cache.get()` / `cache.release(holder)`: is `holder.next` properly nulled before release? Object resurrection risk if `next` pointer is not cleared
5. Audit `pause()` then dynamic `concurrency` increase via setter — workers that resume must not bypass the `_paused` flag; trace the code path
6. Audit `saturated` callback — does it fire once per saturation event or on every `push` at capacity? Confirm the exact condition
7. Audit `empty` callback — fires when last task is dequeued; is there a window between dequeue and worker completion where `idle()` returns false but queue appears empty?
8. Audit `drain` callback — can it fire before all workers complete? Trace `_release` → `drain` invocation path
9. Audit `killAndDrain` — calls `drain` then kills; if workers are still in-flight when `drain` is called, does `killAndDrain` wait correctly?
10. Read `src/test/test.js` and `src/test/promise.js` — identify gaps: are pause + concurrency-change interactions tested? Is abort-during-active-worker tested?
11. Compile findings into a structured critique block for Subagent 5

**Relevant Context:**
- `src/queue.js` (354 lines): `_running`, `queueHead`/`queueTail`, `_release`, `pause`, `resume`, `saturated`, `empty`, `drain`, `kill`, `killAndDrain`, `cache.get/release`
- `src/test/test.js` (~808 lines, 30+ tests): concurrency, pause/resume, abort, drain, lifecycle hooks
- `src/test/promise.js` (~356 lines, 25+ tests): drained(), error flow, unhandledRejection
- Known fencepost: line 46 uses `<`, line 170 uses `<=` — likely over-concurrency by 1 in `_release`

---

## Sub-Task 5 — Synthesis: Write /AUDIT_REPORT.md

**Status:** [ ] pending

**Intent:** The Principal Staff Engineer aggregates every critique from Subagents 1–4 into a single, authoritative, highly structured audit report, AND reviews the `onboarding_pack/` documentation files for accuracy against the actual source code. The report is written to `/AUDIT_REPORT.md` at the workspace root. This subagent runs ONLY after all four audit subagents have completed, receiving their in-memory findings via `fork_context: true`.

**Persona:** Principal Staff Engineer — exacting, structured, no finding left behind.

**Expected Outcomes:**
- `/AUDIT_REPORT.md` written to disk at workspace root
- Report contains all findings from all four auditors, deduplicated and cross-referenced
- Each finding has: ID, Severity, Category, Affected File + Line (if known), Description, Recommended Action
- An Executive Summary section with total counts by severity
- A Risk Matrix section ranking findings by impact × exploitability
- A Quick Wins section (low-effort, high-impact fixes)

**Todo List:**
1. Collect all structured critique blocks from Subagents 1–4 (available via fork_context — no disk reads required)
2. Deduplicate any overlapping findings between the security auditor (Sub-3) and systems auditor (Sub-4)
3. Assign unique finding IDs: `UX-###` for Subagent 1, `FE-###` for Subagent 2, `SEC-###` for Subagent 3, `SYS-###` for Subagent 4, `DOC-###` for documentation accuracy findings
4. **Documentation Accuracy Review** — read each file in `onboarding_pack/`:
   - `ARCHITECTURE.md` — verify Mermaid diagrams match actual `src/queue.js` state machine and data flow
   - `MODULES.md` — verify API table entries match the actual exported methods, signatures, and return types in `src/queue.js` and `src/index.d.ts`
   - `DANGER_ZONES.md` — verify risk entries match confirmed bugs (e.g. the `<`/`<=` fencepost, errorHandler-on-all-completions); flag any documented risks that are inaccurate or understated
   - `QUIZ.json` — verify question/answer accuracy for all 6 cards against the actual source; flag any incorrect answers
5. Write an Executive Summary: total findings by severity (Critical/Major/Minor) across all five categories, top 3 highest-risk items
6. Write the full findings table with fields: ID, Severity, Category, Affected File + Line, Description, WCAG/OWASP/CWE reference (where applicable), Recommended Action
7. Write the Risk Matrix: 2D grid of Impact vs. Exploitability, each cell containing relevant finding IDs
8. Write the Quick Wins section: findings where fix effort is low and impact is high
9. Write the Documentation Accuracy section: list all `DOC-###` findings with the inaccurate claim, the correct reality, and the affected file
10. Write the full report to `/AUDIT_REPORT.md` using `write_file`
11. Verify the file was written successfully

**Relevant Context:**
- Workspace root: `index.html`, `app.js`, `style.css`, `README.md`
- Backend: `src/queue.js` (354 lines), `src/index.d.ts`, `src/package.json`
- Documentation: `onboarding_pack/ARCHITECTURE.md`, `onboarding_pack/MODULES.md`, `onboarding_pack/DANGER_ZONES.md`, `onboarding_pack/QUIZ.json`
- Report path: `/AUDIT_REPORT.md` (workspace root)
- All finding IDs from Sub-1 through Sub-5 must appear in the report — no omissions
- Findings are received purely via conversation context (fork_context: true) — no intermediate files to read

---

## Orchestration Pipeline

```
Phase 1 (Parallel):
  ┌─────────────────────────────────────────────────────────────┐
  │  Sub-1: UI/UX Critic     → index.html + style.css           │
  │  Sub-2: FE Architect     → app.js                           │
  │  Sub-3: Security Auditor → src/queue.js + related           │
  │  Sub-4: Systems Veteran  → src/queue.js + test/             │
  └─────────────────────────────────────────────────────────────┘
                          ↓ (all complete)
Phase 2 (Sequential):
  ┌─────────────────────────────────────────────────────────────┐
  │  Sub-5: Staff Engineer   → Aggregate → /AUDIT_REPORT.md     │
  └─────────────────────────────────────────────────────────────┘
```

## Files Modified by This Plan

| Action | Path | Owner |
|--------|------|-------|
| Create | `/AUDIT_REPORT.md` | Subagent 5 |

No source files are modified. No intermediate files are written. This is a read-only audit except for the final report output.

## Standards References per Subagent

| Subagent | Standard |
|----------|----------|
| Sub-1 (UI/UX) | WCAG 2.2 — Level AA |
| Sub-2 (FE Architect) | Industry best practices (no external standard) |
| Sub-3 (Security) | OWASP Top 10 (2021), MITRE CWE |
| Sub-4 (Systems) | Industry best practices (no external standard) |
| Sub-5 (Synthesis) | All of the above, applied to `onboarding_pack/` accuracy review |
