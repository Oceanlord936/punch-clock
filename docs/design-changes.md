# Punch Clock: design changes

Design decisions I changed **while building**, after `electron-punch-clock-guide.md` was written.
Each one is a concrete change to the data model, made on the run, not part of the original plan.
For COMP 361 A2 this is unplanned rework, so it belongs in the spike results.

## Summary

| # | Date | Change | Triggered by | Status |
| - | ---- | ------ | ------------ | ------ |
| 1 | 2026-10-07 | Store times as **UTC epoch milliseconds** (`Date.now()`) instead of local text | Me, while learning `lib/time.js`: "shouldn't timestamps be UTC since 1970, like logs?" | Done: schema, seed, `time.js`. Guide updated |
| 2 | 2026-10-07 | Track parts by **part number**, one row per part per job | Me, while writing `schema.sql` | Done: schema, seed. Guide updated |
| 3 | 2026-10-09 | **End-of-day batch at 23:55** records forgotten punch-outs as 5:30 PM; punch-out allowed after 5:30 | Me, re-reading the story sentence about 5:30 PM | Design done (`my-design.md` §2, §5). Not coded |
| 4 | 2026-10-09 | **No punch-in after 5:30 PM** | Me: a 9 PM punch-in closed at 5:30 the same day makes no sense | Design done (`my-design.md` §2, §5). Not coded |
| 5 | 2026-10-09 | **Closing the window doesn't quit the program**; start-up catch-up for missed batches | Me: the batch needs the program alive at 23:55 | Design done, 3 open questions (`my-design.md` §7, §8). Not coded |
| 6 | 2026-10-09 | Report: **one query per day** instead of one query + JS grouping; display per my A1 mock | Me, designing `time.js` from the report mock | Design done (`my-design.md` §6). Not coded |
| 7 | 2026-10-09 | `time.js` rewritten: one function ms → `{ date, time }` instead of separate helpers | Me, redesigning top-down | Format direction done and tested. Parse direction next |
| 8 | 2026-10-09 | **No schema change.** Settled how `work_events` is used and how the job list is found; jobs are never "closed" in this program | Me, designing punch-in from the buttons | Design done (`algorithms.md`). Not coded |

## Change 1: times as UTC epoch milliseconds

**Before:** `work_events` had three text columns in local time.

```sql
work_date  TEXT NOT NULL,  -- '2026-10-05'
start_time TEXT NOT NULL,  -- '08:00:00'
end_time   TEXT            -- NULL while punched in
```

**After:** two integer columns holding `Date.now()`.

```sql
start_ms INTEGER NOT NULL,  -- Date.now() at punch-in
end_ms   INTEGER            -- Date.now() at punch-out, NULL while punched in
```

**Why**

| Reason | Detail |
| ------ | ------ |
| Daylight saving can't break durations | When clocks fall back in November, local `01:30` happens twice. Text times would give 0 h for a real 1 h. `end_ms - start_ms` is always right |
| One source of truth | One number per moment. No separate date column to keep in sync |
| Common practice | Store UTC, convert to local only for display, the same as timestamps in logs |

**Options I considered**

| Option | Decision |
| ------ | -------- |
| Keep local text (`work_date`, `start_time`, `end_time`) | Rejected: the DST bug above, and time zone info is lost |
| UTC ms **plus** a local `work_date` column for grouping | Rejected: duplicate data. JS can compute a local day's ms range instead (`localDayRange`) |
| **UTC ms only**, convert in `lib/time.js` | **Chosen** |

**Trade-offs I accepted**

- Raw values like `1791201600000` aren't readable in a DB viewer.
- "What happened on Oct 5?" needs a range query (`start_ms >= ? AND start_ms < ?`) instead of `work_date = ?`.
- Grouping the report by day moved from SQL into JS (`formatDate(row.start_ms)`).
- The 5:30 PM auto punch-out must work out 5:30 PM **of the day each event started** (`atLocalTime`).

**What it touched**

- My files: `db/schema.sql`, `db/seed.sql`, `lib/time.js`
- Guide steps rewritten: 4 (schema, seed), 5 (`time.js`), 6 (`punch.js`: every query with a time), 7 (`try-db.js`), 11b, 11d (display), 12 (auto punch-out timer), troubleshooting
- Still to type when I reach them: `lib/punch.js`, `scripts/try-db.js`, `main.js` Step 12

**Time spent on this change:** ___

## Change 2: parts tracked by part number

**Before:** `job_parts(job_number, part_name, qty)`, with no primary key. The same part could be
listed twice for one job.

**After:**

```sql
job_number  INTEGER NOT NULL REFERENCES jobs(job_number),
part_number TEXT NOT NULL,
qty         INTEGER NOT NULL,
PRIMARY KEY (job_number, part_number)
```

**Why**

- Parts are identified by number, not by a free-text name.
- The composite key stops duplicates: job 1042 can't list `BLT-M4-SH` twice. To change an
  amount, `UPDATE` the `qty` (or upsert with `ON CONFLICT ... DO UPDATE`).

**Trade-off I accepted:** the Job Details panel shows codes like `BLT-M4-SH`, not "M4 socket-head
bolts". If readable names are needed later, add a `parts(part_number PRIMARY KEY, name)` table
and make `job_parts.part_number` reference it.

**What it touched:** `db/schema.sql`, `db/seed.sql` (made-up part codes, old names kept as
comments), guide Steps 4, 6 (`getJob`), 11a (`showDetails`).

**Time spent on this change:** ___

## Changes 3–7: my own design (2026-10-09)

After typing most of the guide's `punch.js`, I stopped copying and redesigned the logic from the
story and my A1 mocks. Full reasoning: [`my-design.md`](my-design.md). The guide is kept as a
lesson, with **⚠️ Lesson (2026-10-09)** notes where its logic differs.

| # | Guide's version | My version | Why |
|---|---|---|---|
| 3 | Auto punch-out fires **at 5:30 PM** and closes everyone still in | Batch at **23:55** records **5:30 PM** as the end | "At the end of the day" is when it checks; "at 5:30 PM" is the recorded time. Real overtime can be recorded; forgotten punch-outs are capped |
| 4 | Punch-in allowed any time; `Math.max(start, cutoff)` patches late ones | **No punch-in after 5:30 PM** | Guarantees every open event started before 5:30, so the batch's end time is always valid. No patch needed |
| 5 | Exit and the window's X **quit the app** (`window-all-closed` → `app.quit()`) | Closing the window keeps the main process running | The 23:55 batch needs a live process. Start-up catch-up stays as the safety net |
| 6 | One report query + group rows in JS; display `HH:MM` 24 h, `8 h 00 min` | One query per day; display per mock (`8:02 AM`, `Monday, September 14, 2026`, `3h 45m`) | Day sections match the report; local DB makes ~31 queries cheap. The A1 mock is my spec |
| 7 | `formatDate`, `formatTime`, `parseDate`, `localDayRange`, `atLocalTime` | One format function now, parse function next | Designed top-down from what the report needs |

**Trade-offs I accepted:** forgotten overtime is lost, and an early leaver who forgets to punch
out is credited up to 5:30 (supervisor's job to catch; exact 5:30 end times make it visible).
More queries per report than strictly needed.

**What it touches (when coded):** `lib/time.js`, `lib/punch.js` (rewrite), `main.js` (timer,
window close behaviour, start-up), renderer report display, `scripts/try-db.js`.

**Time spent on these changes:** ___ (design discussion 2026-10-09; fill in from `time-log.md`)

## Change 8: work events and the job list (2026-10-09)

Full write-up: [`algorithms.md`](algorithms.md).

**Settled:**
- One `work_events` row = one stretch of work. Punch in adds a row; punch out fills its `end_ms` once.
- Job list = all jobs minus jobs with a row whose `end_ms` is empty. Covers fresh jobs and
  touched-but-punched-out jobs in one rule.
- A job is never "closed" in this program. Checked line by line against the story.

**How I got there.** Each idea below fixed a problem raised by the one before it:

| # | Idea | Problem it ran into |
|---|---|---|
| 1 | Punch-out = job finished, it leaves the list | A half-done job can never be picked up again |
| 2 | Add `is_closed` to `jobs` | Nothing in the story ever sets it |
| 3 | Re-punch-in updates the old row's start time | Overwrites earlier work, report loses hours |
| 4 | Add `need_to_be_punched_out` flag | Only needed because of 3; duplicates "empty `end_ms`" |
| 5 | Pre-made `work_events` row when a job is created | Row has no employee or start; every query must skip it |
| 6 | Strict insert-only log (IN and OUT rows) | Valid, but pairing IN/OUT complicates every query and the indexes can't enforce one-open |
| ✔ | Current schema as is | Covers every use case |

**Lesson:** the schema was already right. The time went into understanding what a row *means*.
Writing the use cases from the buttons first is what exposed the confusion.

**Time spent on this change:** ___ (fill in from `time-log.md` session 3 rows 7–9)

## Takeaways for A2

- **Data model decisions ripple.** One choice (how to store time) changed 7 guide steps across
  every layer: SQL, data layer, main process timer, UI. The data model sits early on the
  critical path, and everything after it depends on it.
- **Rework wasn't in my estimate.** Mid-build design changes cost time that a task list doesn't
  show. Compare the "time spent" lines above with my estimates.
- **Cheaper to catch earlier.** A short review of the data model before coding (how time is stored,
  what identifies a part) would have found both changes before any code depended on them.
- **Ambiguous requirements cause late rework.** Changes 3–5 all come from one sentence of the story
  that has two readings. In a real project, that's a question for the client during requirements.
  In my Gantt chart, it's the reason for **buffer days** after design and before coding.
- **Know what each row means before writing queries.** Change 8 changed no schema, but took a long
  session. Six alternatives were tried before the existing table was understood.
- **A borrowed design is a risk too.** Following a guide felt fast, but its logic didn't match my
  own reading of the story. Questioning it cost time that no task in my list covered.
