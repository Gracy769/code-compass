# 🧭 Code Compass: The Autonomous Onboarding Engine

**Built for the IBM Bob 2.0 Hackathon**

Code Compass is a highly scalable, agentic platform designed to ingest *any* codebase—regardless of size or complexity—and autonomously generate an interactive, enterprise-grade onboarding dashboard. 

It eliminates the multi-week onboarding bottleneck by using parallel AI subagents to map architecture, surface technical debt, and test developer comprehension instantly.

---

## 🚀 The Problem at Scale
When a new engineer joins an enterprise team, they face a massive, undocumented monolith or a spiderweb of microservices. 
- Traditional onboarding takes **2 to 4 weeks**.
- Undocumented "Danger Zones" (race conditions, memory leaks) act as landmines for new hires.
- Senior engineers lose dozens of hours explaining the same architectural diagrams.

## 🧠 The Code Compass Solution (How it Works)
Code Compass isn't a script—it's an autonomous orchestration engine powered by IBM Bob 2.0. You point it at a repository of any size, and it executes a 4-phase Agentic Pipeline:

### Phase 0: AST & Topology Discovery
Code Compass scans the repository's configuration files (`package.json`, `go.mod`, `Cargo.toml`) and directory structure. It autonomously identifies the core architectural boundaries and chunks the codebase into digestible modules, no matter how massive the repo is.

### Phase 1: Dynamic Orchestration (Plan Mode)
The engine generates a dynamic execution plan. Instead of a human writing prompts, the Orchestrator dynamically writes the strict instructions required to analyze the discovered modules.

### Phase 2: Parallel Subagent Swarm (Agent Mode)
Code Compass spawns a swarm of parallel subagents. Each subagent is scoped to a specific module to prevent context-window hallucination. 
* *In our prototype demo, we spawned 3 parallel subagents (Queue, Promise, Test) + a 5-agent Red Team to audit the results.*

### Phase 3: Dashboard Synthesis
A final Synthesis Agent aggregates the parallel outputs and generates a zero-build-step client-side web application. The result is `/onboarding_pack/`:
* **Interactive Architecture:** Dynamic Mermaid.js state machines.
* **Module API Breakdown:** Full entrypoint documentation.
* **Danger Zones:** A security and technical debt matrix.
* **Knowledge Check:** An interactive flashcard quiz to test the new hire.

---

## 🛠️ The Hackathon Prototype
To prove the scalability and cost-efficiency of the Code Compass engine, we ran it against the high-performance `fastq` concurrency scheduler.

**Metrics Achieved:**
* **Total Time to Generate:** < 4 minutes
* **Compute Cost:** ~3.55 Bobcoins (Extremely quota-efficient due to parallel scoping)
* **Output:** A complete frontend web dashboard, 4 markdown artifacts, and a 71-point Red Team Security Audit.

## 🏁 Running the Demo
The generated dashboard requires no build tools. To view the Code Compass output:
```bash
python -m http.server 8000
# Navigate to http://localhost:8000
```

*Built with IBM Bob 2.0 | Agent Mode | Parallel Subagents | Document Understanding*
