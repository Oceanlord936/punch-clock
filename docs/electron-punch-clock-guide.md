# Electron sandbox: build the ABC Industries Punch-In/Out System yourself

**Goal:** build the punch-in/out program from the COMP 361 A1/A2 story **by hand**, as a real
Windows desktop app, with every file and command done by you:

- **Window (frontend):** HTML/CSS/JS, laid out like your A1 UI mockup
- **Main process (backend):** Node.js code that owns the database and the window
- **The bridge:** a small, safe API between the two (Electron's preload + IPC)
- **Database:** SQLite, built into Node, one file on the computer
- **The story's rules:** punch-in auto punches you out of your previous job, "Are you sure?" on
  exit, the Jobs Completed Report, and the automatic punch-out at 5:30 PM
- **Packaging:** a real `Setup.exe` installer

When you're done, you can explain how a desktop app differs from a website (not by much), and
you'll have real numbers to compare against your A2 effort estimates.

- **Where:** `D:\Project_dir\punch-clock\`. This guide lives in its `docs\` folder.
- **Rule:** type the code, don't paste whole files. Read each "Understand the code" box.
  When something confuses you, ask.
- **Tested:** every snippet was run on Windows with Electron 44 (Node 24 inside), driven
  through every button and error case, then packaged into `Setup.exe` with Electron Forge 8.
- **Revised 2026-10-07 (my design changes mid-build):** times are stored as UTC epoch milliseconds
  (`Date.now()`) instead of local text, and parts are tracked by part number. Steps 4–7, 11 and 12
  were updated. Why: see `docs/design-changes.md`.
- **2026-10-09: kept as a lesson, not my design any more.** I redesigned the logic myself in
  `docs/my-design.md`. Places where this guide's logic doesn't fit my design are marked
  **⚠️ Lesson (2026-10-09)**. The code below is unchanged.

| Part                                       | Steps | Time     |
| ------------------------------------------ | ----- | -------- |
| A. Electron basics: window + bridge        | 0–3   | ~45 min  |
| B. The database and the story's rules      | 4–7   | ~1.5 h   |
| C. Connect main and the window             | 8–9   | ~45 min  |
| D. The user interface (your A1 mockup)     | 10–11 | ~2 h     |
| E. Automatic punch-out at 5:30 PM          | 12    | ~30 min  |
| F. Package it as a Windows installer       | 13    | ~30 min  |

---

## Before you start: this is your A2 spike

Your A2 Exercise 1 asks you to estimate this exact program. Use this build as a **spike**.

1. **Write your A2 task list and estimates first.** Do it before you read past this section,
   so this guide's step list doesn't become your answer.
2. **Log your real time** in the table below as you build.
3. **Compare the two at the end.** See "How this maps to A2" at the bottom.

| Part | What I estimated (from my own task list) | Actual time | Surprises |
| ---- | ---------------------------------------- | ----------- | --------- |
| A    |                                          |             |           |
| B    |                                          |             |           |
| C    |                                          |             |           |
| D    |                                          |             |           |
| E    |                                          |             |           |
| F    |                                          |             |           |

> Your times include *learning Electron*. A 3-person team that already knows the tools would be
> faster, so keep that in mind when you compare.

---

## The big picture (read once)

```
 THE WINDOW (renderer)               THE BRIDGE (preload.js)          MAIN PROCESS (main.js) — full Node.js
 ─────────────────────               ───────────────────────          ─────────────────────────────────────
 renderer/index.html                                                   creates the window
 renderer/app.js                                                       ipcMain.handle('punch:in', ...)
   button click                                                          │ checks the input (toId)
   window.api.punchIn(4521, 1042) ──▶ ipcRenderer.invoke('punch:in') ──▶ │ calls
                                                                         ▼
   shows the message  ◀──────────── { ok: true, data } ◀──────────────  lib/punch.js   ← the ONLY file with SQL
                                                                         │ uses
                                                                       lib/db.js ──▶ punch-clock.db (SQLite file
                                                                                     in %APPDATA%\punch-clock\)
```

**Coming from Next.js? Almost everything has a twin:**

| Next.js                                         | Electron (this project)                          |
| ----------------------------------------------- | ------------------------------------------------ |
| Server code: `app/api/**/route.ts`              | **Main process**: `main.js`                      |
| `export async function POST(request)`           | `ipcMain.handle('punch:in', (event, ...args) => …)` |
| Validation in `route.ts` + `Response.json(…, { status: 400 })` | `toId(...)` + `{ ok: false, error }`   |
| `lib/artworks.ts` (the only file with SQL)      | `lib/punch.js` (the only file with SQL)          |
| `lib/db.ts` (one shared Pool)                   | `lib/db.js` (one SQLite connection)              |
| `'use client'` component                        | **Renderer**: `renderer/app.js`                  |
| `fetch('/api/artworks', { method: 'POST' })`    | `window.api.punchIn(...)`                        |
| *(nothing; you'd need WebSockets)*              | `win.webContents.send(...)`: main pushes to the window |
| `npm run dev`                                   | `npm start`                                      |
| Deploy to Cloud Run                             | Package a `Setup.exe` (Electron Forge)           |

**The one idea to remember:** the window is a web page **with no Node and no database**. It can
only call the few functions `preload.js` hands it. Everything powerful happens in the main
process, just like everything powerful happens on the server in Next.js.

> Your Java + vanilla JS chatroom used WebSockets so the server could push messages to the
> page. In Electron, `win.webContents.send` does the same job, with no network involved.

---

# Part A: Electron basics

## Step 0. Before you start

In VS Code: **File → Open Folder → `D:\Project_dir\punch-clock`**. Open a terminal
(`` Ctrl+` ``) and check:

```
node -v
npm -v
```

You need Node 20 or newer (you have 24). **This Node is only for npm and for Step 7's test
script.** Electron ships its own Node inside, so your app runs on Electron's copy.

**Optional but nice:** install a SQLite viewer extension. In VS Code's Extensions panel, search
"SQLite Viewer". You'll use it in Step 7 to look inside the database file.

---

## Step 1. Create the project

In the terminal, at `D:\Project_dir\punch-clock`:

```
npm init -y
npm install --save-dev electron
```

Open `package.json`. Change `"main"` and replace `"scripts"` so they look like this. Leave
the other lines as npm made them:

```json
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
```

Create these folders (Explorer → right-click → **New Folder**): `renderer`, `lib`, `db`,
`scripts`.

> **Understand what got created**
>
> - `npm install --save-dev electron` downloads Electron, which is a Chromium browser and Node.js
>   glued together (about 100 MB). It's a *dev* dependency because the packaging tool in Step 13
>   bundles Electron into the app itself.
> - `"main": "main.js"` tells Electron which file to run first. In Next.js the framework decides
>   where code starts; here, you do.
> - `"start": "electron ."` means "run Electron on this folder". Electron reads `package.json`,
>   finds `"main"`, and runs it.
> - `"type": "commonjs"` (npm added it) means we use `require(...)` and `module.exports`, not
>   `import`/`export`. Electron's preload scripts are simplest in CommonJS, so the whole project
>   uses it.

---

## Step 2. Your first window

Create `main.js` in the project root:

```js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({ width: 1100, height: 760 });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

Create `renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self'"
    />
    <title>ABC Industries - Punch-In/Out System</title>
  </head>
  <body>
    <h1>Hello from Electron</h1>
    <p id="answer">waiting…</p>
    <script src="app.js"></script>
  </body>
</html>
```

Run:

```
npm start
```

**Checkpoint:** a desktop window opens with "Hello from Electron" and the title bar says
*ABC Industries - Punch-In/Out System*. Close it with the X. The terminal returns.

> **Understand the code**
>
> - `app` is the whole application's lifecycle. `app.whenReady()` waits until Electron has
>   started, because you can't create windows before that.
> - `BrowserWindow` is one window, a Chromium tab without the browser around it. `loadFile`
>   shows a local HTML file. No web server is involved.
> - `__dirname` is the folder this file is in. `path.join` builds a correct Windows path.
> - `window-all-closed` → `app.quit()`: when the last window closes, the program ends.
> - The `<title>` becomes the window's title bar.
> - **Content-Security-Policy** says "only load scripts and styles from my own files". No inline
>   `<script>` and nothing from the internet. Electron warns you in the console if it's missing,
>   because a desktop app that runs a hacked script is far more dangerous than a website doing it.

---

## Step 3. The bridge: preload + IPC (the most important step)

The page can't use Node. Let's prove it, then build the safe way to reach Node.

Create `preload.js` in the project root:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: (name) => ipcRenderer.invoke('ping', name),
});
```

Replace `main.js`:

```js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('ping', (_event, name) => {
  console.log('main got a ping from', name);
  return `pong, ${name}! (answered by Node ${process.versions.node})`;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

Create `renderer/app.js`:

```js
console.log('typeof require in the page:', typeof require);

window.api.ping('Maria').then((answer) => {
  document.getElementById('answer').textContent = answer;
});
```

Run `npm start`.

**Checkpoint:**

1. The window shows `pong, Maria! (answered by Node 24.x.x)`.
2. **The VS Code terminal** shows `main got a ping from Maria`.
3. In the window, press `Ctrl+Shift+I` to open DevTools, then go to **Console**. It shows
   `typeof require in the page: undefined`. The page has no Node.

> **There are two consoles. This confuses everyone at first.**
>
> | `console.log` in…          | Shows up in…                        |
> | -------------------------- | ----------------------------------- |
> | `main.js`, `lib/*.js`      | The **VS Code terminal**            |
> | `renderer/app.js`          | The window's **DevTools → Console** (`Ctrl+Shift+I`) |
> | `preload.js`               | DevTools Console                    |

> **Understand the code**
>
> - Electron runs **two kinds of processes**. The **main process** (`main.js`) is full Node.js and
>   there's only one. Each window gets a **renderer process**, which is a locked-down web page.
> - `preload.js` runs inside the renderer **before** the page, with a tiny bit of extra power.
>   `contextBridge.exposeInMainWorld('api', {...})` puts an object on the page as `window.api`.
>   The page gets **only** those functions, never `ipcRenderer` itself.
> - `ipcRenderer.invoke('ping', name)` sends a message on channel `'ping'` and returns a Promise.
>   It's like `fetch('/api/ping')`.
> - `ipcMain.handle('ping', ...)` answers that channel in main. It's like `export async function POST`.
>   The first argument is `event` (info about who asked); we don't need it, hence `_event`.
> - **IPC** = inter-process communication. The data is copied between processes (like JSON over
>   HTTP), so you can send plain values and objects, not functions or class instances.
> - **Why so strict?** If the page could call `require('fs')`, then any bug that injects a script
>   (say, a job title containing `<script>`) could delete files on the shop computer. Modern
>   Electron turns this protection on by default (`contextIsolation` and `sandbox`).

---

# Part B: The database and the story's rules

## Step 4. Describe the tables: `db/schema.sql` and `db/seed.sql`

Create `db/schema.sql`:

```sql
-- ABC Industries punch clock. Safe to run on every start-up (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS employees (
  employee_number INTEGER PRIMARY KEY,
  name            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_number       INTEGER PRIMARY KEY,
  title            TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  description      TEXT NOT NULL,
  instructions_url TEXT NOT NULL
);

-- One row per part per job: the same part can't be listed twice for one job.
CREATE TABLE IF NOT EXISTS job_parts (
  job_number  INTEGER NOT NULL REFERENCES jobs(job_number),
  part_number TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  PRIMARY KEY (job_number, part_number)
);

-- One row per work event. Times are UTC epoch milliseconds (Date.now()).
-- end_ms IS NULL means "still punched in".
CREATE TABLE IF NOT EXISTS work_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_number INTEGER NOT NULL REFERENCES employees(employee_number),
  job_number      INTEGER NOT NULL REFERENCES jobs(job_number),
  start_ms        INTEGER NOT NULL,  -- Date.now() at punch-in
  end_ms          INTEGER            -- Date.now() at punch-out, NULL while punched in
);

-- The story's two rules, enforced by the database itself:
-- an employee is on at most one job, and a job has at most one worker.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_event_per_employee
  ON work_events(employee_number) WHERE end_ms IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_worker_per_job
  ON work_events(job_number) WHERE end_ms IS NULL;
```

Create `db/seed.sql`:

```sql
-- Sample data, loaded once when the jobs table is empty.
-- (In the story the Sales Rep enters jobs. That's a different program, so we seed them.)

INSERT INTO employees (employee_number, name) VALUES
  (4521, 'Maria Lopez'),
  (4522, 'Sam Chen'),
  (4523, 'Priya Patel');

INSERT INTO jobs (job_number, title, quantity, description, instructions_url) VALUES
  (1042, 'Aluminum Housing Bracket', 12,
   'Machine and finish 12 aluminum housing brackets to customer spec. Includes deburring, anodizing, and final QA inspection before shipment.',
   'https://example.com/assembly-instructions-1042.pdf'),
  (1047, 'Steel Mounting Plate', 20,
   'Cut, drill and powder-coat 20 steel mounting plates.',
   'https://example.com/assembly-instructions-1047.pdf'),
  (1051, 'Custom Gearbox Housing', 2,
   'Cast and machine 2 gearbox housings. Pressure-test before shipment.',
   'https://example.com/assembly-instructions-1051.pdf'),
  (1055, 'Conveyor Bracket Assembly', 8,
   'Weld and assemble 8 conveyor brackets with mounting hardware.',
   'https://example.com/assembly-instructions-1055.pdf'),
  (1058, 'Precision Shaft Coupling', 30,
   'Turn and balance 30 shaft couplings to 0.01 mm tolerance.',
   'https://example.com/assembly-instructions-1058.pdf');

INSERT INTO job_parts (job_number, part_number, qty) VALUES
  (1042, 'HSG-AL-100', 12),   -- aluminum housing
  (1042, 'BLT-M4-SH', 48),    -- M4 socket-head bolts
  (1042, 'GSK-RB-12', 12),    -- rubber gasket seal
  (1047, 'PLT-ST-3020', 20),  -- steel plate 300x200 mm
  (1051, 'CST-GBX-01', 2),    -- gearbox casting
  (1051, 'KIT-BRG-SL', 2),    -- bearing seal kit
  (1055, 'BLK-BRKT-08', 8),   -- bracket blank
  (1055, 'BLT-M6-HX', 32),    -- M6 hex bolts
  (1058, 'BAR-ST-40', 30);    -- steel bar stock 40 mm

-- A few finished work events, so the report has something to show (October 2026).
-- strftime('%s', <local time>, 'utc') -> UTC epoch seconds; * 1000 -> ms, like Date.now()
INSERT INTO work_events (employee_number, job_number, start_ms, end_ms) VALUES
  (4521, 1047, strftime('%s', '2026-10-05 08:00:00', 'utc') * 1000, strftime('%s', '2026-10-05 11:30:00', 'utc') * 1000),
  (4521, 1051, strftime('%s', '2026-10-05 12:15:00', 'utc') * 1000, strftime('%s', '2026-10-05 16:45:00', 'utc') * 1000),
  (4521, 1055, strftime('%s', '2026-10-06 08:10:00', 'utc') * 1000, strftime('%s', '2026-10-06 17:30:00', 'utc') * 1000);
```

> **Understand the code**
>
> - Each table matches a noun in the story: **employees**, **jobs** (with title, description,
>   assembly-instructions link and parts list), and **work events** ("date, start and end time,
>   job number, and employee number"). The parts list gets its own table because one job has many
>   parts. That's the same one-to-many idea as in any SQL course.
> - **`PRIMARY KEY (job_number, part_number)`** is a *composite* key: each column may repeat, but
>   the pair can't. Job 1042 can't list `BLT-M4-SH` twice. To change an amount, `UPDATE` the `qty`.
> - **Punch in** = insert a row with `end_ms` empty (`NULL`). **Punch out** = fill in `end_ms`.
>   That's exactly how the story describes it.
> - The two **partial unique indexes** (`... WHERE end_ms IS NULL`) make the database itself refuse
>   two open events for one employee or one job. Even if your JS has a bug, the data can't break
>   those rules.
> - `IF NOT EXISTS` means this file can run every time the app starts without errors.
> - **Times are UTC epoch milliseconds**: one number, the same anywhere on Earth. There's no
>   separate date column. "Hours worked" is just `end_ms - start_ms`, which stays correct across
>   daylight-saving changes (local `'01:30'` happens twice in November). Local dates and times only
>   appear when we *show* them or ask "what happened on Oct 5?" (Step 5's `lib/time.js`).
> - **The seed** writes readable local times and lets SQLite convert them. The `'utc'` modifier means
>   "the time to my left is local; convert it to UTC".
> - **SQLite vs PostgreSQL:** same SQL, but the whole database is **one file**, with no server to
>   install or run. `INTEGER PRIMARY KEY` is SQLite's version of `SERIAL`.

---

## Step 5. Small helpers: `lib/time.js` and `lib/db.js`

Create `lib/time.js`:

```js
// The database stores times as UTC epoch milliseconds (Date.now()).
// These helpers turn them into LOCAL dates/times for display, and local days into ms ranges for queries.

function pad(n) {
  return String(n).padStart(2, '0');
}

// ms -> local 'YYYY-MM-DD'
function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ms -> local 'HH:MM:SS'
function formatTime(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 'YYYY-MM-DD' (from <input type="date">) -> a Date at local midnight of that day
function parseDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Local midnight to the next midnight of the day containing d, as ms.
// Query with: WHERE start_ms >= startMs AND start_ms < endMs
function localDayRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

// The local clock time 'HH:MM' on the same day as ms. atLocalTime(Date.now(), '17:30') = today at 5:30 PM.
function atLocalTime(ms, hhmm) {
  const d = new Date(ms);
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes).getTime();
}

module.exports = { formatDate, formatTime, parseDate, localDayRange, atLocalTime };
```

Create `lib/db.js`:

```js
// Opens the SQLite file and makes sure the tables exist.
// It knows nothing about Electron: whoever calls it chooses the file path.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function readSql(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'db', name), 'utf8');
}

function openDb(filePath) {
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readSql('schema.sql'));

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM jobs').get();
  if (count === 0) db.exec(readSql('seed.sql'));

  return db;
}

module.exports = { openDb };
```

> **Understand the code**
>
> - **Store UTC, show local.** We save `Date.now()` and convert only at the edges. `new Date(ms)`
>   plus `getHours()`, `getDate()`, etc. read the computer's **local** time zone. (Don't use
>   `toISOString()` for display: it shows UTC, so 5:00 PM in Montreal prints as 21:00 or 22:00.)
>   `getMonth()` counts from 0, hence the `+ 1` / `- 1`.
> - **`pad`** keeps the display a fixed width: `9:5` → `09:05`.
> - **`new Date(year, month, day, ...)`** builds a date in **local** time. That's how `localDayRange`
>   finds the factory's midnight, and how `atLocalTime` finds today's 5:30 PM. `day + 1` on Oct 31
>   rolls over to Nov 1 by itself, and on a daylight-saving day the range is correctly 23 or 25 h.
> - `module.exports = { ... }` is CommonJS for `export`. Other files get it with
>   `const { formatTime } = require('./time')`.
> - `node:sqlite` is **built into Node** (and into Electron 44). There's nothing to install.
>   Packages like `better-sqlite3` need compiling for Electron's exact version, which is a classic
>   beginner trap that this avoids.
> - `DatabaseSync` is **synchronous**: `db.prepare(sql).get()` returns the row directly, no `await`.
>   That's fine for small, fast queries like ours.
> - `db.exec(sql)` runs one or more statements with no results. `db.prepare(sql)` makes a
>   reusable statement with `.get()` (first row), `.all()` (every row) or `.run()` (change data).
> - `PRAGMA foreign_keys = ON`: plain SQLite ignores `REFERENCES` unless you switch this on, per
>   connection. (`node:sqlite` happens to switch it on by default; we say it explicitly anyway.)
>   Spell it exactly: SQLite **silently ignores** an unknown PRAGMA like `foreign_key`.
> - **`openDb` takes the file path as a parameter.** That keeps `lib/` free of Electron, so Step 7
>   can test it with plain Node. Same idea as your Next.js guide: `lib/` doesn't care who calls it.

---

## Step 6. The story's rules: `lib/punch.js`

This is the heart of the program. Type it slowly, one function at a time.

Create `lib/punch.js`:

```js
// The ONLY file that runs SQL. main.js calls these functions; the window never touches the database.

const { formatDate, formatTime, parseDate, localDayRange, atLocalTime } = require('./time');

// An expected problem we show to the user ("Unknown employee"), as opposed to a bug.
class PunchError extends Error {}

function createPunch(db) {
  function requireEmployee(employeeNumber) {
    const employee = db
      .prepare('SELECT employee_number, name FROM employees WHERE employee_number = ?')
      .get(employeeNumber);
    if (!employee) throw new PunchError(`Unknown employee number ${employeeNumber}.`);
    return employee;
  }

  // The employee's open work event (end_ms IS NULL), or undefined.
  function openEvent(employeeNumber) {
    return db
      .prepare(
        `SELECT w.id, w.job_number, w.start_ms, j.title
           FROM work_events w JOIN jobs j ON j.job_number = w.job_number
          WHERE w.employee_number = ? AND w.end_ms IS NULL`,
      )
      .get(employeeNumber);
  }

  // Jobs no one is currently working on.
  function listAvailableJobs() {
    return db
      .prepare(
        `SELECT job_number, title FROM jobs j
          WHERE NOT EXISTS (SELECT 1 FROM work_events w
                             WHERE w.job_number = j.job_number AND w.end_ms IS NULL)
          ORDER BY job_number`,
      )
      .all();
  }

  function getJob(jobNumber) {
    const job = db.prepare('SELECT * FROM jobs WHERE job_number = ?').get(jobNumber);
    if (!job) throw new PunchError(`Job #${jobNumber} does not exist.`);
    job.parts = db
      .prepare('SELECT part_number, qty FROM job_parts WHERE job_number = ? ORDER BY rowid')
      .all(jobNumber);
    return job;
  }

  function getStatus(employeeNumber) {
    const employee = requireEmployee(employeeNumber);
    const current = openEvent(employeeNumber);
    if (current) current.since = formatTime(current.start_ms); // local 'HH:MM:SS' for the window
    return { name: employee.name, current: current ?? null };
  }

  function punchIn(employeeNumber, jobNumber) {
    requireEmployee(employeeNumber);
    getJob(jobNumber);

    const current = openEvent(employeeNumber);
    if (current?.job_number === jobNumber) {
      throw new PunchError(`You are already punched in on job #${jobNumber}.`);
    }
    const taken = db
      .prepare('SELECT 1 FROM work_events WHERE job_number = ? AND end_ms IS NULL')
      .get(jobNumber);
    if (taken) throw new PunchError(`Job #${jobNumber} is already being worked on.`);

    const now = Date.now();
    // Punch out + punch in must both happen, or neither: a transaction.
    db.exec('BEGIN');
    try {
      if (current) {
        db.prepare('UPDATE work_events SET end_ms = ? WHERE id = ?').run(now, current.id);
      }
      db.prepare(
        `INSERT INTO work_events (employee_number, job_number, start_ms)
         VALUES (?, ?, ?)`,
      ).run(employeeNumber, jobNumber, now);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { punchedOutOf: current?.job_number ?? null, punchedInTo: jobNumber, time: formatTime(now) };
  }

  function punchOut(employeeNumber) {
    requireEmployee(employeeNumber);
    const current = openEvent(employeeNumber);
    if (!current) throw new PunchError('You are not punched in on any job.');

    const now = Date.now();
    db.prepare('UPDATE work_events SET end_ms = ? WHERE id = ?').run(now, current.id);
    return { punchedOutOf: current.job_number, time: formatTime(now) };
  }

  // Jobs Completed Report: finished work events grouped by local day, with daily and overall totals.
  // fromDate / toDate are local 'YYYY-MM-DD' strings from the date pickers.
  function report(employeeNumber, fromDate, toDate) {
    const employee = requireEmployee(employeeNumber);
    if (fromDate > toDate) throw new PunchError('Start Date must be on or before End Date.');

    const fromMs = localDayRange(parseDate(fromDate)).startMs; // fromDate at local 00:00
    const toMs = localDayRange(parseDate(toDate)).endMs; // the day AFTER toDate at local 00:00

    const rows = db
      .prepare(
        `SELECT w.job_number, j.title, w.start_ms, w.end_ms,
                (w.end_ms - w.start_ms) / 60000 AS minutes
           FROM work_events w JOIN jobs j ON j.job_number = w.job_number
          WHERE w.employee_number = ?
            AND w.start_ms >= ? AND w.start_ms < ?
            AND w.end_ms IS NOT NULL
          ORDER BY w.start_ms`,
      )
      .all(employeeNumber, fromMs, toMs);

    const days = [];
    for (const row of rows) {
      const date = formatDate(row.start_ms);
      let day = days.at(-1);
      if (day?.date !== date) {
        day = { date, entries: [], minutes: 0 };
        days.push(day);
      }
      day.entries.push({ ...row, start: formatTime(row.start_ms), end: formatTime(row.end_ms) });
      day.minutes += row.minutes;
    }
    const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
    return { employee, fromDate, toDate, days, totalMinutes };
  }

  // Close every open event that started before beforeMs, at the cut-off time ('HH:MM') of the day
  // it started. Math.max(...) keeps the end from landing before the start (someone who punched in
  // after the cut-off).
  function autoPunchOut(beforeMs, cutoff) {
    const open = db
      .prepare('SELECT id, start_ms FROM work_events WHERE end_ms IS NULL AND start_ms < ?')
      .all(beforeMs);
    const close = db.prepare('UPDATE work_events SET end_ms = ? WHERE id = ?');

    db.exec('BEGIN');
    try {
      for (const event of open) {
        close.run(Math.max(event.start_ms, atLocalTime(event.start_ms, cutoff)), event.id);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return open.length;
  }

  return { listAvailableJobs, getJob, getStatus, punchIn, punchOut, report, autoPunchOut };
}

module.exports = { createPunch, PunchError };
```

> **Understand the code**
>
> - **`createPunch(db)` is a factory.** It takes the database and returns an object of functions
>   that all share that `db`. It works like a class with a constructor, written as a function.
>   The inner helpers (`requireEmployee`, `openEvent`) aren't returned, so they stay private.
> - **`?` placeholders** + values in `.get(...)` / `.run(...)`: the database fills them in safely.
>   **Never** build SQL with `${}` from user input (SQL injection). It's the same rule as
>   `$1` in your PostgreSQL guide.
> - **`PunchError` vs other errors.** `PunchError` means "the user did something the rules don't
>   allow", so show them the message. Any other error is a bug. Step 8 treats them differently,
>   like a 400 vs a 500 in an API.
> - **Punch-in follows the story.** Check the employee and the job exist. If you're already on
>   another job, punch out of it. Then punch in to the new one.
> - **Transaction (`BEGIN` … `COMMIT`, or `ROLLBACK` on error):** "punch out of old + punch in to
>   new" must both happen or neither. Without it, a crash in between leaves you punched in nowhere.
> - `?.` (optional chaining): `current?.job_number` is `undefined` instead of crashing when
>   `current` is undefined. `?? null` turns `undefined` into `null`.
> - **One `Date.now()` per punch.** `punchIn` reads the clock once into `now`, so the old job's end
>   and the new job's start are the exact same millisecond. The functions return `time:
>   formatTime(now)` so the window can show local time without doing any conversion.
> - **`getStatus`** adds `since` (local `'HH:MM:SS'`) next to the raw `start_ms`, for the same reason.
> - **The report** turns the two date-picker strings into a ms range: `fromDate` at local midnight
>   up to the midnight *after* `toDate`, so the whole end day is included. SQL does the per-row math:
>   `(end_ms - start_ms) / 60000` is whole minutes (integer division). JS then **groups rows by
>   local day** with `formatDate(row.start_ms)`: rows come sorted by time, so a new date means a new
>   group. `days.at(-1)` is the last group so far. Each entry gets local `start` / `end` strings.
> - **`autoPunchOut(beforeMs, cutoff)`** closes every open event that started before `beforeMs`.
>   Each one ends at 5:30 PM **of the day it started** (`atLocalTime`), so a punch forgotten
>   three days ago doesn't get 3 days of hours. `Math.max(...)` handles someone who punched in at
>   6 PM: their end becomes 6 PM, not 5:30 (which would be a negative duration). It's a loop of
>   updates, so it's wrapped in a transaction like `punchIn`.

> **⚠️ Lesson (2026-10-09)**
>
> - **`Math.max(...)` is a patch for a case that shouldn't exist.** It's needed only because
>   `punchIn` allows punching in after 5:30 PM. The result is a 0-minute event (end = start). My
>   design adds the rule "no punch-in after 5:30 PM" instead, so every open event started before
>   5:30 and the 5:30 end time is always valid (`my-design.md` §5). Fix the cause, not the symptom.
> - **`report`: one query + grouping in JS is a valid choice, not a flaw.** I chose one query per
>   day instead (`my-design.md` §6). Both work; know the trade-off (number of queries vs where the
>   grouping logic lives).
> - **`report` returns `fromDate` / `toDate`.** Watch spelling: in my typed copy, `formDate`
>   silently became a different key, which the window would read as `undefined`.

---

## Step 7. Test the rules without Electron: `scripts/try-db.js`

Your data layer is plain Node, so you can test it before any UI exists.

Create `scripts/try-db.js`:

```js
// Try the data layer from plain Node, without Electron or a window.
// Run: npm run try-db

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../lib/db');
const { createPunch } = require('../lib/punch');
const { localDayRange } = require('../lib/time');

const file = path.join(os.tmpdir(), 'punch-clock-try.db');
fs.rmSync(file, { force: true }); // start fresh every run

const punch = createPunch(openDb(file));

console.log('Available:', punch.listAvailableJobs().map((j) => j.job_number));
console.log('Punch in 4521 -> 1042:', punch.punchIn(4521, 1042));
console.log('Status 4521:', punch.getStatus(4521));
console.log('Punch in 4521 -> 1047 (auto punch-out of 1042):', punch.punchIn(4521, 1047));
console.log('Available:', punch.listAvailableJobs().map((j) => j.job_number));

try {
  punch.punchIn(4522, 1047);
} catch (error) {
  console.log('Expected error:', error.message);
}

console.log('Punch out 4521:', punch.punchOut(4521));
console.log('Punch in 4522 -> 1051:', punch.punchIn(4522, 1051));
// Close everything still open from today or earlier, at 5:30 PM of its own day.
console.log('Auto punch-out closed:', punch.autoPunchOut(localDayRange().endMs, '17:30'), 'event(s)');

const r = punch.report(4521, '2026-10-01', '2026-10-31');
for (const day of r.days) {
  console.log(day.date, day.entries.map((e) => `#${e.job_number} ${e.minutes} min`), 'day total', day.minutes);
}
console.log('Total minutes:', r.totalMinutes);
```

Add a script to `package.json`:

```json
  "scripts": {
    "start": "electron .",
    "try-db": "node scripts/try-db.js"
  },
```

Run:

```
npm run try-db
```

**Checkpoint:** you see something like this (your times will differ):

```
Available: [ 1042, 1047, 1051, 1055, 1058 ]
Punch in 4521 -> 1042: { punchedOutOf: null, punchedInTo: 1042, time: '21:24:43' }
Status 4521: { name: 'Maria Lopez', current: [Object: null prototype] { id: 4, job_number: 1042, start_ms: 1791422683000, ..., since: '21:24:43' } }
Punch in 4521 -> 1047 (auto punch-out of 1042): { punchedOutOf: 1042, punchedInTo: 1047, ... }
Available: [ 1042, 1051, 1055, 1058 ]
Expected error: Job #1047 is already being worked on.
Punch out 4521: { punchedOutOf: 1047, time: '21:24:43' }
Punch in 4522 -> 1051: { punchedOutOf: null, punchedInTo: 1051, time: '21:24:43' }
Auto punch-out closed: 1 event(s)
2026-10-05 [ '#1047 210 min', '#1051 270 min' ] day total 480
2026-10-06 [ '#1055 560 min' ] day total 560
2026-10-07 [ '#1042 0 min', '#1047 0 min' ] day total 0
Total minutes: 1040
```

Check the numbers yourself: 08:00→11:30 is 210 min, 12:15→16:45 is 270, 08:10→17:30 is 560. ✔

> **Understand the output**
>
> - `[Object: null prototype]` is just how `node:sqlite` rows print. They're normal objects you can
>   read with `row.job_number`.
> - Today's entries are 0 min because the script punches in and out within the same second.
> - `autoPunchOut(localDayRange().endMs, '17:30')` means "close everything that started before
>   tonight's midnight", which is what the 5:30 PM timer will do in Step 12.
> - **Peek inside:** if you installed the SQLite viewer, open
>   `%TEMP%\punch-clock-try.db` (paste that into File → Open File) and browse `work_events`.
>   `start_ms` / `end_ms` are big numbers like `1791201600000`. To read one, type
>   `new Date(1791201600000).toString()` in any JS console.

---

# Part C: Connect main and the window

## Step 8. The real main process: `main.js`

Replace `main.js` completely. The ping from Step 3 goes away.

```js
// MAIN PROCESS: full Node.js. Owns the window, the database and quitting.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const { openDb } = require('./lib/db');
const { createPunch, PunchError } = require('./lib/punch');

let win = null;
let punch = null;
let allowQuit = false;

// ---------- window ----------

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Links (assembly instructions) open in the real browser, never inside our window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // The window's X button asks "Are you sure?" too.
  win.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault();
      confirmExit();
    }
  });
}

async function confirmExit() {
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Exit',
    message: 'Are you sure?',
    buttons: ['Yes, exit', 'No'],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0) {
    allowQuit = true;
    app.quit();
  }
}

// ---------- IPC: the window's "API routes" ----------

// Never trust input from the window: check it here, like validation in route.ts.
function toId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new PunchError(`${label} must be a positive whole number.`);
  return n;
}

function toDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw new PunchError(`Enter a ${label}.`);
  return value;
}

// Register a channel. The window always gets back { ok: true, data } or { ok: false, error }.
function handle(channel, fn) {
  ipcMain.handle(channel, (_event, ...args) => {
    try {
      return { ok: true, data: fn(...args) };
    } catch (error) {
      if (error instanceof PunchError) return { ok: false, error: error.message };
      console.error(error); // a real bug: details in the terminal, not in the window
      return { ok: false, error: 'Something went wrong. See the terminal.' };
    }
  });
}

function registerHandlers() {
  handle('jobs:available', () => punch.listAvailableJobs());
  handle('jobs:get', (jobNumber) => punch.getJob(toId(jobNumber, 'Job ID')));
  handle('employee:status', (employeeNumber) => punch.getStatus(toId(employeeNumber, 'Employee ID')));
  handle('punch:in', (employeeNumber, jobNumber) =>
    punch.punchIn(toId(employeeNumber, 'Employee ID'), toId(jobNumber, 'Job ID')),
  );
  handle('punch:out', (employeeNumber) => punch.punchOut(toId(employeeNumber, 'Employee ID')));
  handle('report:get', (employeeNumber, fromDate, toDateValue) =>
    punch.report(
      toId(employeeNumber, 'Employee ID'),
      toDate(fromDate, 'Start Date'),
      toDate(toDateValue, 'End Date'),
    ),
  );
  handle('app:exit', () => {
    confirmExit();
  });
}

// ---------- start-up ----------

app.whenReady().then(() => {
  const dbFile = path.join(app.getPath('userData'), 'punch-clock.db');
  console.log('Database file:', dbFile);
  punch = createPunch(openDb(dbFile));

  registerHandlers();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
```

> **Understand the code**
>
> - **`app.getPath('userData')`** is the app's own folder in your user profile:
>   `C:\Users\<you>\AppData\Roaming\punch-clock\` (named after `"name"` in `package.json`). The
>   database lives there, **not** in the project folder, because an installed app's own folder is
>   read-only. The terminal prints the exact path at start-up.
> - **`handle(channel, fn)`** is a small wrapper so every channel behaves the same way. It's the
>   same reason your API routes always return JSON with a status code. `...args` collects
>   whatever arguments the window sent.
> - **`toId` / `toDate`** do validation at the boundary. Anything coming from the window is
>   treated like a request from the internet: the Employee ID box may contain `"abc"`.
> - **`dialog.showMessageBox`** shows a real Windows dialog, the "Are you sure?" pop-up from your
>   mockup. `response` is the index of the clicked button. `cancelId: 1` means pressing Esc counts
>   as "No". Websites can only do `confirm()`; desktop apps get native dialogs.
> - **The X button.** `win.on('close')` fires when the window is about to close.
>   `event.preventDefault()` stops it, then we ask. If the answer is yes, `allowQuit = true` lets
>   the next close through. Without this, the X would skip the story's "Are you sure?" rule.
> - **`setWindowOpenHandler`**: clicking a `target="_blank"` link would normally open a second
>   Electron window. We send `https://` links to the user's real browser instead, and refuse
>   everything else.
> - **`autoHideMenuBar: true`** hides the File/Edit/View menu. Press `Alt` to show it. `Ctrl+Shift+I`
>   (DevTools) still works.

> **⚠️ Lesson (2026-10-09)**
>
> - **Exit quits the whole program here.** `confirmExit` calls `app.quit()`, and
>   `window-all-closed` also quits. Once the program is gone, no timer runs. That's acceptable for
>   this guide (it fires at 5:30 PM and relies on the start-up catch-up), but **not for my design**:
>   my end-of-day batch runs at 23:55, so closing the window must leave the main process running
>   (`my-design.md` §2, §7). How to really quit and how to get the window back are still open
>   decisions (`my-design.md` §8).

---

## Step 9. The full bridge: `preload.js`

Replace `preload.js`:

```js
// PRELOAD: the bridge. Runs before the page loads and hands it a small, safe API: window.api.
// The page can call only these functions; it never gets Node, the file system or the database.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listAvailableJobs: () => ipcRenderer.invoke('jobs:available'),
  getJob: (jobNumber) => ipcRenderer.invoke('jobs:get', jobNumber),
  getStatus: (employeeNumber) => ipcRenderer.invoke('employee:status', employeeNumber),
  punchIn: (employeeNumber, jobNumber) => ipcRenderer.invoke('punch:in', employeeNumber, jobNumber),
  punchOut: (employeeNumber) => ipcRenderer.invoke('punch:out', employeeNumber),
  report: (employeeNumber, fromDate, toDate) =>
    ipcRenderer.invoke('report:get', employeeNumber, fromDate, toDate),
  exit: () => ipcRenderer.invoke('app:exit'),
});
```

Run `npm start`. The old Step 3 page still loads. Its `ping` call fails because `ping` no
longer exists, and that's expected.

**Checkpoint: call the API by hand.** Open DevTools (`Ctrl+Shift+I`) → **Console**, and type:

```js
await window.api.listAvailableJobs()
await window.api.getJob(1042)
await window.api.punchIn('abc', 1042)
await window.api.report(4521, '2026-10-01', '2026-10-31')
```

You should see:

1. `{ ok: true, data: [ …5 jobs… ] }`
2. The job with its `parts`
3. `{ ok: false, error: 'Employee ID must be a positive whole number.' }`
4. The report, with days and `totalMinutes: 1040`

Also check the terminal: it printed `Database file: C:\Users\...\AppData\Roaming\punch-clock\punch-clock.db`.

> **Understand the code**
>
> - Each line is one "endpoint". The channel names (`'punch:in'`) are just strings that must match
>   `main.js` exactly. A typo means "No handler registered for 'punch:inn'" in the console.
> - Testing `window.api` from the console is your Electron equivalent of testing an API with
>   Postman before building the UI.

---

# Part D: The user interface (your A1 mockup)

## Step 10. The layout: `renderer/index.html` + `renderer/style.css`

Replace `renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <!-- Only our own files may load: no inline scripts, nothing from the internet. -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self'"
    />
    <title>ABC Industries - Punch-In/Out System</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="top">
      <section class="jobs">
        <h2>Available Jobs:</h2>
        <ul id="job-list" class="job-list"></ul>
        <p class="hint">jobs no one is currently working on</p>
      </section>

      <section class="details-panel">
        <h2>Job Details: <span class="hint">(selected job — also fills Job ID below)</span></h2>
        <div class="details-box">
          <p id="details-empty" class="hint">Select a job on the left.</p>
          <div id="details" hidden>
            <p>
              <b>Job ID:</b> <span id="d-id"></span>
              <b class="spaced">Title:</b> <span id="d-title"></span>
            </p>
            <h3>Description:</h3>
            <p id="d-description"></p>
            <h3>Assembly Instructions:</h3>
            <p><a id="d-instructions" target="_blank"></a></p>
            <h3>Parts List:</h3>
            <ul id="d-parts"></ul>
          </div>
        </div>
      </section>
    </main>

    <footer class="controls">
      <div class="fields">
        <label>
          Job ID:
          <input id="job-id" inputmode="numeric" />
          <small>required: Punch In only</small>
        </label>
        <label>
          Employee ID:
          <input id="employee-id" inputmode="numeric" placeholder="4521" />
          <small>required: all actions</small>
        </label>
        <label>
          &nbsp;
          <output id="status">Enter your Employee ID</output>
          <small>updates once Employee ID entered</small>
        </label>
        <label>
          Start Date:
          <input id="start-date" type="date" />
          <small>required: Report only</small>
        </label>
        <label>
          End Date:
          <input id="end-date" type="date" />
          <small>required: Report only</small>
        </label>
      </div>
      <div class="buttons">
        <button id="punch-in">Punch In</button>
        <button id="punch-out">Punch Out</button>
        <button id="report">Report</button>
        <p id="message" class="message"></p>
        <button id="exit" class="exit">Exit</button>
      </div>
    </footer>

    <dialog id="report-dialog">
      <h2 id="r-heading"></h2>
      <p id="r-range" class="hint"></p>
      <div id="r-body"></div>
      <p id="r-total" class="total"></p>
      <form method="dialog"><button>Close</button></form>
    </dialog>

    <script src="app.js"></script>
  </body>
</html>
```

Create `renderer/style.css`:

```css
/* Grey "classic Windows" look from the A1 mockup. */
* { box-sizing: border-box; }

body {
  margin: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #c0c0c0;
  font: 14px Tahoma, Verdana, sans-serif;
  color: #000;
}

h2 { font-size: 14px; font-weight: normal; margin: 0 0 4px; }
h3 { font-size: 14px; margin: 12px 0 2px; }
p { margin: 0; }
.hint { color: #555; font-style: italic; font-size: 12px; }

.top { flex: 1; display: grid; grid-template-columns: 300px 1fr; gap: 12px; min-height: 0; }
.jobs, .details-panel { display: flex; flex-direction: column; min-height: 0; }

.job-list {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  background: #fff;
  border: 2px inset #fff;
}
.job-list li { padding: 4px 8px; cursor: pointer; }
.job-list li:hover { background: #e4e4e4; }
.job-list li.selected { background: #000; color: #fff; }
.job-list li.empty { color: #555; cursor: default; }

.details-box { flex: 1; overflow-y: auto; padding: 12px; border: 2px inset #fff; }
.details-box ul { margin: 2px 0; padding-left: 20px; }
.spaced { margin-left: 32px; }

.controls { padding: 10px 12px; border: 2px groove #fff; }
.fields { display: flex; gap: 14px; flex-wrap: wrap; }
.fields label { display: flex; flex-direction: column; gap: 2px; }
.fields input, .fields output {
  width: 130px;
  padding: 3px 5px;
  font: inherit;
  background: #fff;
  border: 2px inset #fff;
}
.fields output { width: 260px; }
.fields small { font-size: 11px; color: #555; font-style: italic; }

.buttons { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
button {
  min-width: 110px;
  padding: 5px 12px;
  font: inherit;
  background: #c0c0c0;
  border: 2px outset #fff;
  cursor: pointer;
}
button:active { border-style: inset; }
.exit { font-weight: bold; }
.message { flex: 1; padding: 0 8px; }
.message.error { color: #b00000; font-weight: bold; }

dialog { width: 560px; max-height: 80vh; border: 2px outset #fff; background: #c0c0c0; }
dialog h2 { font-weight: bold; }
dialog h3 { border-bottom: 1px solid #888; }
dialog table { width: 100%; border-collapse: collapse; background: #fff; }
dialog td { padding: 3px 6px; border-bottom: 1px solid #ddd; }
dialog td:nth-child(2) { width: 120px; }
dialog td:nth-child(3) { width: 100px; text-align: right; }
.day-total { text-align: right; margin: 4px 0 8px; }
.total { font-weight: bold; margin: 12px 0; }
```

Empty `renderer/app.js` (delete its contents, save), then run `npm start`.

**Checkpoint:** the window looks like your A1 mockup, with an empty jobs list, an empty details
panel, the fields and the buttons. Nothing works yet.

> **Understand the code**
>
> - This is ordinary HTML and CSS, written exactly as for a website.
> - One addition to the mockup: the `#message` line between Report and Exit. The mockup had no
>   place to say "Punched in to #1042 at 09:12" or show errors.
> - `<input type="date">` shows a calendar picker in `mm/dd/yyyy`, like your mockup. Its `.value`
>   is always `YYYY-MM-DD`, the format `lib/time.js`'s `parseDate` reads.
> - `<dialog>` is a built-in HTML pop-up. `showModal()` opens it, and the `<form method="dialog">`
>   button closes it. We use it for the report.
> - `.top` is a CSS grid (300 px list + the rest for details), and `body` is a column flexbox
>   so the controls stick to the bottom. `min-height: 0` lets the inner lists scroll instead of
>   stretching the window.

---

## Step 11. Make it work: `renderer/app.js`

Build this file in four pieces, checking after each one. **Keep the `// ---------- start ----------`
block at the very bottom**, and add each new piece *above* it.

### 11a. Helpers, the jobs list and job details

```js
// RENDERER: runs inside the window, like a 'use client' component.
// It has no Node and no database. It only talks to main through window.api (see preload.js).

const $ = (id) => document.getElementById(id);
let selectedJobNumber = null;

// ---------- helpers ----------

function showMessage(text, isError = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', isError);
}

// Every window.api call answers { ok: true, data } or { ok: false, error }.
async function run(request) {
  const result = await request;
  if (!result.ok) {
    showMessage(result.error, true);
    return null;
  }
  return result.data;
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function formatMinutes(total) {
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`;
}

function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text; // textContent, never innerHTML: data stays data
  if (className) el.className = className;
  return el;
}

// ---------- jobs list + details ----------

async function loadJobs() {
  const jobs = await run(window.api.listAvailableJobs());
  if (!jobs) return;

  const list = $('job-list');
  list.replaceChildren();
  for (const job of jobs) {
    const li = element('li', `#${job.job_number}  ${job.title}`);
    li.dataset.jobNumber = job.job_number;
    li.classList.toggle('selected', job.job_number === selectedJobNumber);
    li.addEventListener('click', () => selectJob(job.job_number));
    list.append(li);
  }
  if (jobs.length === 0) list.append(element('li', 'No jobs available', 'empty'));
}

async function selectJob(jobNumber) {
  const job = await run(window.api.getJob(jobNumber));
  if (!job) return;

  selectedJobNumber = job.job_number;
  $('job-id').value = job.job_number;
  for (const li of $('job-list').children) {
    li.classList.toggle('selected', Number(li.dataset.jobNumber) === job.job_number);
  }
  showDetails(job);
}

function showDetails(job) {
  $('details-empty').hidden = true;
  $('details').hidden = false;
  $('d-id').textContent = `#${job.job_number}`;
  $('d-title').textContent = `${job.title} — ${job.quantity} pc`;
  $('d-description').textContent = job.description;
  $('d-instructions').href = job.instructions_url;
  $('d-instructions').textContent = job.instructions_url.split('/').pop();
  $('d-parts').replaceChildren(
    ...job.parts.map((part) => element('li', `${part.part_number} (qty ${part.qty})`)),
  );
}

// Typing a Job ID by hand also shows its details.
$('job-id').addEventListener('change', () => {
  if ($('job-id').value.trim() !== '') selectJob($('job-id').value.trim());
});

// ---------- start ----------

loadJobs();
```

**Checkpoint:**
- The five jobs appear.
- Clicking one highlights it in black, fills **Job ID**, and shows its description and parts list.
- Typing `1055` into Job ID and pressing Tab shows job 1055.
- Typing `9999` shows "Job #9999 does not exist." in red.
- Clicking the instructions link opens your normal browser (it's an example.com placeholder, so
  the page itself won't exist).

> **Understand the code**
>
> - `run(request)` is a tiny helper so every call handles errors the same way: show the red
>   message and return `null`. Callers just check `if (!jobs) return;`.
> - **`textContent`, never `innerHTML`, for data.** A job title like `<img src=x onerror=...>`
>   would run as code with `innerHTML`. With `textContent` it's just text. This is XSS
>   protection, and in a desktop app it matters even more.
> - `li.dataset.jobNumber` stores data on the element (`data-job-number="1042"`). It comes back
>   as a string, hence the `Number(...)` when comparing.
> - `replaceChildren()` empties an element; `replaceChildren(...items)` empties and refills it.
> - The `change` event fires when you leave the field (Tab or click away), not on every keystroke.

### 11b. The employee status box

Add above the `start` block:

```js
// ---------- employee status box ----------

let statusTimer = null;
$('employee-id').addEventListener('input', () => {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(refreshStatus, 300); // wait until they stop typing
});

async function refreshStatus() {
  const employeeId = $('employee-id').value.trim();
  if (employeeId === '') {
    $('status').textContent = 'Enter your Employee ID';
    return;
  }
  const result = await window.api.getStatus(employeeId);
  if (!result.ok) {
    $('status').textContent = result.error;
    return;
  }
  const { name, current } = result.data;
  $('status').textContent = current
    ? `${name}: on #${current.job_number} since ${current.since.slice(0, 5)}`
    : `${name}: not currently punched in`;
}
```

**Checkpoint:**
- Type `4521` and the box shows *Maria Lopez: not currently punched in*.
- Type `99` and it shows *Unknown employee number 99.*

> **Understand the code**
>
> - **Debounce:** every keystroke restarts a 300 ms timer, so we ask main only once the person
>   stops typing, not 4 times for "4521". It's the same trick as a search box.
> - This doesn't use `run()`, because a wrong ID here should show in the status box, not as a red
>   error message.
> - `current.since` is the local time `lib/punch.js` already formatted from `start_ms`.
>   `.slice(0, 5)` turns `'09:12:44'` into `'09:12'`.

### 11c. The four buttons

Add above the `start` block:

```js
// ---------- the four buttons ----------

async function afterChange() {
  await loadJobs();
  await refreshStatus();
}

$('punch-in').addEventListener('click', async () => {
  const result = await run(window.api.punchIn($('employee-id').value, $('job-id').value));
  if (!result) return;
  const time = result.time.slice(0, 5);
  showMessage(
    result.punchedOutOf
      ? `Punched out of #${result.punchedOutOf} and in to #${result.punchedInTo} at ${time}.`
      : `Punched in to #${result.punchedInTo} at ${time}.`,
  );
  await afterChange();
});

$('punch-out').addEventListener('click', async () => {
  const result = await run(window.api.punchOut($('employee-id').value));
  if (!result) return;
  showMessage(`Punched out of #${result.punchedOutOf} at ${result.time.slice(0, 5)}.`);
  await afterChange();
});

$('report').addEventListener('click', async () => {
  const report = await run(
    window.api.report($('employee-id').value, $('start-date').value, $('end-date').value),
  );
  if (!report) return;
  showMessage('');
  showReport(report);
  $('report-dialog').showModal();
});

$('exit').addEventListener('click', () => window.api.exit());
```

**Checkpoint (walk through the story):**

1. Employee `4521`, click job 1042, **Punch In**. It says *Punched in to #1042 at …*, 1042 leaves
   the list, and the status box says *on #1042 since …*.
2. Click job 1047, **Punch In**. It says *Punched out of #1042 and in to #1047*. 1042 is back
   in the list and 1047 is gone.
3. **Punch In** again. Red: *You are already punched in on job #1047.*
4. **Punch Out**. It says *Punched out of #1047 …*. **Punch Out** again. Red: *You are not punched in on any job.*
5. Clear Employee ID and click **Punch Out**. Red: *Employee ID must be a positive whole number.*
6. **Exit** → the Windows "Are you sure?" dialog → **No** keeps the app open. The window's
   **X** asks the same. **Yes, exit** closes it.

(The **Report** button will error until 11d. `showReport` doesn't exist yet.)

> **Understand the code**
>
> - We send the **raw text** from the inputs (`'4521'`, maybe `'abc'`) and let main validate it. One
>   place checks the rules, and the window doesn't need to duplicate them.
> - `afterChange()` reloads the list and status after anything that changes data. Next.js has
>   `router.refresh()` for this. Here, you do it yourself.
> - `refreshStatus` is defined in 11b and used here. JS function declarations are "hoisted", so
>   their order in the file doesn't matter.

### 11d. The Jobs Completed Report

Add above the `start` block:

```js
// ---------- report dialog ----------

function showReport(report) {
  const { employee, fromDate, toDate, days, totalMinutes } = report;
  $('r-heading').textContent = `Jobs Completed Report: ${employee.name} (#${employee.employee_number})`;
  $('r-range').textContent = `${formatDate(fromDate)} to ${formatDate(toDate)}`;

  const body = $('r-body');
  body.replaceChildren();
  if (days.length === 0) body.append(element('p', 'No completed work in this period.'));

  for (const day of days) {
    const table = element('table');
    for (const entry of day.entries) {
      const row = element('tr');
      row.append(
        element('td', `#${entry.job_number} ${entry.title}`),
        element('td', `${entry.start.slice(0, 5)}–${entry.end.slice(0, 5)}`),
        element('td', formatMinutes(entry.minutes)),
      );
      table.append(row);
    }
    body.append(
      element('h3', formatDate(day.date)),
      table,
      element('p', `Day total: ${formatMinutes(day.minutes)}`, 'day-total'),
    );
  }
  $('r-total').textContent = `Total for period: ${formatMinutes(totalMinutes)}`;
}
```

**Checkpoint:**
- Employee `4521`, Start Date **10/01/2026**, End Date **10/31/2026**, **Report**:
  - 10/05/2026: two jobs, *Day total: 8 h 00 min*
  - 10/06/2026: one job, *9 h 20 min*
  - Plus whatever you punched today
  - *Total for period* at the bottom
- **Close** works.
- Report with no dates: *Enter a Start Date.*
- Start Date after End Date: *Start Date must be on or before End Date.*

> **Understand the code**
>
> - This only *displays* data. The grouping by day, the totals and the UTC → local conversion
>   (`entry.start`, `entry.end`, `day.date`) were already done in `lib/punch.js`, so the window
>   doesn't need any business logic.
> - `const { employee, ... } = report` is destructuring, like the `body.title` reads in your API routes.

> **⚠️ Lesson (2026-10-09)**
>
> **This report doesn't match my A1 mock, and the mock is my spec.** The guide shows 24-hour
> `09:12`–`11:47` in one cell, `#1042 title` in one cell and `8 h 00 min`. My mock has separate
> columns Job # · Title · Start · End · Duration, 12-hour times (`8:02 AM`), day headings like
> `Monday, September 14, 2026`, durations like `3h 45m`, and `Employee ID` / `Period` in the
> header (`my-design.md` §6). Lesson: check generated UI code against your own mockup, not just
> against "it runs".

---

# Part E: Automatic punch-out at 5:30 PM

## Step 12. A timer in the main process

The story says: *if the user forgot to punch out, the program automatically punches everyone
who has not already punched out at 5:30 PM.* Websites can't do this alone (no page is open at
5:30). A desktop app's main process can, because it keeps running.

**12a. `main.js`.** Add this import under the other `require` lines:

```js
const { formatDate, localDayRange, atLocalTime } = require('./lib/time');
```

Then add this whole section **above** `// ---------- start-up ----------`:

```js
// ---------- automatic punch-out at 5:30 PM ----------

// Test it today with:  npx electron . --punch-out=14:05
const cutoffSwitch = app.commandLine.getSwitchValue('punch-out');
const cutoff = /^\d{2}:\d{2}$/.test(cutoffSwitch) ? cutoffSwitch : '17:30';
let lastAutoRunDate = null;

function checkAutoPunchOut() {
  const now = Date.now();
  const today = formatDate(now);
  if (now < atLocalTime(now, cutoff) || lastAutoRunDate === today) return;

  lastAutoRunDate = today;
  // Everything still open that started before tonight's midnight.
  const closed = punch.autoPunchOut(localDayRange().endMs, cutoff);
  console.log(`[auto punch-out] ${today} ${cutoff}: closed ${closed} event(s)`);
  if (closed > 0) win?.webContents.send('jobs:changed'); // tell the window to refresh
}

function closeForgottenPunches() {
  // Anyone still open from an earlier day (the app was off at 5:30): close them at that day's cut-off.
  const closed = punch.autoPunchOut(localDayRange().startMs, cutoff); // started before today's midnight
  if (closed > 0) console.log(`[start-up] closed ${closed} forgotten event(s)`);
}
```

Update the start-up block so it looks like this (three new lines):

```js
app.whenReady().then(() => {
  const dbFile = path.join(app.getPath('userData'), 'punch-clock.db');
  console.log('Database file:', dbFile);
  punch = createPunch(openDb(dbFile));

  registerHandlers();
  closeForgottenPunches();
  createWindow();

  checkAutoPunchOut();
  setInterval(checkAutoPunchOut, 30 * 1000);
});
```

Change the comment at the top of `main.js` to
`// MAIN PROCESS: full Node.js. Owns the window, the database, the 5:30 PM timer and quitting.`

**12b. `preload.js`.** Add one line inside the `api` object, after `exit`:

```js
  onJobsChanged: (callback) => ipcRenderer.on('jobs:changed', () => callback()),
```

**12c. `renderer/app.js`.** In the `start` block, add the first line so it reads:

```js
// ---------- start ----------

window.api.onJobsChanged(afterChange); // main tells us after the 5:30 PM auto punch-out
loadJobs();
```

**Checkpoint (you don't have to wait until 5:30):**

1. Look at the clock and pick a time **2 minutes from now**, for example `14:05`.
2. Start the app with a test cut-off: `npx electron . --punch-out=14:05`
3. Punch employee `4522` in to job 1058. It leaves the list.
4. Wait. Within 30 seconds of 14:05, the terminal prints
   `[auto punch-out] ... 14:05: closed 1 event(s)`. **1058 reappears in the list by itself**,
   and the status box (if 4522 is typed in) updates.

> **Understand the code**
>
> - `setInterval(checkAutoPunchOut, 30 * 1000)` runs the check every 30 seconds for as long as
>   the app is open. `lastAutoRunDate` makes it fire **once per day**, not every 30 seconds after
>   5:30.
> - **Is it past 5:30?** `atLocalTime(now, cutoff)` is today's 5:30 PM in ms, so it's a plain number
>   comparison: `now < cutoffMs` means "not yet".
> - **Same function, two ranges.** The 5:30 check closes everything that started before *tonight's*
>   midnight (`localDayRange().endMs`). Start-up closes only what started before *this morning's*
>   midnight (`localDayRange().startMs`), so people already punched in today are left alone.
> - **Main → window push:** `win.webContents.send('jobs:changed')` is the opposite direction from
>   `invoke`. Main starts the conversation. `ipcRenderer.on` in the preload listens, and the page
>   only gets a callback, never `ipcRenderer` itself. It's like the server pushing a message in
>   your chatroom.
> - **`closeForgottenPunches`**: if the computer was off at 5:30, open events from earlier days are
>   closed at 5:30 PM *of the day they started* when the app starts the next morning.
> - `app.commandLine.getSwitchValue('punch-out')` reads `--punch-out=14:05` from the command
>   line. That's a *test hook*: a way to test time-based code without waiting for 5:30.
> - `win?.webContents`: `?.` again, in case the window doesn't exist.

> **⚠️ Lesson (2026-10-09)**
>
> **This reads the story as "act at 5:30 PM", and that has a cost.** At 5:30 the check closes
> everyone still in, including someone actively working overtime at that moment, so real overtime
> can never be recorded. My reading: "at the end of the day" is **when** the program checks
> (23:55), and "at 5:30 PM" is the **end time it records** (`my-design.md` §1). Punch-out stays
> possible until then; only forgotten punch-outs get 5:30.
>
> What I keep from this step: the idea of a timer in the main process, the once-per-day guard, the
> start-up catch-up for missed runs (`closeForgottenPunches`), and the test hook for running it
> without waiting for the real time.
>
> **A2 lesson:** one ambiguous sentence in the story → two valid designs → rework when I noticed.
> Ask the client early; budget buffer for it.

---

# Part F: Package it as a Windows installer

## Step 13. Electron Forge

Until now you've run the app through `npm start`. A real user gets an installer. **Electron
Forge** is the official tool for that.

**13a. Install Forge and two "makers"** (the installer types):

```
npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-zip
```

**13b. Create `forge.config.js`** in the project root:

```js
// Electron Forge settings: how to package the app and which installers to make.
module.exports = {
  packagerConfig: {
    asar: true, // bundle the app's files into one archive
    ignore: [/^\/docs/, /^\/scripts/, /^\/out/],
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: 'punch_clock' } }, // Windows Setup.exe
    { name: '@electron-forge/maker-zip', platforms: ['win32', 'darwin', 'linux'] }, // portable zip
  ],
};
```

**13c. Fill in `package.json`.** Forge requires a `description` and an `author`, so put real
text in both. Add two scripts:

```json
  "description": "ABC Industries Punch-In/Out System (COMP 361 learning project)",
  "author": "Your Name",
  "scripts": {
    "start": "electron .",
    "try-db": "node scripts/try-db.js",
    "package": "electron-forge package",
    "make": "electron-forge make"
  },
```

**13d. Build:**

```
npm run make
```

It takes a minute or two (`npm run package` alone builds just the app folder).

**Checkpoint:** in the new `out\` folder:

| Path                                                  | What it is                                         |
| ----------------------------------------------------- | -------------------------------------------------- |
| `out\punch-clock-win32-x64\punch-clock.exe`           | The app itself. Double-click it, no npm needed     |
| `out\make\squirrel.windows\x64\punch-clock-1.0.0 Setup.exe` | **The installer** you'd give ABC Industries |
| `out\make\zip\win32\x64\punch-clock-win32-x64-1.0.0.zip`    | Portable version: unzip and run              |

Double-click `punch-clock.exe` in `out\punch-clock-win32-x64\`. Your app opens as a real
program, with the same data as before, because it uses the same `%APPDATA%\punch-clock\`
database.

**Optional:** run `Setup.exe`. It installs into `%LOCALAPPDATA%\punch_clock\`, adds a
Start-menu shortcut and starts the app. Uninstall it from **Windows Settings → Apps**.
(Windows may warn "unknown publisher" because the app isn't code-signed. That's normal for
your own builds.)

> **Understand the code**
>
> - **package** = copy Electron + your files into one folder with an `.exe`. **make** = wrap that
>   folder into installers. Squirrel is the standard Windows installer for Electron apps.
> - **`asar: true`** packs your files into `resources\app.asar`, one archive. `fs.readFileSync` can
>   still read `db\schema.sql` from inside it, because Electron makes `fs` understand asar files.
> - **`ignore`** keeps the guide and test scripts out of the shipped app.
> - **Why the database isn't in `out\`:** the installed app folder is read-only and gets replaced on
>   every update. `app.getPath('userData')` puts data where it survives, the same reason Step 8
>   didn't use the project folder.
> - Add `out/` to `.gitignore` if you use git. It's big and rebuildable.

---

## Practice drills: do these until they feel easy

Try them **without AI**, and time yourself.

1. **Add a field end to end:** show each job's **customer name** in Job Details.
   <details><summary>Steps (open only if stuck)</summary>

   1. Delete `%APPDATA%\punch-clock\punch-clock.db` (the app recreates it).
   2. `db/schema.sql`: add `customer TEXT NOT NULL DEFAULT ''` to `jobs`. In `db/seed.sql`, add
      the column to the `INSERT` and a customer for each job.
   3. `lib/punch.js`: nothing! `getJob` uses `SELECT *`.
   4. `renderer/index.html`: add `<h3>Customer:</h3><p id="d-customer"></p>`.
   5. `renderer/app.js` → `showDetails`: `$('d-customer').textContent = job.customer;`
   </details>

2. **A new rule:** refuse punch-in after the cut-off time ("It's after 5:30 PM. See your supervisor.").
   <details><summary>Steps</summary>

   The rule lives in `lib/punch.js`, so `punchIn` needs to know the cut-off. Give `createPunch`
   a second parameter `(db, cutoff)`, pass it from `main.js` (move the `cutoff` lines above
   start-up), and check `now >= atLocalTime(now, cutoff)` before the transaction. Update
   `scripts/try-db.js` too.
   </details>

   > **⚠️ Lesson (2026-10-09):** in my design this isn't a drill, it's a real rule
   > (`my-design.md` §2). It's what makes the 5:30 PM end time always valid.

3. **Open the report in its own window** instead of `<dialog>`. Create a second `BrowserWindow`
   in main with `report.html`, and send it the data with `webContents.send` after
   `did-finish-load`. (This one takes time. It's how multi-window desktop apps work.)

4. **Break it on purpose and read the error:**
   - Typo a channel name in `preload.js` (`'punch:inn'`). In the DevTools console you get
     *No handler registered for 'punch:inn'*.
   - Remove the `preload` line from `webPreferences`. You get `window.api is undefined`.
   - Add `<script>alert(1)</script>` inside `index.html`. The CSP blocks it, and the console says why.
   - Throw `new Error('boom')` inside `punchOut`. The window says *Something went wrong. See the
     terminal.* and the terminal shows the stack trace.

5. **Explain it out loud, in two minutes**, pointing at the files: *"The button calls
   `window.api.punchIn` → preload `invoke`s the `'punch:in'` channel → main's `handle` checks the
   input with `toId` → `lib/punch.js` runs SQL in a transaction → SQLite file → `{ ok, data }`
   back to the window, which redraws the list."* If you can say this, you understand Electron.

---

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `npm : running scripts is disabled on this system` (PowerShell) | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use the **Command Prompt** terminal |
| `npm start` errors like `Cannot read properties of undefined (reading 'whenReady')` or `Cannot find module 'electron'` | The variable `ELECTRON_RUN_AS_NODE` is set (some tools launched from VS Code set it). In that terminal: `Remove-Item Env:ELECTRON_RUN_AS_NODE`, then `npm start` |
| `window.api is undefined` | `preload` path wrong in `webPreferences`, or `preload.js` has an error. Check the DevTools console |
| `Error invoking remote method ... No handler registered` | Channel name in `preload.js` doesn't match `main.js`, or `registerHandlers()` isn't called |
| Changed `main.js`/`lib/` but nothing changed | Main-process code needs a **full restart**: close the app, `npm start` again |
| Changed `renderer/` files | Press `Ctrl+R` in the window to reload. No restart needed |
| Where's my `console.log`? | Main/lib → VS Code terminal. Renderer → `Ctrl+Shift+I` → Console |
| Old/strange data, or you changed `schema.sql` | Close the app, delete `%APPDATA%\punch-clock\punch-clock.db`, start again (it re-seeds) |
| `SQLITE_CONSTRAINT: UNIQUE constraint failed` | The partial unique indexes caught a double punch-in. Your JS check missed a case |
| Times show as 1970, or minutes are 1000× too small | You stored **seconds**, not milliseconds. `Date.now()` is ms; SQLite's `strftime('%s', ...)` is seconds, so multiply by 1000 |
| Times are off by 4–5 hours | Something used UTC for display (`toISOString()`, or SQLite `datetime(...)` without `'localtime'`). Format with `lib/time.js` instead |
| `npm run make` fails about description/author | Fill in both in `package.json` (Step 13c) |
| `npx electron . --punch-out=...` ignored | Use `HH:MM` with two digits (`09:05`, not `9:05`) |

---

## Cheat sheet

| I want to… | Do this |
| ---------- | ------- |
| Run the app | `npm start` |
| Test the data layer without Electron | `npm run try-db` |
| Test the 5:30 PM punch-out now | `npx electron . --punch-out=HH:MM` |
| Open DevTools | `Ctrl+Shift+I` in the window |
| Reload the window after renderer changes | `Ctrl+R` |
| Add an "endpoint" | `handle('name', (...args) => ...)` in `main.js` **and** `name: (...) => ipcRenderer.invoke('name', ...)` in `preload.js` |
| Push from main to the window | `win.webContents.send('event')` + `ipcRenderer.on('event', ...)` in preload |
| Native dialog | `dialog.showMessageBox(win, {...})` in main |
| Open a link in the real browser | `shell.openExternal(url)` in main |
| Where the database lives | `%APPDATA%\punch-clock\punch-clock.db` (printed at start-up) |
| Run SQL safely | `db.prepare('... WHERE id = ?').get(id)` / `.all(...)` / `.run(...)` |
| Several changes as one | `db.exec('BEGIN')` … `db.exec('COMMIT')`, `ROLLBACK` in `catch` |
| Build the `.exe` | `npm run package` |
| Build the installer | `npm run make` → `out\make\` |

---

## How this maps to A2

- **Fill in the time log** at the top, and compare it with the estimates you wrote before starting.
  - Where were you furthest off?
  - Was it the code, or learning the tools?
- **Look at your activity graph again.** Which parts of this build could three developers have
  done **at the same time**, and what would they have had to agree on first so they didn't block
  each other? (Hint: think about what Step 9's `window.api` list is.)
- **Which tasks did you forget** in your A2 list? Testing, packaging, sample data and the
  auto punch-out timer are common ones.
- The layers you built (UI → bridge → main/validation → data layer → SQLite) are the same layers
  you'd use for the team project, whether it's a desktop app, a website or a game backend.
