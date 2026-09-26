/* ─────────────────────────────────────────────────────────────────────────────
   app.js — Code Compass Onboarding Dashboard
   Zero-build-step, vanilla JS SPA.
   Relies on globals: marked (marked.js CDN), mermaid (mermaid.js CDN)
───────────────────────────────────────────────────────────────────────────── */

'use strict';

// ── Mermaid init ─────────────────────────────────────────────────────────────
mermaid.initialize({ startOnLoad: false, theme: 'dark' });

// ── Fetch cache ───────────────────────────────────────────────────────────────
const _cache = new Map();

async function fetchText(path) {
  if (_cache.has(path)) return _cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const text = await res.text();
  _cache.set(path, text);
  return text;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

marked.setOptions({ gfm: true, breaks: false });

/**
 * Fetch a Markdown file, render it to HTML, inject into #content,
 * then post-process any mermaid fenced blocks and run mermaid.
 */
async function renderMarkdown(filePath) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-muted text-sm animate-pulse">Rendering…</div>';

  try {
    const raw = await fetchText(filePath);
    const html = marked.parse(raw);

    const wrapper = document.createElement('div');
    wrapper.className = 'prose-dark';
    wrapper.innerHTML = html;

    // Post-process: replace <pre><code class="language-mermaid"> with <div class="mermaid">
    wrapper.querySelectorAll('pre > code.language-mermaid').forEach(code => {
      const pre = code.parentElement;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      pre.replaceWith(div);
    });

    content.innerHTML = '';
    content.appendChild(wrapper);

    // Run mermaid on freshly injected nodes
    await mermaid.run({ nodes: wrapper.querySelectorAll('.mermaid') });

  } catch (err) {
    content.innerHTML = `<div class="text-red-400 text-sm">⚠ Error loading content: ${err.message}</div>`;
  }
}

// ── Quiz view ─────────────────────────────────────────────────────────────────

let _quizData = null; // cached parsed QUIZ.json

async function renderQuiz() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-muted text-sm animate-pulse">Loading quiz…</div>';

  try {
    if (!_quizData) {
      const raw = await fetchText('onboarding_pack/QUIZ.json');
      _quizData = JSON.parse(raw);
    }
  } catch (err) {
    content.innerHTML = `<div class="text-red-400 text-sm">⚠ Error loading quiz: ${err.message}</div>`;
    return;
  }

  // Session state — lives in this invocation's closure
  let deck = [];
  let currentIndex = 0;
  const results = []; // { id, status: 'got-it' | 'review' }

  // ── Distinct modules ─────────────────────────────────────────────────────
  const modules = ['All', ...new Set(_quizData.map(q => q.module))];

  // ── Build deck ───────────────────────────────────────────────────────────
  function buildDeck(moduleFilter) {
    return moduleFilter === 'All'
      ? [..._quizData]
      : _quizData.filter(q => q.module === moduleFilter);
  }

  // ── Render filter bar + first card ───────────────────────────────────────
  function startSession(moduleFilter) {
    deck = buildDeck(moduleFilter);
    currentIndex = 0;
    results.length = 0;
    renderCard();
  }

  // ── Render a single flashcard ─────────────────────────────────────────────
  function renderCard() {
    if (deck.length === 0) {
      content.innerHTML = renderFilterBar(currentModule()) +
        '<p class="text-muted text-sm mt-6">No questions for this module.</p>';
      attachFilterListeners();
      return;
    }

    const q = deck[currentIndex];
    const total = deck.length;
    const num = currentIndex + 1;

    const difficultyClass = 'bg-red-900 text-red-300';

    const tagPills = q.tags.map(t =>
      `<span class="inline-block bg-accent/20 text-accent rounded-full px-2.5 py-0.5 text-xs font-medium">${t}</span>`
    ).join(' ');

    const progressDots = deck.map((_, i) => {
      const r = results[i];
      let cls = 'bg-border';
      if (r?.status === 'got-it') cls = 'bg-green-500';
      else if (r?.status === 'review') cls = 'bg-amber-500';
      else if (i === currentIndex) cls = 'bg-accent';
      return `<span class="inline-block w-2.5 h-2.5 rounded-full ${cls} transition-colors"></span>`;
    }).join('');

    content.innerHTML = `
      ${renderFilterBar(currentModule())}

      <div class="mt-4 flex items-center justify-between text-xs text-muted mb-3">
        <span>Card <strong class="text-slate-300">${num}</strong> of <strong class="text-slate-300">${total}</strong></span>
        <div class="flex items-center gap-1">${progressDots}</div>
      </div>

      <div id="flashcard" class="bg-panel border border-border rounded-xl p-6">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <span class="text-xs font-semibold px-2 py-0.5 rounded ${difficultyClass}">${q.difficulty.toUpperCase()}</span>
          <span class="text-xs text-muted font-mono">${q.module}</span>
          <span class="text-xs text-muted ml-auto font-mono">${q.id}</span>
        </div>

        <p class="text-slate-100 text-base leading-relaxed mb-5">${escapeHtml(q.question)}</p>

        <div class="flex flex-wrap gap-1.5 mb-5">${tagPills}</div>

        <button id="show-answer-btn"
          class="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-white text-sm font-medium transition-colors">
          Show Answer
        </button>

        <div id="answer-section" class="hidden">
          <div class="border-t border-border mt-5 pt-5">
            <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Answer</p>
            <p class="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(q.answer)}</p>
          </div>
          <div class="flex gap-3 mt-5">
            <button id="got-it-btn"
              class="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors">
              ✓ Got it
            </button>
            <button id="review-btn"
              class="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium transition-colors">
              ↺ Review Again
            </button>
          </div>
        </div>
      </div>
    `;

    attachFilterListeners();

    document.getElementById('show-answer-btn').addEventListener('click', () => {
      document.getElementById('show-answer-btn').classList.add('hidden');
      document.getElementById('answer-section').classList.remove('hidden');
    });

    document.getElementById('got-it-btn').addEventListener('click', () => advanceCard('got-it'));
    document.getElementById('review-btn').addEventListener('click', () => advanceCard('review'));
  }

  // ── Advance to next card or show summary ─────────────────────────────────
  function advanceCard(status) {
    results[currentIndex] = { id: deck[currentIndex].id, status };
    currentIndex++;
    if (currentIndex < deck.length) {
      renderCard();
    } else {
      renderSummary();
    }
  }

  // ── Session summary ──────────────────────────────────────────────────────
  function renderSummary() {
    const gotIt = results.filter(r => r.status === 'got-it').length;
    const review = results.filter(r => r.status === 'review').length;
    const pct = Math.round((gotIt / deck.length) * 100);

    content.innerHTML = `
      ${renderFilterBar(currentModule())}

      <div class="mt-6 bg-panel border border-border rounded-xl p-8 text-center max-w-md mx-auto">
        <div class="text-5xl mb-4">${pct >= 80 ? '🏆' : pct >= 50 ? '📈' : '📚'}</div>
        <h2 class="text-xl font-bold text-slate-100 mb-1">Session Complete</h2>
        <p class="text-muted text-sm mb-6">${deck.length} card${deck.length !== 1 ? 's' : ''} reviewed</p>

        <div class="flex justify-center gap-8 mb-8">
          <div>
            <div class="text-3xl font-bold text-green-400">${gotIt}</div>
            <div class="text-xs text-muted mt-1">Got it</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-amber-400">${review}</div>
            <div class="text-xs text-muted mt-1">Review Again</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-accent">${pct}%</div>
            <div class="text-xs text-muted mt-1">Score</div>
          </div>
        </div>

        <button id="restart-btn"
          class="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/80 text-white text-sm font-medium transition-colors">
          Restart Deck
        </button>
      </div>
    `;

    attachFilterListeners();
    document.getElementById('restart-btn').addEventListener('click', () => startSession(currentModule()));
  }

  // ── Filter bar HTML ──────────────────────────────────────────────────────
  let _activeModule = 'All';

  function currentModule() { return _activeModule; }

  function renderFilterBar(active) {
    const btns = modules.map(m => {
      const isActive = m === active;
      const cls = isActive
        ? 'bg-accent text-white'
        : 'bg-panel text-slate-300 border border-border hover:border-accent hover:text-accent';
      const label = m === 'All' ? 'All' : m.replace('src/', '');
      return `<button data-module="${m}" class="filter-btn px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cls}">${label}</button>`;
    }).join('');

    return `
      <div class="mb-2">
        <h1 class="text-xl font-bold text-slate-100 mb-3">Quiz</h1>
        <div class="flex flex-wrap gap-2">${btns}</div>
      </div>
    `;
  }

  function attachFilterListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeModule = btn.dataset.module;
        startSession(_activeModule);
      });
    });
  }

  // ── Kick off ─────────────────────────────────────────────────────────────
  startSession('All');
}

// ── HTML escape helper ────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Views registry ────────────────────────────────────────────────────────────
const views = {
  'architecture':  () => renderMarkdown('onboarding_pack/ARCHITECTURE.md'),
  'modules':       () => renderMarkdown('onboarding_pack/MODULES.md'),
  'danger-zones':  () => renderMarkdown('onboarding_pack/DANGER_ZONES.md'),
  'quiz':          () => renderQuiz(),
};

// ── Router ────────────────────────────────────────────────────────────────────

function navigate(viewName) {
  const name = views[viewName] ? viewName : 'architecture';

  // Update active nav highlight
  document.querySelectorAll('.nav-item').forEach(el => {
    const isActive = el.dataset.view === name;
    el.classList.toggle('bg-accent/20', isActive);
    el.classList.toggle('text-white', isActive);
    el.classList.toggle('text-slate-300', !isActive);
  });

  // Update hash without triggering hashchange recursion
  if (location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }

  // Render
  views[name]();
}

window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  navigate(hash);
});

document.addEventListener('DOMContentLoaded', () => {
  // Wire sidebar clicks
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  // Initial route
  const initial = location.hash.slice(1) || 'architecture';
  navigate(initial);
});
