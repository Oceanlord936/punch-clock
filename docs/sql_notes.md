# SQL Notes: COUNT, Aggregates, and Query Order

## 1. Reading `SELECT COUNT(*) AS count FROM jobs`

- `SELECT` starts a query that retrieves data
- `COUNT(*)` counts rows in the result
- `AS count` renames the output column to `count`
- `FROM jobs` says the rows come from the `jobs` table
- Result: one row, one column, the total number of rows in `jobs`

## 2. What `*` means (two different meanings)

| Where | Meaning |
|---|---|
| `SELECT *` | all columns |
| `COUNT(*)` | count rows, without looking at any specific column's value (NULLs included) |

```sql
SELECT COUNT(*) FROM jobs;                 -- every row
SELECT COUNT(status) FROM jobs;            -- rows where status is NOT NULL
SELECT COUNT(DISTINCT status) FROM jobs;   -- distinct non-NULL status values
```

## 3. What goes inside `COUNT()`, `SUM()`, `AVG()`

- The argument is **which column's values to compute on**. It is **not a filter**.
- Row filtering is done by `WHERE` (and splitting into groups by `GROUP BY`).

```sql
SELECT AVG(salary) FROM employees WHERE department = 'Engineering';
-- WHERE keeps Engineering rows, AVG() averages their salary values
```

## 4. `SELECT` always returns a table

- Plain columns: one output row per input row (100 in, 100 out)
- Aggregate functions: collapse many rows into one (100 in, 1 out)
- Mixing them without `GROUP BY` is contradictory:

```sql
SELECT name, SUM(salary) FROM employees;                         -- problem
SELECT department, SUM(salary) FROM employees GROUP BY department;  -- ok
```

## 5. Written order vs. logical execution order

**Written:** `SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT`

**Executed:**

1. `FROM`
2. `JOIN`
3. `WHERE` (filters individual rows)
4. `GROUP BY`
5. Aggregate functions
6. `HAVING` (filters groups)
7. `SELECT` (columns and aliases)
8. `DISTINCT`
9. `ORDER BY`
10. `LIMIT` / `OFFSET`

Shortcut: **FROM/JOIN, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT**

Consequences:

- `WHERE` can't use a `SELECT` alias (SELECT hasn't run yet)
- `WHERE` can't use aggregates, `HAVING` can (aggregation happens in between)
- `ORDER BY` can use a `SELECT` alias (it runs after SELECT)

## 6. Why `SELECT` is written first

- SQL is **declarative** and was designed (1970s, IBM, originally SEQUEL) to read like an English request: "select these things from here where..."
- Putting the desired result first reads naturally, but it doesn't match the real data flow.
- Downsides: autocomplete can't suggest columns before the table is known, aliases can't be used in `WHERE`, and top-to-bottom reading doesn't follow execution.
- Newer syntaxes fix this by putting the source first:
  - DuckDB: `FROM jobs SELECT COUNT(*)`
  - BigQuery pipe syntax: `FROM jobs |> WHERE ... |> AGGREGATE ...`
  - Also LINQ, KQL, PRQL

## Key takeaways

- `COUNT/SUM/AVG(x)`: `x` is the column whose values are crunched; `COUNT(*)` just counts rows.
- `WHERE` chooses rows, the function argument chooses the column to compute on.
- Think in execution order, not written order.
