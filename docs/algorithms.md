# Punch Clock: algorithm notes

Working notes. Function names are working names.

## Domain

```
┌─────────────────┐            ┌────────────────────┐            ┌──────────────────┐
│ employees       │            │ work_events        │            │ jobs             │
├─────────────────┤ 1     0..* ├────────────────────┤ 0..*     1 ├──────────────────┤
│ employee_number ├────────────┤ id                 ├────────────┤ job_number       │
│ name            │            │ employee_number FK │            │ title            │
└─────────────────┘            │ job_number      FK │            │ quantity         │
                               │ start_ms           │            │ description      │
                               │ end_ms  (NULL =    │            │ instructions_url │
                               │   working now)     │            └────────┬─────────┘
                               └────────────────────┘                     │ 1
                                                                          │ 1..*
  unique indexes (rows with end_ms NULL):                        ┌────────┴─────────┐
    • max 1 per employee                                         │ job_parts        │
    • max 1 per job                                              ├──────────────────┤
                                                                 │ job_number   FK  │
                                                                 │ part_number      │
                                                                 │ qty              │
                                                                 └──────────────────┘
```

### How `work_events` is used
One row = one stretch of work. A row is written twice, then never again:
1. **Punch in:** new row, `start_ms = now`, `end_ms` NULL.
2. **Punch out:** fill that row's `end_ms = now`.

Working on the job again later (same or other worker, same or other day) = a **new row**.
A job is never "closed" (nothing in the story closes one). Punched out = free to pick up again.

| id | emp | job | start | end |
|---|---|---|---|---|
| 1 | 4521 | 1042 | Mon 8:00 | Mon 12:00 |
| 2 | 4522 | 1042 | Mon 13:00 | Mon 15:00 |
| 3 | 4521 | 1042 | Tue 9:00 | NULL ← working now |

---

## Functions

### `listAvailableJobs()` → jobs[] (full rows)
- **Use case:** job list when the program opens, before anyone touches it.
  - Shows: fresh jobs (never touched) and jobs touched before but punched out.
  - Never shows: jobs someone is working on right now.
- **Logic:** don't search for the jobs to show. Find the ones to **hide**, then remove them.
  1. In `work_events`, find rows with `end_ms` NULL. Their jobs are being worked on now.
  2. Take **every** job in `jobs`.
  3. Remove the jobs from step 1.
  4. What's left is the list.
  - Punched-out rows are never looked at here (they only matter for the report).
- Returns every `jobs` column, so the front end already has title, quantity, description, URL for the details panel.
- **Example:**

  | emp | job | start | end |
  |---|---|---|---|
  | 4521 | 1042 | Mon 8:00 | Mon 12:00 |
  | 4522 | 1047 | Tue 9:00 | NULL |

  Step 1 → 1047. Steps 2–3 → (1042, 1047, 1051, 1055, 1058) without 1047.
  List = **1042** (punched out) + **1051, 1055, 1058** (fresh).

### `findParts(job_number)` → parts[]
- **Use case:** a job is clicked in the list → details panel shows its parts list.
- **Logic:** `.all()` rows in `job_parts` with this `job_number`. Many rows per job, since the key is (`job_number`, `part_number`). The front end builds the panel.

### `checkEmployee(employee_number)` → employee row / error
- **Use case:** every action except the job list.
- **Logic:** look up `employee_number` in `employees` (primary key → `.get()`).
  - no row → error to front end
  - row found → valid, continue

### `getCurrentJob(employee_number)` → job_number / null
- **Use case:** status box next to Employee ID. Shows the job this employee is on now, or "Not currently punched in".
- **Trigger:** Employee ID box reaches full length → request sent. Only `employee_number` is sent (the selected `job_number` is for Punch in).
- **Logic:**
  1. `checkEmployee(employee_number)`. Unknown → error.
     Stale-row guard: `closeOpenRowsBefore(today 00:00)`. Fails → error, block (so the box never shows yesterday's job).
  2. In `work_events`, find this employee's row with `end_ms` NULL (max 1, by `one_open_event_per_employee`).
     - found → return its `job_number` → box shows the job #
     - not found → return null → "Not currently punched in" (covers: never worked, and worked before but all punched out)
  - The branches collapse into one SQL query. Exact form decided when coding.

### `punchIn(employee_number, job_number)` → ok / error
- **Use case:** Punch In button. Enabled only when a job is selected from the list and the employee ID is valid.
  After ok: Job ID box clears, job list reloads (the job leaves the list), status box shows the new job.
- **Logic:**
  1. After 17:30 → error (no punch-in after 5:30 PM). Includes switching jobs: after 5:30 only punch out is allowed.
  2. `current = getCurrentJob(employee_number)` (also checks the employee, and runs the stale-row guard).
  3. `current` not null → update that row: `end_ms = now` (switching jobs).
  4. Insert new row: employee, job, `start_ms = now`, `end_ms` NULL.
  - Steps 2–4 in one transaction, one `now` (old end = new start).
- **Why 2 params, not 3:** the backend looks up the ongoing job itself instead of trusting the front end's status box. That copy can be stale, and with a wrong value the backend would update the wrong row. Also easier to test (`punchIn(4521, 1042)`).
- **No "already on this job" refusal:** can't happen from the screen (the list hides ongoing jobs, Job ID clears after punch-in). If it ever did: the row gets closed and reopened, split in two, no time lost.

### `punchOut(employee_number)` → punched-out job_number / error
- **Use case:** Punch Out button. No job selection needed.
  After ok: the job reappears in the job list (front end reloads it), status box shows "Not currently punched in".
- **Logic:**
  1. Time ≥ 23:55 → error (buffer zone: the end-of-day batch closes forgotten rows at 5:30 PM).
  2. Stale-row guard: `closeOpenRowsBefore(today 00:00)`. Fails → error, block.
     Find this employee's row with `end_ms` NULL. None → error (not punched in).
  3. Update that row: `end_ms = now`.
  4. Return its `job_number`.
- Allowed after 5:30 PM (real overtime gets recorded).

### `getReport(employee_number, from, to)` → days[]
- **Use case:** Report button. Jobs Completed Report for one worker, per day (A1 mock).
- **Inputs:** `from`, `to` are `"YYYY-MM-DD"`. Both inclusive; same day allowed; `to` before `from` not allowed (front end checks).
  The date input shows MM/DD/YYYY to the user (local format), but its `.value` is always `YYYY-MM-DD`, so no parse step is needed.
- **Logic:** for each day D from `from` to `to`:
  1. `dateToMsRange(D)` → `{ startMs, endMs }` (time.js).
  2. Query `work_events`: this employee, `start_ms >= startMs AND start_ms < endMs`, `end_ms` NOT NULL (finished work only, my-design §6).
  3. Append that day's object to the array.
  - A day with no rows is still in the array (empty). The front end hides empty days.
- The front end builds the display (day headings, 12-hour times, durations, totals).

### `closeOpenRowsBefore(cutoffMs)` → closed job_numbers[] / error
- **Use case:** forgotten punch-outs. Each closed row gets `end_ms` = **5:30 PM of the day it started** (not "today").
- **Logic:**
  1. Find rows with `end_ms` NULL and `start_ms < cutoffMs`.
  2. Update each: `end_ms` = 17:30 of its start day.
  3. Return their `job_number`s. Front end reloads the job list.
  - One transaction: one row fails → rollback, nothing changed, throw.
  - No time check inside. The caller decides when (service.js knows no timers).
- **Callers:**

  | Caller | cutoffMs | Why |
  |---|---|---|
  | main.js timer at 23:55 | now (all open rows) | end-of-day batch |
  | start-up | today 00:00 | PC was off, batch missed |
  | `getCurrentJob`, `punchIn`, `punchOut` (stale-row guard) | today 00:00 | batch + catch-up both failed |

  Today's rows are never closed during the day (cutoff = today 00:00).
- **Failure chain:**
  ```
  23:55 batch fails     → rollback, main.js logs, retries every minute until 23:59
  start-up catch-up     → closes earlier-day rows (same result)
  stale-row guard       → tries again right before the punch
  guard fails too       → punch in / out blocked, worker sees error, asks supervisor
  ```
  Overnight hours can never be recorded: the stale row is either fixed or the punch is refused.

---

## Rejected ideas

| Idea | Why not |
|---|---|
| Punch out removes the job for good | Half-done job can't be picked up again |
| `is_closed` on jobs | Nothing in the story sets it |
| Re-punch-in updates the old row | Loses earlier hours from the report |
| `need_to_be_punched_out` flag | Same fact as `end_ms` NULL; can disagree |
| Pre-made row per job | Empty employee/start; every query must skip it |
| Separate IN / OUT rows | Must pair rows; indexes can't enforce one open |

---

## Front-end notes (later)

- Employee ID is fixed length; send the request only at full length.
- ID not full length → Punch In / Punch Out / Report grayed out.
- Digit deleted after the status showed → reset the status box.
- To decide: full length but unknown employee → buttons grayed out too?
- Job ID is filled only by clicking the list, never typed.
- Start / End Date boxes: use `<input type="date">` and let Electron handle it. The user sees local order
  (MM/DD/YYYY on a US locale, plus a calendar popup); `.value` is always `"YYYY-MM-DD"` (`""` if incomplete).
  Display order follows the computer's locale, so it may differ from the mock on another locale.
