# Punch Clock: my design (v2)

This is my own design for the ABC Industries Punch-In/Out program. It replaces the logic in
`electron-punch-clock-guide.md`. I keep that guide as a lesson: places where its logic doesn't fit
my design are marked **⚠️ Lesson (2026-10-09)** inside it.

- **This file holds decisions, not code.** I write the functions myself, starting from these rules.
- Each decision says **why**, so I can reuse the reasoning in my A2 answers.
- Anything still open is listed in [Open decisions](#8-open-decisions). Decide it before coding that part.

Status: **design decided 2026-10-09** · coding not started (except `time.js` problem 1).

---

## 1. How I read the story

The sentence everything depends on:

> "If the user forgot to punch out **at the end of the day**, the program automatically punches
> everyone who has not already punched out **at 5:30 PM**."

| Phrase | My reading |
|---|---|
| "at the end of the day" | **When** the program checks. My end of day = **23:55** (5-minute buffer before midnight) |
| "at 5:30 PM" | **What end time gets recorded** for anyone still punched in |
| "should not exit the program, so it should prompt 'Are you sure?'" | The prompt nudges people to punch out before leaving. Closing the window is allowed, but the program keeps running so the end-of-day check still happens |

**Assumption (state it in A2):** the sentence can also be read as "the program acts at 5:30 PM".
I chose the reading above because it lets real overtime be recorded, while forgotten punch-outs
are still capped at 5:30 PM.

---

## 2. The rules

### Punch in
- The employee and the job must exist.
- The job must be free (nobody else on it).
- Already on this same job → refuse ("already punched in on job #…").
- Already on another job → punch out of it, then punch in to the new one, **as one transaction**
  (both or neither), using **one** `Date.now()` so the old end equals the new start.
- **No punch-in after 5:30 PM** (new rule). Reason: see §5. It guarantees every open event started
  before 5:30 PM.

### Punch out
- The employee must have an open event, otherwise refuse ("not punched in on any job").
- Allowed **at any time until the end-of-day batch**, including after 5:30 PM. A worker finishing at
  8:30 PM who punches out gets credit for the real time.

### Exit / closing the window
- "Are you sure?" before closing.
- Closing the **window** does not stop the **program**. The main process keeps running so the
  23:55 batch can run.

### End-of-day batch (23:55)
- Find every event still open (`end_ms IS NULL`).
- Set each one's end to **5:30 PM of the day it started**.
- Safety net for people who forgot. Also a deliberate penalty for forgotten overtime (the company
  doesn't want to encourage unrecorded overtime).

### Start-up catch-up
- The batch can be missed (PC off, power cut, update, someone really quit the program).
- So at start-up: close every event left open from an **earlier day** at 5:30 PM of the day it
  started. Same rule as the batch, so the results are identical. (Rubric: *Graceful*.)

---

## 3. Data storage

The schema doesn't change (`db/schema.sql`).

| Decision | Why |
|---|---|
| Times stored as **UTC epoch ms** (`start_ms`, `end_ms`) | One exact number per moment. Durations are `end - start`, safe across DST. Local time is only for display (design change 1) |
| `end_ms IS NULL` = still punched in | Exactly the story: "the end time is left blank" |
| Partial unique index: one open event per **employee** | The database itself refuses a double punch-in, even if my JS check has a bug |
| Partial unique index: one open event per **job** | "Jobs no one is working on" can't be broken either |
| Auto-closed events end at exactly `17:30:00.000` | A real punch-out almost never lands on an exact second, so auto-closed rows are recognisable without an extra column. A supervisor sees "always ends at 5:30" as a red flag |

---

## 4. Time handling (`lib/time.js`)

### Three audiences, three formats

| Who reads it | Format | Example |
|---|---|---|
| Database | ms number | `1791569001624` |
| Machine in between (`<input type="date">`, comparisons, grouping keys) | `YYYY-MM-DD` | `"2026-10-07"` |
| Human (UI, per my A1 mock) | readable | `Monday, September 14, 2026`, `8:02 AM`, `3h 45m` |

`YYYY-MM-DD` is a machine format: the date picker's `.value` is always in it, it sorts correctly as
text, and it's unambiguous.

### Two directions

| Direction | Name | Status |
|---|---|---|
| ms → `{ date: "YYYY-MM-DD", time: "HH:MM" }` (local) | format | ✅ **Done**: my `YearMonthDateHourMin`, all test cases pass (padding, year end, midnight, 9 PM local vs UTC) |
| one `"YYYY-MM-DD"` → `{ startMs, endMs }` for that local day | parse | ✅ **Done**: my `dateToMsRange`, all test cases pass (month end, year end, 25 h DST day) |

### Facts the functions rely on
- `new Date(ms)` stores the ms. **Getters** (`getHours`, `getDate`, …) convert to local time when called.
- `getMonth()` is 0-based. `getDate()` = day of month; `getDay()` = day of week (trap).
- `new Date("2026-10-07")` = **UTC** midnight = Oct 6 evening in Eastern time (trap). Build local
  dates from numbers instead.
- A day is `[00:00 that day, 00:00 next day)`. Get "next day 00:00" from `Date` (day + 1 rolls over
  month/year ends). **Never add 86,400,000 ms**: DST days are 23 or 25 hours.

---

## 5. Why "no punch-in after 5:30 PM" and the 23:55 batch fit together

```
Rule: no punch-in after 5:30 PM
  ⇒ every open event started before 5:30 PM
  ⇒ the batch's end time (5:30 PM that day) is always after the start
  ⇒ no negative or zero-length events, no special case needed

Batch runs at 23:55, before midnight
  ⇒ no event is ever open across midnight
  ⇒ every event belongs to exactly one day in the report
```

The old guide needed `Math.max(start, cutoff)` to patch late punch-ins. My rule removes the case.

### Known trade-off (Ethics statement)
- Forgot to punch out after real overtime → time after 5:30 is lost.
- Left before 5:30 and forgot to punch out → credited up to 5:30.
- Accepted on purpose: the software can't know when someone left. The supervisor checks
  attendance, and the exact-5:30 end times make the pattern visible in the report.

---

## 6. The Jobs Completed Report

### Inputs and range
- From / To come from two date pickers as `"YYYY-MM-DD"`.
- **Both inclusive** (my mock: `Period: 09/14/2026 – 09/15/2026` shows both days).
- Refuse From after To.

### Query strategy: one query per day (decided)

```
for each day D from From to To:
    rows for D = events of this employee
                 with  start_ms >= D 00:00   AND   start_ms < (D+1) 00:00
                 and   end_ms IS NOT NULL         (finished work only)
```

| Considered | Decision |
|---|---|
| **One query per day** | **Chosen.** Output is already split by day, matching the report's day sections. Day totals are a sum per day. Local SQLite = microseconds per query, so ~31 queries for a month is fine |
| One query for the whole range, then group rows in JS by `date` | Fewer queries (scales better for long ranges, standard industry pattern). Not chosen: grouping logic moves into JS, and for this app's ranges there's no speed gain the user could notice |

An event belongs to the day it **started** (with the 23:55 batch, nothing crosses midnight anyway).

### Empty days
- A day with no work returns `[]`. That's not an error.
- Hiding or showing it is a **display** decision → the UI decides (a "show empty days" toggle is
  possible later). The mock shows only days with work.

### What the report shows (from my A1 mock)

| Part | Format |
|---|---|
| Header | `Employee ID: 4521`, `Period: 09/14/2026 – 09/15/2026` |
| Day heading | `Monday, September 14, 2026` |
| Columns | Job # · Title · Start · End · Duration |
| Times | 12-hour: `8:02 AM`, `1:30 PM` |
| Duration, Day Total, TOTAL FOR PERIOD | `3h 45m` |

---

## 7. Keeping the program alive

- In Electron, the **main process is the long-running part**. It can keep running with no window
  open, so no separate daemon is needed.
- The 23:55 batch is a timer in the main process.
- The timer is not the only safety net: the start-up catch-up (§2) covers the times it didn't run.

---

## 8. Open decisions

Decide each before coding the part it affects.

- [x] **Switching jobs after 5:30 PM.** Punch-in is blocked, so someone on job A at 6 PM can't move
      to job B. Intended? **Decided 2026-10-10: yes. After 5:30 PM only punch out is allowed.**
- [ ] **Really quitting.** If closing the window doesn't quit, what does? (Story action "exit
      program".) Who is allowed to quit?
- [ ] **Getting the window back** after it's closed while the program keeps running (tray icon?
      launching the app again brings back the existing one?).
- [ ] **Catch-up edge case.** The app starts at 23:58, after the 23:55 batch was missed. Today's open
      events: close them now too, or leave them for tomorrow's catch-up?
- [ ] **Where the human formatting happens** (12-hour times, long dates, `3h 45m`): time.js, punch.js,
      or the renderer?
- [ ] **What `punch.js` returns** for the report (per-day array shape) and for each action. Write a
      short "returns" comment for each function, since there's no class to describe the shape.

---

## 9. For A2: what this redesign means for planning

- This is **unplanned rework** found during a spike. Three logic changes (auto punch-out timing,
  punch-in cut-off, program lifetime) and two choices (report query strategy, display formats)
  changed only after building and questioning the guide's design.
- **Upstream decisions ripple:** the auto punch-out rule touches `punch.js`, `main.js` (timer,
  window behaviour), start-up, the UI and testing.
- **Requirement ambiguity is a schedule risk.** One sentence in the story has two readings. Asking
  the client early (requirements phase) is cheaper than finding out while coding. In a Gantt chart,
  that's what **buffer days** are for.
- See `design-changes.md` (changes 3–6) for the change log and `time-log.md` for the time spent.
