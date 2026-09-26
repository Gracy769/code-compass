# Code Compass — Onboarding Dashboard

A zero-build-step, client-side web dashboard that renders the `onboarding_pack/` materials as an interactive SPA.

## Viewing the Dashboard

Because the dashboard uses `fetch()` to load the Markdown and JSON files, it **cannot be opened directly via `file://`** in Chrome or Firefox (browsers block cross-origin requests from the local filesystem).

Serve it with any simple local HTTP server from the **workspace root**:

### Option A — Python (no install required)
```bash
python -m http.server 8080
```
Then open: [http://localhost:8080](http://localhost:8080)

### Option B — Node.js (`npx`)
```bash
npx serve .
```

### Option C — VS Code Live Server extension
Right-click `index.html` → **Open with Live Server**

## Files

| File | Purpose |
|---|---|
| `index.html` | HTML shell, CDN imports, two-panel dark-mode layout |
| `app.js` | Hash-based router, Markdown rendering, Mermaid post-processing, Quiz state machine |
| `style.css` | Dark prose styles, table borders, Mermaid overflow, scrollbar polish |

## Views

- **Architecture** — renders `ARCHITECTURE.md` with two live Mermaid diagrams (state machine + module graph)
- **Modules** — renders `MODULES.md` with API tables and code blocks
- **Danger Zones** — renders `DANGER_ZONES.md` with the risk matrix
- **Quiz** — flashcard deck from `QUIZ.json`; filter by module, reveal answers, track Got it / Review Again

## Dependencies (CDN, no install)

- [Tailwind CSS](https://tailwindcss.com/) — utility-first CSS
- [marked.js](https://marked.js.org/) — Markdown → HTML
- [mermaid.js](https://mermaid.js.org/) — state diagrams and dependency graphs
