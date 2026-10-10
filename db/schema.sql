-- ABC Industries punch clock. Safe to run on every start-up (IF NOT EXISTS).


CREATE TABLE IF NOT EXISTS employees (
 employee_number INTEGER PRIMARY KEY ,
 name TEXT NOT NULL 
);

-- jobs table 
CREATE TABLE IF NOT EXISTS jobs (
    job_number INTEGER PRIMARY KEY ,
    title TEXT NOT NULL ,
    quantity INTEGER NOT NULL ,
    description TEXT NOT NULL ,
    instructions_url TEXT NOT NULL 
);

CREATE TABLE IF NOT EXISTS job_parts (
    job_number INTEGER NOT NULL REFERENCES jobs(job_number), -- foreign key 
    part_number TEXT NOT NULL,
    qty INTEGER NOT NULL ,

    PRIMARY KEY(job_number , part_number) -- not allow same pair of job_number and part_number / 
);


-- One row per work event
-- times are UTC epoch milliseconds (Date.now()); convert to local only for display
-- when end_ms is NULL , means they are still punched in 

-- work_events table 
CREATE TABLE IF NOT EXISTS work_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_number INTEGER NOT NULL REFERENCES employees(employee_number),
  job_number      INTEGER NOT NULL REFERENCES jobs(job_number),
  start_ms        INTEGER NOT NULL,   -- Date.now() at punch-in
  end_ms          INTEGER             -- Date.now() at punch-out, NULL = still in
);


-- indexing 
-- one_open_event_per_employee 
CREATE UNIQUE INDEX IF NOT EXISTS one_open_event_per_employee
    ON work_events(employee_number) WHERE end_ms IS NULL ;
CREATE UNIQUE INDEX IF NOT EXISTS one_worker_per_job
    ON work_events(job_number) WHERE end_ms IS NULL; 

