# `lib/db.js` and `lib/time.js`: line-by-line explained

A study note for recall. Read it next to the real files: [lib/db.js](../lib/db.js) and [lib/time.js](../lib/time.js).

---

# Part 1: `lib/db.js`

## The two ways to `require`

```js
const fs = require("node:fs");                    // take the WHOLE module object
const { DatabaseSync } = require("node:sqlite");  // take ONE property out of it
```

`require(...)` returns an object (the module's `module.exports`). From there you can either:

- keep the whole object and write `fs.readFileSync(...)` and `path.join(...)`, or
- **destructure** it and pull out just the parts you need. `const { DatabaseSync } = require(...)` is short for `const DatabaseSync = require("node:sqlite").DatabaseSync`.

Use whichever reads better. A module you use for many functions (`fs`, `path`) usually stays whole. A module you use for one thing usually gets destructured.

The `node:` prefix means "Node's built-in module". It isn't from npm and isn't in `node_modules`.

`node:sqlite` comes from **Node** (built in since v22.5). Electron bundles a copy of Node, so it works inside Electron too. It also works in plain `node`, for example in `scripts/try-db.js`.

## `readSql(name)`

```js
function readSql(name) {
  return fs.readFileSync(path.join(__dirname, "..", "db", name), "utf8");
}
```

Read it from the inside out:

1. **`__dirname`**: the folder **this file** lives in, which is `D:\...\punch-clock\lib`. Node provides it automatically in CommonJS files (`"type": "commonjs"` in package.json).
2. **`path.join(__dirname, "..", "db", name)`**: `..` goes up one folder, giving `D:\...\punch-clock\db\schema.sql`. `path.join` inserts the right slashes for the OS (`\` on Windows) and resolves the `..`.
3. **`fs.readFileSync(path, "utf8")`**: reads the file and returns its contents as a **string**.
   - Without `"utf8"` you get a `Buffer` (raw bytes) instead of text.
   - `Sync` means it blocks until the file has been read. That's fine here because it runs once at startup.

**Why not just write `"./db/schema.sql"`?** A relative path is resolved from the folder you **launched** the program from (`process.cwd()`), not from where the file sits. Start the app from another folder, or install it, and the relative path breaks. `__dirname` always points at the file's own folder.

`readSql` isn't exported, so it's private to db.js.

## `openDb(filePath)`

```js
const db = new DatabaseSync(filePath);
```

`DatabaseSync` is a **class**, so `new` creates an instance. This opens the file, or creates an empty one if it doesn't exist. That instance is your connection.

SQLite is **not a server**. It's a library running inside your own process, and the whole database is one ordinary file. Because it's a local file, the calls are synchronous: no `await`.

```js
db.exec("PRAGMA foreign_keys = ON");
```

**SQLite gotcha:** foreign keys are **OFF by default**, and the setting is **per connection**. Without this line, `REFERENCES employees(...)` in the schema is just decoration, and SQLite will happily store a work event for employee 999 who doesn't exist. That's why this runs every time the database is opened. A `PRAGMA` is a SQLite-specific settings command.

```js
db.exec(readSql("schema.sql"));
```

`exec` runs a **whole script**, including several statements separated by `;`. (`prepare` only accepts a single statement.) Because every statement in schema.sql uses `IF NOT EXISTS`, running it on every startup is safe: the first run creates the tables, and later runs do nothing.

```js
const { count } = db.prepare("SELECT COUNT(*) AS count FROM jobs").get();
```

Three things happen on this line:

- `.get()` returns **one row as an object**, with the column names as keys.
- `AS count` names that column, so the row is `{ count: 0 }`. Without the alias, the key would literally be `"COUNT(*)"`.
- `const { count } = ...` destructures that object, so `count` is now `0`.

```js
if (count === 0) db.exec(readSql("seed.sql"));
return db;
```

The sample data is inserted only into an **empty** database. Otherwise every launch would insert duplicates (or fail on the primary keys).

```js
module.exports = { openDb };
```

This is CommonJS export syntax: whatever object you assign to `module.exports` is exactly what `require("./db")` returns elsewhere. `{ openDb }` is shorthand for `{ openDb: openDb }`.

## The `db` object's API (used throughout punch.js)

```js
db.exec("...")                 // run SQL text, no results back (schema, PRAGMA, BEGIN/COMMIT/ROLLBACK)
db.prepare("... ? ...")        // compile ONE statement with ? placeholders → a statement object
   .get(a, b)                  //   → first row as an object, or undefined
   .all(a, b)                  //   → array of every row (empty array if none)
   .run(a, b)                  //   → { changes, lastInsertRowid }, for INSERT / UPDATE / DELETE
```

The values you pass fill the `?` placeholders **in order**. Never build SQL with `${}` from user input (SQL injection).

---

# Part 2: `lib/time.js`

## The core idea behind the whole file

- **Store** times as UTC epoch milliseconds (`Date.now()` gives something like `1760000000000`). That's a single number, so it's unambiguous, sorts correctly, and `end - start` is the duration.
- **Show** times in local time ("09:12"), because that's what the employee understands.
- A `Date` object holds the ms internally. Its `getHours()`, `getDate()` and similar methods convert to **local time using the PC's time-zone setting**. Every function in this file relies on that.

## `pad(n)`

```js
return String(n).padStart(2, "0");
```

`5` becomes `"5"`, which becomes `"05"`. `padStart(2, "0")` adds `"0"` to the front until the string is 2 characters long. The `getX()` methods return plain numbers, and without padding you'd show `9:5:3` instead of `09:05:03`. `pad` is private (not exported).

## `formatDate(ms)` and `formatTime(ms)`

```js
const d = new Date(ms);
`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
```

- `new Date(ms)` wraps the number in a Date object.
- **Trap 1:** `getMonth()` is **0-based** (January = 0), hence the `+ 1`.
- **Trap 2:** `getDate()` is the day of the month (1–31). `getDay()` is the **day of the week** (0 = Sunday). It's very easy to mix them up.
- Use `getFullYear()`, not the old `getYear()`.

`formatTime` works the same way with `getHours`, `getMinutes` and `getSeconds`.

## `parseDate(isoDate)`: this one has a hidden reason

```js
const [year, month, day] = isoDate.split("-").map(Number);
return new Date(year, month - 1, day);
```

- `"2026-10-07".split("-")` gives `["2026", "10", "07"]`, an array of **strings**.
- `.map(Number)` converts each one, giving `[2026, 10, 7]`. `Number("07")` is `7`.
- `const [year, month, day] = ...` is **array** destructuring: it assigns by position. (Object destructuring assigns by name.)
- `new Date(y, m, d)` with separate numbers means **local** midnight. The `- 1` is because the month is 0-based again.

**Why not just `new Date("2026-10-07")`?** JavaScript parses a date-only string like that as **UTC midnight**. In a time zone behind UTC (anywhere in the Americas), UTC midnight is still **October 6** locally, so the report would start a day early. Building the date from its parts avoids that.

## `localDayRange(d = new Date())`

```js
const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());     // 00:00 local
const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); // next day 00:00
return { startMs: start.getTime(), endMs: end.getTime() };
```

- `d = new Date()` is a **default parameter**: call it with no argument and you get today.
- Passing only year, month and day leaves out the time, so it defaults to 00:00:00 local. That's how you "cut off" the hours.
- `getDate() + 1` on Oct 31 gives `new Date(2026, 9, 32)`. The Date constructor **rolls over** automatically to Nov 1, and month and year ends are handled for free.
- **Why not `start + 24*60*60*1000`?** On daylight-saving change days, a day is 23 or 25 hours long, so adding a fixed 24 hours would land at 23:00 or 01:00. Asking for "next day at midnight" is always correct.
- `.getTime()` converts back to ms, so the result can go into SQL.
- The query pattern is `start_ms >= startMs AND start_ms < endMs`. That's a **half-open range**, so midnight belongs to exactly one day, never two.

## `atLocalTime(ms, hhmm)`

```js
const d = new Date(ms);
const [hours, minutes] = hhmm.split(":").map(Number);
return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes).getTime();
```

This answers: "On the **same local day** as this timestamp, what's the ms value for 17:30?" It uses the same split, map and destructure trick as `parseDate`, plus the Date constructor with hours and minutes.

It exists for the auto punch-out feature. Someone who forgot to punch out three days ago gets closed at 17:30 **of the day they started**, not at today's 17:30.

## `module.exports`

All five functions are exported; `pad` stays private. The order inside `{ }` doesn't matter, because they're matched by name.

---

# Check yourself

Answer these without looking:

1. What's the difference between `const fs = require("node:fs")` and `const { readFileSync } = require("node:fs")`? How would the calling code look different?
2. What breaks if you replace `path.join(__dirname, "..", "db", name)` with `"../db/" + name`?
3. What would happen to your data if you deleted the `PRAGMA foreign_keys = ON` line?
4. Why is running `schema.sql` on every start harmless, while running `seed.sql` every time is not?
5. `formatDate(Date.now())` on the 1st of a month: what would it show if you forgot the `+ 1`? What if you used `getDay()`?
6. Why does `parseDate` exist when `new Date("2026-10-07")` already parses a date?
7. Why does `localDayRange` add 1 day to the *date* instead of adding 86,400,000 ms?
