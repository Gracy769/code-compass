# fastq — Danger Zones: Risk Matrix & Architectural Constraints

> **Audience:** Senior engineers, code reviewers, and on-call responders.  
> **Scope:** Every identified low-level risk, test coverage gap, and architectural constraint across `queue.js`, `promise.js`, and the test suite.

---

## Severity Scale

| Level | Meaning |
|---|---|
| 🔴 **CRITICAL** | Silent data loss, process crash, or permanent queue freeze |
| 🟠 **HIGH** | Observable behavioral violation; hard to reproduce; production impact likely |
| 🟡 **MEDIUM** | Incorrect semantics under specific conditions; workarounds exist |
| 🔵 **LOW** | Cosmetic violation or minor inconsistency; unlikely production impact |

---

## Risk Matrix

### queue.js Risks

---

#### DZ-Q1 — Error Handler Fires on Successful Tasks
**Severity:** 🟠 HIGH  
**Source:** `queue.js`, `worked()` callback, line 261–262  
**Module:** `src/queue.js`

**Scenario:** Any task that completes successfully while a global error handler is registered via `queue.error(handler)`.

**Root cause:** The condition `if (self.errorHandler)` checks only for the *existence* of an error handler, not whether `err` is non-null. The errorHandler is then invoked **unconditionally** with `(err, val)` where `err` may be `null`.

**Impact:** User error handlers receive spurious invocations with `err === null` on every successful task. Code that uses error handlers to increment error counters, trigger alerts, or log failures will misbehave.

**Code pattern:**
```js
// line 261–262 (queue.js)
if (self.errorHandler) {
  self.errorHandler(err, val)  // ← fires even when err === null
}
```

**Mitigation:** Guard should be `if (self.errorHandler && err)`.

---

#### DZ-Q2 — Spurious `_running` Increment on Empty-Queue Resume
**Severity:** 🟠 HIGH  
**Source:** `queue.js`, `resume()`, lines 102–105  
**Module:** `src/queue.js`

**Scenario:** `pause()` is called while the queue is empty (all tasks are executing, nothing queued). Then `resume()` is called.

**Root cause:** `resume()` enters an `else if` branch that increments `_running` and calls `release()` even when the queue is empty, inflating the counter beyond the number of actual running workers.

**Impact:** `_running` becomes permanently desynchronized. Subsequent `drain()` may never fire (counter never reaches 0), or may fire prematurely. `idle()` returns incorrect results.

**Code pattern:**
```js
// resume(), lines 102–105 (queue.js)
} else if (self._running > 0) {
  self._running++          // ← spurious increment when queue empty
  release()
}
```

**Mitigation:** Remove this else branch; `release()` already handles dequeue when queue is non-empty.

---

#### DZ-Q3 — `errorHandler` Crash Freezes Queue Permanently
**Severity:** 🔴 CRITICAL  
**Source:** `queue.js`, `worked()` callback, line 262  
**Module:** `src/queue.js`

**Scenario:** The global error handler throws an exception. The exception is synchronous and uncaught in `worked()`.

**Root cause:** There is no `try/catch` around the `errorHandler` invocation. A thrown exception exits `worked()` before `release()` is called (line 265).

**Impact:** 
- `_running` is never decremented.
- Task is not returned to the object pool (memory leak).
- Queue enters a frozen state: `_running` is stuck ≥ 1, no new tasks dispatch, `drain()` never fires.
- The freeze is permanent for the lifetime of the queue instance.

**Code pattern:**
```js
// worked(), lines 261–265 (queue.js)
if (self.errorHandler) {
  self.errorHandler(err, val)   // ← if this throws...
}
callback.call(self.context, err, result)
release(self)                   // ← ...this never executes
```

**Mitigation:** Wrap errorHandler invocation in `try/catch`; ensure `release()` is called in a `finally` block.

---

#### DZ-Q4 — Fencepost Error: `<=` vs `<` in Concurrency Checks
**Severity:** 🟡 MEDIUM  
**Source:** `queue.js`, `release()` line 170 vs `concurrency` setter line 46  
**Module:** `src/queue.js`

**Scenario:** The `concurrency` setter is called (increasing concurrency) while tasks are executing and the setter's dispatch loop runs concurrently with `release()`.

**Root cause:** `release()` uses `_running <= _concurrency` (allows dispatch at exact capacity), while the concurrency setter uses `_running < _concurrency` (strict ceiling). The inconsistency means the setter loop can increment `_running` to equal `_concurrency`, then `release()` checks `<=` and dispatches one more task, transiently exceeding the ceiling.

**Impact:** Momentary over-concurrency. For concurrency=1 queues, this can result in two workers executing simultaneously, violating the serial guarantee.

**Mitigation:** Standardize both gates to `_running < _concurrency`. Audit all concurrency-check sites for consistent semantics.

---

#### DZ-Q5 — Abort Does Not Stop In-Flight Workers
**Severity:** 🟡 MEDIUM  
**Source:** `queue.js`, `abort()`, lines 202–236  
**Module:** `src/queue.js`

**Scenario:** `abort()` is called while one or more workers are actively executing.

**Root cause:** `abort()` walks only `queueHead` (pending tasks) and calls their callbacks with `Error('abort')`. Tasks currently executing are untouched — their `worked()` callbacks still fire with the actual result after `abort()` returns.

**Impact:** In-flight tasks resolve normally (success or error result), not with abort semantics. Callers may receive a success result after having received an abort signal elsewhere. This creates a dual-notification window for the running task's consumer.

**Mitigation:** Document that `abort()` applies only to queued (not running) tasks. Consider adding a flag that `worked()` checks before resolving.

---

#### DZ-Q6 — `abort()` Does Not Fire `empty()` Callback
**Severity:** 🔵 LOW  
**Source:** `queue.js`, `abort()`, lines 202–236  
**Module:** `src/queue.js`

**Scenario:** `abort()` called when queue is non-empty. Clears the queue entirely, but `empty()` is never invoked.

**Impact:** User code relying on the `empty()` event to detect queue clearance will have stale state. Post-abort, `queue.length() === 0` but `empty()` has not fired.

**Mitigation:** Call `self.empty()` after clearing the queue inside `abort()`.

---

#### DZ-Q7 — `drain` Race: Push From Within `drain()` Callback
**Severity:** 🔵 LOW  
**Source:** `queue.js`, `release()`, line 185  
**Module:** `src/queue.js`

**Scenario:** Code inside the `drain()` callback calls `push()`.

**Root cause:** `drain()` fires synchronously inside `release()`. If `push()` is called from within `drain()`, it will dispatch a new task and increment `_running`, but `drain` has already been considered "fired" for this idle cycle.

**Impact:** Queue re-saturates after drain, which is expected behavior. However, `drain()` will not re-fire until the new tasks complete — this is documented-ish but not explicitly guaranteed, and can surprise callers who treat `drain` as a "one-time completion" signal.

**Mitigation:** Document drain re-entrancy semantics explicitly.

---

### promise.js Risks

---

#### DZ-P1 — Silent Error Swallowing via `p.catch(noop)`
**Severity:** 🟠 HIGH  
**Source:** `promise.js`, lines 308 and 327  
**Module:** `src/promise.js`

**Scenario:** Consumer calls `queue.push(task)` or `queue.unshift(task)` but does not `await` the returned promise, does not `.catch()` it, and does not assign it to a variable. The worker throws.

**Root cause:** `p.catch(noop)` is attached immediately before the promise is returned. V8 marks any promise with an attached rejection handler as "handled," suppressing the `unhandledRejection` event. The error is entirely invisible.

**Impact:** Worker failures produce zero observable signal if the caller ignores the returned promise. No log, no event, no crash. Silent data loss.

**Code pattern:**
```js
// push(), lines 307–309 (promise.js)
p.catch(noop)   // ← marks promise "handled" before returning
return p
```

**Mitigation:** Do not use `p.catch(noop)`. Instead, let `unhandledRejection` fire (process-level safety net). If suppression is intentional, document this behavior prominently.

---

#### DZ-P2 — `drained()` Drain Hook is Fragile Against External Reassignment
**Severity:** 🟡 MEDIUM  
**Source:** `promise.js`, lines 338–343  
**Module:** `src/promise.js`

**Scenario:** Consumer calls `drained()` and then, before the queue reaches idle, externally reassigns `queue.drain`.

**Root cause:** `drained()` saves and replaces `queue.drain` with a wrapper. If any code replaces `queue.drain` between the hook installation and the drain firing, the wrapper is lost, and the `drained()` promise **never resolves**.

**Impact:** `await queue.drained()` hangs indefinitely, blocking the caller and potentially leaking the Promise and its closure.

**Code pattern:**
```js
// drained(), lines 338–343 (promise.js)
const previousDrain = queue.drain
queue.drain = function () {
  previousDrain()
  resolve()
  queue.drain = previousDrain  // ← wrapper is already the active drain; external reassignment overwrites this
}
```

**Mitigation:** Use an internal event emitter or a dedicated drain subscriber list rather than a single `drain` property.

---

#### DZ-P3 — Double-Resolution Risk in `drained()` for Rapid Drain Cycles
**Severity:** 🔵 LOW  
**Source:** `promise.js`, lines 338–343  
**Module:** `src/promise.js`

**Scenario:** The underlying queue drains and refills multiple times very rapidly, causing `queue.drain` to be called more than once before the `drained()` wrapper is unwound.

**Root cause:** The wrapper calls `resolve()` on every drain invocation. JavaScript Promises silently ignore subsequent resolutions, so the second call is a no-op — but `queue.drain = previousDrain` is re-executed, potentially restoring an already-consumed drain reference.

**Impact:** In practice, benign due to Promise immutability. However, `previousDrain` could be invoked multiple times if queue cycles rapidly, creating unintended side effects in user drain callbacks.

**Mitigation:** Add a `let resolved = false` guard inside the wrapper; call `resolve()` only once.

---

#### DZ-P4 — No Error Propagation Guarantee If `errorHandler` Throws
**Severity:** 🟡 MEDIUM  
**Source:** `queue.js` `worked()` lines 261–265 (inherited by `promise.js`)  
**Module:** `src/promise.js` (inherited)

**Scenario:** A global error handler is registered via `queue.error(handler)` and the handler itself throws. Because `worked()` has no `try/catch`, the exception propagates synchronously out of the `asyncWrapper` chain, bypassing the Promise's `reject()` path entirely.

**Impact:** The consumer's `await queue.push()` does **not** reject. Instead, the synchronous exception propagates up the call stack into Node.js's uncaught exception handler. The Promise is left permanently pending.

**Mitigation:** Wrap `errorHandler` call in `try/catch`; route exceptions to `reject()`.

---

### Test Suite Risks

---

#### DZ-T1 — `t.plan()` Enables Silent Deadlock Pass-Through
**Severity:** 🟠 HIGH  
**Source:** `src/test/test.js`, all 32 tests  
**Module:** Test suite

**Scenario:** A worker callback is never invoked (queue deadlock). Fewer assertions than planned execute. Tape's test runner may complete without failing if the planned count isn't reached before process exit.

**Production bug slip:** A permanent queue freeze (from DZ-Q3, for example) would not be caught by this test suite.

**Mitigation:** Add explicit timeout assertions or migrate to a test framework with mandatory timeout enforcement (e.g., `t.timeout(N)`).

---

#### DZ-T2 — No Concurrency Counter Invariant Verification
**Severity:** 🟠 HIGH  
**Source:** `src/test/test.js` — absent  
**Module:** Test suite

**Scenario:** No test continuously asserts `queue.running() <= queue.concurrency` across all task lifecycle transitions (between push, between callbacks, during pause/resume, during concurrency setter changes).

**Production bug slip:** DZ-Q4's fencepost error (over-concurrency during setter + release interplay) would not be caught. The existing "altering concurrency" test checks behavior but not invariants.

**Mitigation:** Add an invariant-checking wrapper that hooks into `push`/`unshift`/`release` and asserts the invariant after every state transition.

---

#### DZ-T3 — Drain Timing Under High Error Rate Untested
**Severity:** 🟡 MEDIUM  
**Source:** `src/test/promise.js`, "drained with exception should not throw"  
**Module:** Test suite

**Scenario:** 10 tasks all throw. Test only validates `drained()` doesn't throw — it does NOT validate that `drain()` callback fires after all errors have been propagated, nor the ordering between error handler and drain.

**Production bug slip:** A bug where `drain()` fires before all `errorHandler` invocations complete would go undetected.

**Mitigation:** Add explicit ordering assertions: drain callback should fire only after all per-task error callbacks and global error handlers.

---

#### DZ-T4 — `unhandledRejection` Tests Do Not Verify Error Was Actually Handled
**Severity:** 🟡 MEDIUM  
**Source:** `src/test/promise.js`, "no unhandledRejection (push/unshift)"  
**Module:** Test suite

**Scenario:** Tests check that `unhandledRejection` event does **not** fire. They do not check that `errorHandler` was invoked or that the error was delivered anywhere.

**Production bug slip:** If `p.catch(noop)` swallows the error entirely (DZ-P1) with no handler ever called, this test still passes. Silent failures masked.

**Mitigation:** Add assertion that either the per-task callback or the global error handler receives the error.

---

#### DZ-T5 — Saturated Event Untested with Concurrency > 1
**Severity:** 🔵 LOW  
**Source:** `src/test/test.js`, "saturated" test  
**Module:** Test suite

**Scenario:** "saturated" test uses concurrency=1, pushes 2 tasks. Does not test the event with higher concurrency (e.g., concurrency=3, push 5 tasks — when does saturated fire?).

**Production bug slip:** User code relying on `saturated` for backpressure signaling with concurrency > 1 may have wrong assumptions about when the event fires.

---

#### DZ-T6 — Drain/Error Handler Re-entrancy Not Tested
**Severity:** 🔵 LOW  
**Source:** `src/test/test.js` and `src/test/promise.js` — absent  
**Module:** Test suite

**Scenario:** No test pushes new tasks from within the `drain()` callback. "abort callbacks can safely add tasks" tests callback re-entrancy but not drain/error handler re-entrancy.

**Production bug slip:** Drain-triggered re-queuing could cause infinite loops or missed drain events (DZ-Q7).

---

## Architectural Constraints

The following constraints are not bugs — they are intentional design decisions that all contributors **must** understand:

| Constraint | Implication |
|---|---|
| **Single-threaded JavaScript** | No true race conditions; all "races" are ordering issues within the event loop microtask/macrotask boundary |
| **`_running` is the sole concurrency gate** | All throttling is counter-based; no lock, mutex, or semaphore. Counter correctness is the system's only invariant. |
| **Object pool (reusify) is not thread-safe** | All operations must occur on the same event loop tick; no cross-tick pool mutation |
| **`drain`, `saturated`, `empty` are single-slot callbacks** | Not event emitters; assigning replaces the previous handler. Use internal chaining (save old, call in new) if multiple listeners are needed. |
| **`abort()` affects only queued tasks** | In-flight tasks continue to completion. There is no cancellation primitive for running tasks. |
| **`promise.js` `drained()` promise does not call drain if idle** | This is a deliberate semantic: drain means "transitioned to idle," not "is idle." Calling `drained()` on an already-idle queue is a read, not a signal. |
