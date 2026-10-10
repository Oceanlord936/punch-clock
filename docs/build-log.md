# Punch Clock: build log

My notes while building the ABC Industries Punch-In/Out System by following
`electron-punch-clock-guide.md`. Two purposes: learn Electron, and act as a **spike** for COMP 361 A2
(compare my estimates with real build time).

## Plan

| Session | Parts | Ends with | Guide estimate |
| ------- | ----- | --------- | -------------- |
| 1 | A + B | Window + bridge working; rules tested with `npm run try-db` | ~2 h 15 min |
| 2 | C + D | Full working app, matching my A1 mockup | ~2 h 45 min |
| 3 | E + F | 5:30 PM auto punch-out + `Setup.exe` | ~1 h |

Total ≈ 6 h (plan for 7–9 h).

**Before session 1:** write my A2 task list + estimates first, so the guide doesn't become my answer.

## Current progress (saved 2026-10-09)

**Switched from copying the guide to my own design.** Design decided in `my-design.md`
(changes 3–7 in `design-changes.md`). The guide is kept as a lesson with ⚠️ notes.

- `lib/time.js`: rewritten by me, **done for now**. Exports `YearMonthDateHourMin` (ms →
  `{ date, time }`) and `dateToMsRange` (`"YYYY-MM-DD"` → `{ startMs, endMs }`), both tested.
  Small leftover: delete the stale `Date.parse` comment (lines 61–62).
  May grow later: "5:30 PM of a given day in ms" (cut-off + batch), human display formats.
- `lib/punch.js`: will be **rewritten from my design**, not fixed. The typo list below is kept as
  a record of what went wrong while copying (A-type name typos, B-type SQL typos, C-type silent bugs).
- Before coding each part, settle its open decisions (`my-design.md` §8).
- **Focus: backend only for now** (UI later, vanilla JS, mostly read and understand).

**Done 2026-10-09 (late):** decided to rewrite `punch.js` from scratch (old file kept as reference).
Settled how `work_events` is used and the job-list algorithm: `algorithms.md`, design change 8.

**Done 2026-10-10:** all backend use cases planned in `algorithms.md` (job list, parts, employee
check, status box, punch in, punch out, report, `closeOpenRowsBefore` for batch + catch-up +
stale-row guard). Rewritten as short notes. Front-end items flagged at the bottom of `algorithms.md`.

**Done 2026-10-10 (later):** `lib/service.js` written (renamed from `punch.js`): all 7 public functions +
private `checkEmployee`, `RuleError` / `NeedSupervisorError`, exports. `time.js` gained `afterPunchInTime`,
`afterPunchOutTime`, `todayStartMs`, `thatDayFixTime`, `dayList`. Smoke-tested on a throwaway DB at 18:32:
everything passed except a successful punch-in/switch (blocked by the 5:30 rule; retest before 17:30).

**Git (2026-10-10):** repo set up, pushed to github.com/Oceanlord936/punch-clock (`main`). `.gitignore`
skips `node_modules/`, `out/`, `*.db`.

**Progress estimate (2026-10-10):** backend ≈ 65%, whole build ≈ 40%. UI not started.

**Next time, start here:** `scripts/try-db.js` + `"try-db"` script (retest punch-in/switch before 17:30),
then `main.js` handlers.

### Concepts learned 2026-10-10
- `SELECT` = which columns come back; `WHERE` = which rows, can use **any** column (no need to SELECT it).
- `.get()` = one row or `undefined`; `.all()` = array of rows; `.run()` = info `{ changes, lastInsertRowid }`, not a row.
- `const { x } = obj` takes property `x` out; `const row = …` keeps the whole thing. Destructuring an array or `undefined` gives `undefined` / crashes.
- `.map` (transform each, new array), `.filter` (keep matching, new array; must use the result), `.includes` (`===` check).
- `for…of` = values; `for…in` = indexes (as strings). Always `const` in the loop.
- Transaction: `BEGIN` → writes → `COMMIT`; on error `ROLLBACK` + rethrow. Only for writes. One `BEGIN` ↔ one `COMMIT`.
- `UPDATE … WHERE job_number = ?` hits every history row of that job; target the open row (`AND end_ms IS NULL`) or `id`.
- Error classes: `RuleError` (show to worker) vs anything else (log). `new X(msg, { cause: err })` keeps the real reason.
- Private in JS = not reachable: inside `createService` and not returned, or not in `module.exports`.
- `"HH:MM"` / `"YYYY-MM-DD"` strings compare correctly as text (same length, zero-padded).
- `Date.now` vs `Date.now()`: without `()` it's the function, a silent bug.
- VS Code checks JS types only with `// @ts-check` or `jsconfig.json` (`checkJs`); `noImplicitAny: false` drops the noise.

**Previous "start here" (done):** write `lib/service.js` (renamed from `punch.js`: it holds all the rules, not just punching; `createService(db)`, db passed in by main.js) from `algorithms.md`, then `scripts/try-db.js`.

**Progress estimate (2026-10-09):** whole build ≈ 25%, backend ≈ 40%, design ≈ 85%.

**Remaining backend estimate (made mid-spike, compare with actual later):**

| Item | Estimate | Actual |
| ---- | -------- | ------ |
| `punch.js` design + write + review (~7 use cases) | 3–5 h | |
| `try-db` | 0.5–1 h | |
| `main.js` handlers, validation, error split | 1–2 h | |
| `preload.js` API list | 0.5 h | |
| 23:55 batch, catch-up, window close, open decisions | 1.5–3 h | |
| **Total** | **7–11 h** | |

## Previous progress (saved 2026-10-08, 14:26)

**Where I stopped:** Part B, Step 6, partway through typing `lib/punch.js`. `lib/time.js` is done
and tested (7 checks pass, including the 25 h DST day).

**`punch.js` so far:** `requireEmployee`, `openEvent`, `listAvailableJobs`, `getJob`, `getStatus`,
`punchIn` typed. `punchOut` started (stops after the "not punched in" check). Not typed yet: rest
of `punchOut`, the report function, auto punch-out, `return { ... }` at the end of `createPunch`,
`module.exports = { createPunch, PunchError }`.

**Issues spotted in what's typed (fix before `try-db`):**
- [ ] line 12: `PuncgError` → `PunchError`
- [ ] `requireEmployee`: parameter `employeeNumer` vs `employeeNumber`; missing `if (!employee) throw ...` and `return employee`
- [ ] `openEvent` SQL: `job_nu,ber`, `work_event` (needs `s`), `j.job` → `j.job_number`
- [ ] `listAvilableJobs` → `listAvailableJobs`; SQL `NOT EXIST` → `NOT EXISTS`, `wrok_events` → `work_events`
- [ ] `punchIn`: `jobNUmber` (3 places) → `jobNumber`
- [ ] `puchOut` → `punchOut`

**Next time, start here:**
1. Finish Step 6 (guide line 528 onward), then fix the list above.
2. `node --check lib/punch.js` for syntax, then Step 7: `scripts/try-db.js`, add the `try-db`
   script, run `npm run try-db`, compare with the checkpoint.

**Still open:** A2 task list + estimates. Did I write them before starting? If not, write them now
from memory of the plan, and note that they were written after Part A. Also fill in Session 2 in
`time-log.md`.

### Concepts learned this session (Step 5–6)
- `Date` months are 0-based: `month - 1` in, `getMonth() + 1` out. Out-of-range values roll over (Oct 32 → Nov 1).
- `new Date(y, m, d, h, min)` reads arguments **by position**: one extra argument shifts the rest silently.
- Watch for VS Code auto-imports (`require("original-fs")` appeared from autocomplete and broke plain Node).
- `class PunchError extends Error {}`: a label so `main.js` can tell rule errors (show to user) from bugs (log) with `instanceof`.
- Multi-line SQL needs backticks; `'...'` can't span lines.
- Closure: functions inside `createPunch(db)` reuse `db`; only the returned ones are public.
- `?` placeholders = Postgres `$1, $2`, but values are separate args. `.get` / `.all` / `.run`.

## Tasks

- [ ] A2 task list + estimates written (before building)
- [x] Part A: first window, preload + IPC ping
- [ ] Part B: schema/seed SQL, `lib/db.js`, `lib/punch.js`, `try-db` passes *(in progress)*
  - [x] `db/schema.sql` (UTC ms times, part numbers)
  - [x] `db/seed.sql`
  - [x] `lib/time.js`: has `formatDate`, `formatTime`, `localDayRange` *(guide version, replaced)*
  - [x] `lib/time.js`: add `parseDate`, `atLocalTime` (guide Step 5), tested *(guide version, replaced)*
  - [x] `lib/db.js`
  - [x] Understand `db.js` + `time.js` line by line (`db-and-time-explained.md`, `js-objects-and-json.md`, `sql_notes.md`)
  - [x] **Redesign** from the story + A1 mocks: rules, storage, report queries, end-of-day batch (`my-design.md`)
  - [x] Guide marked with ⚠️ lessons; design changes 3–7 logged
  - [x] My `time.js`: ms → `{ date, time }`, tested
  - [x] My `time.js`: `"YYYY-MM-DD"` → `{ startMs, endMs }`, tested and exported
  - [ ] Settle open decisions (`my-design.md` §8)
  - [ ] ~~`lib/punch.js` (Step 6) *(in progress: up to `punchOut`)*~~ → rewrite from my design
  - [ ] `scripts/try-db.js` + `"try-db"` script in `package.json` (Step 7), passes
- [ ] Part C: full `main.js` + `preload.js`, tested from DevTools console
- [ ] Part D: UI (11a list/details, 11b status, 11c buttons, 11d report)
- [ ] Part E: auto punch-out tested with `--punch-out=HH:MM`
- [ ] Part F: `npm run make` → `Setup.exe` runs
- [ ] Practice drills
- [ ] Compare estimates vs actual, write takeaways for A2

## Time log

Activity-by-activity detail: `time-log.md`.

| Part | My estimate | Actual | Surprises |
| ---- | ----------- | ------ | --------- |
| A | | 39 min | Typos were most of the debugging; learning IPC/preload took the most thought |
| B | | ~65 min so far (Steps 4–5) | Two design changes mid-build (UTC ms, part numbers): ~25–30 min rework |
| C | | | |
| D | | | |
| E | | | |
| F | | | |
| **Total** | | | |

## Design choices (mine, and why)

| Choice | Why |
| ------ | --- |
| Desktop app with **Electron** | The story is a program on a punch-in computer. Electron = web skills I already have (HTML/CSS/JS) + desktop features (native dialogs, background timer, installer) |
| **SQLite**, local file | The story never names a DB; one punch-in computer needs no server. Simplest thing that meets the story |
| UI follows my **A1 mockup** | Reuse my own spec; added only a message line for success/error feedback |
| Sales Rep job entry **out of scope** | A2 says the user of *this* program is the Floor Staff; jobs are seeded instead |
| Assumed spec + design docs done before START | Prof's workflow precondition; tech stack is a design decision |
| Times stored as **UTC epoch ms** (changed mid-build) | DST-safe durations, one source of truth. Details: `design-changes.md` |
| Parts tracked by **part number**, composite key (changed mid-build) | No duplicate part per job. Details: `design-changes.md` |
| **End-of-day batch at 23:55** records 5:30 PM; **no punch-in after 5:30**; window close keeps the program running | My reading of the story; overtime recordable, forgotten punch-outs capped. Details: `my-design.md` |
| Report: **one query per day**, display per my A1 mock | Matches the day sections; local DB makes it cheap. Details: `my-design.md` §6 |

## What I learned

### Electron
-

### SQL / data
- A `work_events` row = one stretch of work. Punch in adds a row; punch out fills its `end_ms` once. Never reopen or overwrite a finished row: the report is built from them.
- `end_ms IS NULL` already means "still working". A second flag for the same fact can disagree with it after a bug.
- "No rows" is information too: a job with no `work_events` rows is fresh. No placeholder row needed.
- Find what to **exclude**, then subtract: job list = all jobs − jobs with an open row.
- A Java `@OneToMany List<WorkEvent>` field is stored as a separate table with a foreign key. My entity view and the schema were the same thing.
- **OOP is not the DB (object-relational mismatch).** Same fact ("one job has many work events"), built the opposite way:

  | | OOP | Database |
  |---|---|---|
  | How it links | Nesting: `Job` holds `List<WorkEvent>` | Foreign key: each `work_events` row holds `job_number` |
  | Direction | Parent points down to children | Child points up to parent |
  | "No events yet" | Empty list inside the job | No rows with that `job_number` |
  | Many values | A list field | Many rows in another table (a column holds one value) |

  An ORM (JPA `@OneToMany`) translates between the two. Thinking "event is a field of job" is what led me to
  the pre-made-row idea: in the DB the job holds nothing, events point to it once real work exists.

### Planning / estimation (for A2)
- Design from the **buttons down** (UI action → business rules → SQL), like Spring controller → service → repository.
- Check every idea against the story **and** the use cases. Each of my 6 rejected ideas broke one use case (half-done job, report history, empty placeholder rows).
- Understanding what the data *means* is a task of its own and took a long session. It wasn't in my estimate.

## Questions to ask

-
