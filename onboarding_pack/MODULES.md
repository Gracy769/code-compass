# fastq — Module API & Control-Flow Reference

> **Audience:** Engineers consuming or modifying `fastq` internals.  
> **Scope:** Complete public API tables, internal state inventory, and control-flow narratives for all modules.

---

## Module 1: `src/queue.js` — Core Concurrency Scheduler

### 1.1 Public API

| Method / Property | Signature | Returns | Side Effects |
|---|---|---|---|
| `push` | `push(value, done?)` | `void` | `_running++`; may enqueue; fires `saturated()` |
| `unshift` | `unshift(value, done?)` | `void` | `_running++`; prepends to queue head; fires `saturated()` |
| `pause` | `pause()` | `void` | Sets `self.paused = true`; blocks `release()` dispatch |
| `resume` | `resume()` | `void` | Clears `paused`; drains queue up to concurrency limit |
| `kill` | `kill()` | `void` | Clears queue; replaces `drain` with `noop`; running tasks finish |
| `killAndDrain` | `killAndDrain()` | `void` | Clears queue; fires `drain()` once; replaces with `noop` |
| `abort` | `abort()` | `void` | Walks queue; calls each task's `errorHandler(err,val)` + `callback(err)` with `Error('abort')`; returns tasks to pool |
| `error` | `error(handler)` | `void` | Sets closure-level `errorHandler` |
| `running` | `running()` | `number` | Read-only; returns `_running` |
| `length` | `length()` | `number` | O(n) linked-list traversal |
| `getQueue` | `getQueue()` | `any[]` | O(n) snapshot of pending task values |
| `idle` | `idle()` | `boolean` | `true` iff `_running === 0` AND queue empty |
| `concurrency` | getter/setter | `number` | Setter validates ≥1; on increase, drains queued tasks; on decrease, takes effect as tasks complete |
| `paused` | property | `boolean` | Readable; use `pause()`/`resume()` to mutate |
| `drain` | callback property | `void` | Assigned directly: `queue.drain = fn`; fires on idle |
| `saturated` | callback property | `void` | Assigned directly: `queue.saturated = fn`; fires on saturation |
| `empty` | callback property | `void` | Assigned directly: `queue.empty = fn`; fires on queue empty |

### 1.2 Internal State (Not Public — Closure Variables)

| Variable | Type | Role |
|---|---|---|
| `_running` | `number` | Active worker count — the core throttle counter |
| `_concurrency` | `number` | Concurrency ceiling (backing store for getter/setter) |
| `queueHead` | `Task\|null` | Linked-list head; `null` when queue empty |
| `queueTail` | `Task\|null` | Linked-list tail; `null` when queue empty |
| `errorHandler` | `function\|null` | Global error handler set via `queue.error()` |
| `cache` | `Reusify` | Object pool for Task instances (reusify library) |

### 1.3 Control Flow Narrative

#### Task Push Path
1. Caller invokes `push(value, done)`.
2. Task object obtained from `cache.get()` (object pool — zero allocation on hot path).
3. Task fields populated: `value`, `callback`, `context`, `errorHandler`, `release`.
4. **Decision gate (line 126):** `if (_running >= _concurrency || paused)` → link into linked list, fire `saturated()` if queue was previously empty. **Else** → `_running++`, dispatch immediately to `worker(task, worked)`.

#### Worker Completion Path (`worked` callback)
1. Worker calls its callback `worked(err, result)`.
2. Task's `callback` and `value` references captured locally, then **nullified** (prevents memory retention).
3. If `errorHandler` registered: invoked with `(err, val)` — **unconditionally, even on success** (⚠ see Danger Zones §1).
4. `callback.call(context, err, result)` — user's per-task callback fires.
5. `release(task)` called to trigger dequeue cycle.

#### `release()` — The Concurrency Gate
1. If `holder` provided → `cache.release(holder)` (return task to pool).
2. If `queueHead` exists AND `_running <= _concurrency` (⚠ `<=` not `<`):
   - If NOT paused → dequeue head, update pointers, dispatch to worker; if queue now empty fire `empty()`.
   - If paused → skip dispatch, `_running--` only.
3. Else (no pending tasks OR over-limit) → `_running--`; if `_running === 0` → fire `drain()`.

#### `concurrency` Setter
1. Validates new value (`>= 1`, not `NaN`).
2. Sets `_concurrency`.
3. If queue non-empty AND not paused: loop `while (_running < _concurrency && queueHead)` — each iteration `_running++`, calls `release()` to dispatch tasks.

#### `resume()`
1. Sets `paused = false`.
2. If queue non-empty: loop up to `_concurrency`, each iteration `_running++` + `release()`.
3. **⚠ Edge case:** If queue is empty but `_running > 0`, the `else if` branch on `resume()` increments `_running` spuriously (see Danger Zones §2).

---

## Module 2: `src/promise.js` — Promise Facade

### 2.1 Public API (Additions / Overrides over `queue.js`)

| Method | Signature | Returns | Notes |
|---|---|---|---|
| `push` | `push(value)` | `Promise<result>` | Overrides callback `push`; resolves with worker return value; rejects on error or abort |
| `unshift` | `unshift(value)` | `Promise<result>` | Overrides callback `unshift`; same semantics as `push` |
| `drained` | `drained()` | `Promise<void>` | Resolves when queue reaches idle state; **does NOT fire `drain` callback if already idle** |

**All other methods and properties from `queue.js` are inherited unchanged** (`pause`, `resume`, `kill`, `killAndDrain`, `abort`, `error`, `running`, `idle`, `length`, `getQueue`, `concurrency`, `paused`, `drain`, `saturated`, `empty`).

### 2.2 Internal State (Closure Variables)

| Variable | Role |
|---|---|
| `asyncWrapper` | Converts async worker → callback-compatible worker: `worker.call(ctx, arg).then(res => cb(null, res), cb)` |
| `queue` | The underlying `fastqueue` instance |
| `pushCb` | Saved reference to original callback-based `queue.push` |
| `unshiftCb` | Saved reference to original callback-based `queue.unshift` |

### 2.3 Control Flow Narrative

#### Async Worker Bridging
```
asyncWrapper(arg, cb):
  result = await worker.call(context, arg)   // user async function
  if resolved → cb(null, result)             // success callback path
  if rejected → cb(error)                    // error callback path
```
This single `.then(res => cb(null, res), cb)` pattern is the entire callback-to-promise bridge. The rejection handler `cb` receives the error as its sole argument, matching the `callback(err)` signature expected by `worked()`.

#### `push(value)` / `unshift(value)` — Promise Construction
```
push(value):
  return new Promise((resolve, reject) => {
    pushCb(value, (err, result) => {
      if (err) { reject(err); return }
      resolve(result)
    })
    p.catch(noop)   ← ⚠ silences unhandledRejection if caller drops promise
  })
```
The `p.catch(noop)` is intentional: it marks the promise as "handled" in V8's unhandledRejection detection, preventing process crash if the caller ignores the returned promise. **The trade-off is that errors become invisible unless the caller explicitly awaits or catches.**

#### `drained()` — Drain Promise
```
drained():
  return new Promise(resolve => defer(() => {
    if (queue.idle()) { resolve(); return }    ← immediate resolve, drain NOT called
    prev = queue.drain
    queue.drain = () => {
      prev()           ← call original drain first
      resolve()        ← then resolve the promise
      queue.drain = prev   ← restore (fragile — see Danger Zones §4)
    }
  }))
```
`defer` is `process.nextTick` (Node.js) or `queueMicrotask` (browser/Deno), ensuring the idle check happens after the current synchronous frame.

---

## Module 3: `src/test/` — Test Suite

### 3.1 Test File Inventory

| File | Framework | Test count | Interface under test |
|---|---|---|---|
| `src/test/test.js` | tape | 32 | `queue.js` callback API |
| `src/test/promise.js` | tape | ~24 | `promise.js` promise API |

### 3.2 Key Test Cases

#### Callback Suite (`test.js`)

| Test Name | API Exercised | Mechanism |
|---|---|---|
| `concurrency` | Constructor, `concurrency` setter | Validates 0/NaN rejected, ≥1 accepted |
| `limit` | `push()` with `setTimeout` | Verifies concurrency=1 enforces sequential execution |
| `drain` | `queue.drain` assignment | Validates drain fires after all tasks complete |
| `pause && resume` | `pause()`, `resume()`, `paused` | Tests idempotency of multiple resume() calls |
| `pause in flight && resume` | `pause()` inside callback chain | Validates in-flight task continues, subsequent tasks pause |
| `altering concurrency` | `concurrency` setter mid-run | 24-assertion plan with concurrency changes 1→4→1 |
| `idle()` | `idle()` | Validates across task state transitions |
| `saturated` | `queue.saturated` | Fires exactly when running==concurrency AND queue non-empty |
| `unshift` | `unshift()` | LIFO order: unshift(2),unshift(3),push(4),push(1) → 1,2,3,4 |
| `kill` | `kill()` | Queue cleared; drain NOT called; running tasks finish |
| `killAndDrain` | `killAndDrain()` | Queue cleared; drain IS called |
| `abort` | `abort()` | Paused queue; callbacks fired with Error('abort') |
| `abort preserves running` | `abort()` + `running()` | Running counter preserved; new tasks respect concurrency |
| `abort callbacks can safely add tasks` | `abort()` re-entrancy | Callbacks push new tasks; FIFO order maintained |
| `push with worker throwing error` | `error()` handler | Both per-task callback AND global handler receive error |

#### Promise Suite (`test/promise.js`)

| Test Name | API Exercised | Mechanism |
|---|---|---|
| `worker execution` | `push()` → Promise | async worker return value flows to resolved promise |
| `drained` | `drained()` | Resolves after all tasks; re-queueable 10+ tasks |
| `drained with exception should not throw` | `drained()` + errors | Validates drained() survives worker errors |
| `drained while idle should resolve` | `drained()` on empty queue | Immediate resolve, no drain callback |
| `drained while idle should not call the drain function` | `drained()` + `drain` | drain NOT called on idle queue |
| `no unhandledRejection (push)` | `push()` without await | Validates `p.catch(noop)` suppresses unhandledRejection |
| `no unhandledRejection (unshift)` | `unshift()` without await | Same as above for unshift |
| `drained should resolve after async tasks complete` | `drained()` ordering | processed → drain() → drained() resolve sequence |
| `abort rejects all pending promises` | `abort()` | 10 queued promises all reject with `'abort'` message |
| `drained waits for running tasks after abort` | `abort()` + `drained()` | Drain promise waits for in-flight task to complete |

### 3.3 Test Infrastructure Patterns

| Pattern | Usage | Risk |
|---|---|---|
| `t.plan(N)` | All callback tests | Under-assertion: silent pass if callback never fires |
| `sleep = promisify(setTimeout)` | Promise tests | Deterministic delays for concurrency sequencing |
| `immediate = promisify(setImmediate)` | Promise tests | Tick-boundary synchronization |
| `process.once('unhandledRejection')` | Rejection tests | Event not fired ≠ error handled — could false-positive |
| Real workers (no mocks) | All tests | Integration-style; no isolated state-machine unit tests |
