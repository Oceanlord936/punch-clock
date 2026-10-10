# JS objects, DB rows and JSON: notes for a Java developer

---

## 1. `{ key: value }` is an object

An object is like a `Map<String, Object>` and a DTO combined, **with no class needed**.

```java
// Java: you need a class (or a Map) first
record Row(int count) {}
Row row = new Row(5);
row.count();          // 5
```

```js
// JS: just write it (an "object literal")
const row = { count: 5 };
row.count;            // 5
```

### Basic operations

```js
const job = { job_number: 1042, title: "Bracket", quantity: 12 };

job.title          // read → "Bracket"
job["title"]       // same, by string (useful when the key is in a variable)
job.parts = [];    // ADD a new property at any time (if it exists, this overwrites it)
job.quantity = 13; // update
job.missing        // a key that doesn't exist → undefined (no exception!)
```

Two big differences from Java:

- **You can add properties at any time.** `getJob` in punch.js does `job.parts = ...` to attach parts to the row.
- **A missing key gives `undefined`, not an error.** That's why a typo like `row.satrt_ms` doesn't crash; it silently produces `undefined`.

### Nesting: objects and arrays

`[ ]` is an array, roughly a Java `List`.

```js
const report = {
  employee: { employee_number: 12, name: "Maria" },   // object inside object
  days: [                                             // array of objects
    { date: "2026-10-07", minutes: 95 },
    { date: "2026-10-08", minutes: 240 },
  ],
};

report.employee.name     // "Maria"
report.days[1].minutes   // 240
```

JS doesn't enforce any shape. `[{ a: 1 }, { b: "x" }, 42, null]` is perfectly legal. Arrays that come from SQL are uniform only because SQL makes every row have the same columns.

### Two shortcuts

```js
// Shorthand property: key and variable share a name
const startMs = 100, endMs = 200;
const range = { startMs, endMs };          // same as { startMs: startMs, endMs: endMs }

// Destructuring: the reverse, pulls keys out into variables
const { startMs, endMs } = localDayRange();
```

`{ }` on the **right** of `=` **builds** an object. `{ }` on the **left** of `=` **takes it apart**.

```js
const row = { count: 5 };
const { count } = row;
console.log(row);    // { count: 5 }
console.log(count);  // 5   ← just a plain number
```

---

## 2. "Where is the class?" Nowhere.

A plain object needs no class. Its "shape" comes from whatever code produced it:

- For DB rows, the shape is set by the **columns in the SELECT**.
- Code can add more properties afterwards (`job.parts = ...`).

JS **does** have classes (`class PunchError extends Error {}`, `new DatabaseSync(...)`). They're mostly used for things with **behaviour**. **Plain data** (rows, inputs, responses) is almost always a plain `{ }`, which is the opposite of the Java habit of writing a class for every DTO.

If you want the shape written down:

| Option | What it gives you |
|---|---|
| TypeScript `interface Job { title: string; parts: Part[] }` | The editor checks every use (closest to Java) |
| JSDoc `/** @typedef {{ title: string }} Job */` + `// @ts-check` | The same checking, while staying in `.js` |
| A comment above the function | Documentation only, nothing is checked |

---

## 3. SQL rows → JS: `.get()`, `.all()`, `.run()`

Example table:

```
people
id | name  | age
---+-------+-----
1  | Ann   | 30
2  | Bob   | NULL
3  | Cara  | 25
```

**One SQL row becomes one JS object:** the column names are the keys and the cells are the values.

| SQL value | JS value |
|---|---|
| `INTEGER` / `REAL` | number |
| `TEXT` | string |
| `NULL` | `null` |

### `.get()`: the first matching row, as one object

```js
db.prepare("SELECT * FROM people WHERE id = ?").get(1)   // { id: 1, name: "Ann", age: 30 }
db.prepare("SELECT * FROM people WHERE id = ?").get(2)   // { id: 2, name: "Bob", age: null }
db.prepare("SELECT * FROM people WHERE id = ?").get(99)  // undefined  ← no match, NOT an error
```

If several rows match, you get only the first one.

### `.all()`: every matching row, as an array of objects (all with the same keys)

```js
db.prepare("SELECT * FROM people WHERE age > ?").all(20)
// [ { id: 1, name: "Ann", age: 30 }, { id: 3, name: "Cara", age: 25 } ]

db.prepare("SELECT * FROM people WHERE age > ?").all(100)
// []   ← no match: empty array, never undefined
```

### `.run()`: for writes; you get a receipt, not rows

```js
db.prepare("INSERT INTO people (name, age) VALUES (?, ?)").run("Dan", 40)
// { changes: 1, lastInsertRowid: 4 }

db.prepare("UPDATE people SET age = ? WHERE id = ?").run(31, 99)
// { changes: 0, ... }   ← nothing matched, no error
```

### The SELECT decides the keys

```
SELECT name FROM people WHERE id = 1              → { name: "Ann" }
SELECT name, age * 2 AS double FROM ...           → { name: "Ann", double: 60 }
SELECT COUNT(*) AS count FROM people              → { count: 3 }
SELECT 1 FROM people WHERE id = 1                 → { "1": 1 }  or undefined
```

The last one is an existence check: you only care whether you get an object or `undefined`.

### Which one to pick

| You expect | Use | Check with |
|---|---|---|
| 0 or 1 row | `.get()` | `if (!row)` |
| a list | `.all()` | `rows.length` |
| to change data | `.run()` | `result.changes` |

**Trap:** "not found" (`undefined`, `[]`, `changes: 0`) **never throws**. If it should stop the operation, check for it yourself and `throw`.

---

## 4. JSON

### JSON is a string

JSON is a **text format** whose syntax was borrowed from JS object literals.

```js
const obj  = { name: "Ann", age: 30 };      // JS object: live data in memory
const text = '{"name":"Ann","age":30}';     // JSON: just characters

JSON.stringify(obj)   // object → string
JSON.parse(text)      // string → object
```

It's like Jackson's `writeValueAsString` / `readValue`, but built into the language.

### JSON is stricter than a JS object

| JS object | JSON |
|---|---|
| Keys without quotes are fine | Keys **must** be in `"double quotes"` |
| `'single quotes'` | Only `"double quotes"` |
| Trailing commas, comments | ❌ |
| Functions, `undefined` | Dropped silently by `stringify` |
| `Date` | Becomes a string; `parse` does **not** turn it back into a Date |

JSON types: string, number, boolean, `null`, array and object.

### Where JSON is used

1. **API calls** (the main use): data travelling between programs over HTTP.
   ```js
   await fetch("/api/punch", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ employee: 12, job: 1042 }),
   });
   const user = await (await fetch("https://api.example.com/users/1")).json(); // parses for you
   ```
2. **Config files:** `package.json`, `tsconfig.json`, VS Code settings.
3. **Small local storage.**

### Saving local data in a JSON file

```js
const fs = require("node:fs");
const path = require("node:path");
const FILE = path.join(__dirname, "todos.json");

function load() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function save(todos) {
  fs.writeFileSync(FILE, JSON.stringify(todos, null, 2)); // null, 2 = pretty-print with 2 spaces
}

const todos = load();
todos.push({ id: Date.now(), text: "Buy milk", done: false });
save(todos);
```

**Every save rewrites the whole file.** You load everything, change it in memory, and write everything back.

| | JSON file | SQLite |
|---|---|---|
| Change one record | Rewrite the whole file | Writes just that row |
| Find records | Load all, filter in JS | `WHERE`, indexes |
| Crash during a write | The file can be corrupted | Transactions: all or nothing |
| Enforce rules | You code them yourself | `UNIQUE`, foreign keys |
| Human-readable, no setup | ✅ | ❌ |

- **JSON file:** small data read and written as one unit (settings, window size, last-used value).
- **SQLite:** records that grow and need queries or rules (punch events).

### In Electron

The window and main.js talk through **IPC**, not HTTP. You pass normal objects and Electron copies them for you, with no `JSON.stringify` needed. The rule is still similar: send plain data (objects, arrays, strings, numbers), not functions or class instances.
