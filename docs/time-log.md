# Punch Clock: time log

Where my time actually went, activity by activity. It's a note for COMP 361 A2: compare it with my
estimates, and use it later when I build my own activity graph.

**How these times were found:** reconstructed from file creation/save times and the order of my
work. Times marked `~` are best guesses (the file was re-saved later, so the timestamp moved).
Q&A with Claude while learning is **included** in each activity.

**Types:** **Build** = typing the guide's code · **Learn** = asking/reading to understand ·
**Debug** = finding and fixing my mistakes · **Rework** = redoing work because a design decision
changed · **Docs** = notes and guide updates

## Session 1: 2026-10-07 (evening)

| # | Start | End | Min | Part / step | Activity | Type | Notes |
| - | ----- | --- | --- | ----------- | -------- | ---- | ----- |
| 1 | 21:34 | 21:48 | 14 | Before start | ? (fill in: reading the guide / writing A2 task list?) | ? | Folder + guide created 21:34–21:35 |
| 2 | 21:48 | 21:50 | 2 | A, Step 1 | `npm init`, install Electron, create folders | Build | Also installed the typo package `electon` by mistake |
| 3 | 21:52 | 22:06 | 14 | A, Step 2 | First window: `main.js`, `renderer/index.html` | Build, Debug, Learn | 3 typos in `main.js`; white window = missing `index.html`. Learned `require`, destructuring, main vs renderer |
| 4 | 22:07 | 22:30 | 23 | A, Step 3 | Bridge: `preload.js`, IPC ping, `renderer/app.js` | Build, Debug, Learn | `ipcMain` not imported, `requir`, `window-all-closes`, `process.version`. Learned IPC, `handle`/`invoke`, `contextBridge`, `<script src>` + CSP |
| 5 | 22:30 | ~23:05 | ~35 | B, Step 4 | `db/schema.sql` | Build, Learn, Debug | Learned foreign keys, indexes, partial unique indexes, composite key. Fixed `work_event` typo |
| 6 | ~23:05 | 23:19 | ~14 | B, Step 5 | `lib/time.js`, then switched to UTC ms | Debug, Learn, **Rework** | Template-string syntax error. **Design change 1** (UTC ms): schema + `time.js` redone |
| 7 | 23:19 | 23:22 | 3 | B, Step 4 | `db/seed.sql` updated for both changes | **Rework** | **Design change 2** (part numbers + composite key) |
| 8 | 23:23 | 23:36 | 13 | B, Step 5 | `lib/db.js` | Build, Learn | Learned `exec` vs `prepare`/`get`, compared to a Next.js `Pool`. Found and fixed `PRAGMA foreign_key` typo |
| 9 | 23:36 | 23:52 | 16 | Docs | Guide updated for design changes, `design-changes.md`, `build-log.md`, this log | Docs, **Rework** | Guide Steps 4–7, 11, 12 rewritten |

### Session 1 totals

| | Minutes | Notes |
| - | ------- | ----- |
| Part A (rows 2–4) | 39 | Guide estimate ~45 min. Finished |
| Part B so far (rows 5–8) | ~65 | Guide estimate ~1.5 h for all of B. Steps 6–7 (`punch.js`, `try-db`) still to do |
| Docs (row 9) | 16 | Not in any estimate |
| Unknown (row 1) | 14 | Fill in |
| **Session total** | **~2 h 18 min** | 21:34–23:52 |

**Rework from design changes** (rows 6, 7 and part of 9): roughly 25–30 min. My original task list
had no time for this.

## Session 2: ____

| # | Start | End | Min | Part / step | Activity | Type | Notes |
| - | ----- | --- | --- | ----------- | -------- | ---- | ----- |
| | | | | | | | |

## Session 3: 2026-10-09

Times not recorded yet; fill in Start/End/Min.

| # | Start | End | Min | Part / step | Activity | Type | Notes |
| - | ----- | --- | --- | ----------- | -------- | ---- | ----- |
| 1 | | | | B, Step 6 | Reviewed my typed `punch.js`: ~20 typos (name, SQL, silent) | Debug, Learn | `node --check` passes but names are only checked at run time |
| 2 | | | | Big picture | Electron layers, SQLite, `lib/` roles, factory / DI / Spring mapping | Learn | |
| 3 | | | | B, Step 5 | `db.js` + `time.js` line by line; JS objects, `.get/.all/.run`, JSON | Learn, Docs | `db-and-time-explained.md`, `js-objects-and-json.md`, `sql_notes.md` |
| 4 | | | | B, Step 5 | My own `time.js` format function, tested | Build, Debug | 4 bugs found in review (no `return`, `getHours` twice, no padding, lost exports) |
| 5 | | | | Design | Report range (inclusive, `[00:00, next 00:00)`), per-day queries, 23:55 batch, no punch-in after 5:30 | **Rework**, Design | Found while questioning the guide against the story + mock |
| 6 | | | | Docs | `my-design.md`, guide ⚠️ lessons, design changes 3–7 | Docs, **Rework** | |
| 7 | | | | B, Step 6 | Decided to rewrite `punch.js` from scratch; listed use cases from the buttons (service + repository view) | Design | |
| 8 | | | | Design | How `work_events` is used and how the job list is found. Went through 6 alternatives before settling (see `design-changes.md` change 8) | Design, **Rework** | Long session. Main confusion: what makes a job "available" vs "finished". Resolved by checking each idea against the story and the schema |
| 9 | | | | Docs | `algorithms.md` written (work-event lifecycle, job-list algorithm, rejected ideas) | Docs | |

## Notes for my activity graph (later)

- Things I can see so far that **depend on each other**: Step 1 setup → window → bridge (A);
  schema → seed → `db.js` → `punch.js` → `try-db` (B). The **schema** is upstream of almost
  everything in B–E, so a change there (like design change 1) ripples down.
- A and B don't depend on each other. Two people could do them **in parallel**, as long as they
  agree on the `window.api` function list first.
- Learning and debugging took a large share of every step. A team that already knows Electron
  would not spend this.
- **Design review is its own activity.** Session 3 found 3 logic changes (auto punch-out timing,
  punch-in cut-off, program lifetime) before any of that code was written. In the activity graph it
  belongs **after requirements and before coding**, on the critical path, with buffer after it.
- **Data-model understanding is its own task.** Session 3 rows 7–9: settling what a `work_events`
  row means took a long design session before any `punch.js` code. It wasn't in my estimate.
