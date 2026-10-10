// import helpers
const {
  formatDate,
  formatTime,
  parseDate,
  localDayRange,
  atLocalTime,
} = require("./time");

// make an own error class , that has an lable
// when rule breaks can use this error
class PuncgError extends Error {}

function createPunch(db) {
  // DB functions =============================

  function requireEmployee(employeeNumer) {
    // similar to postgresql in next js
    // client.query('... WHERE a = $1 AND b = $2', [x, y])
    // With ?, the values fill the placeholders in order: the first argument goes to the first ?, and so on
    const employee = db
      .prepare(
        `SELECT employee_number, name
       FROM employees
      WHERE employee_number = ?`,
      )
      .get(employeeNumber);

    // .get(..) first row, or undeined . use for requireEmployee
    // .all() an array of every row . use for the report
    // .run() {changes , lastInsertRowdid}  . use for INSERT , UPDTATE , DELLET
  }

  // call db , use empleeNUmber
  // return the row where the end is null -> which is still open or never started

  function openEvent(employeeNumber) {
    return db
      .prepare(
        `SELECT w.id, w.job_nu,ber , w.start_ms , j.title
            FROM work_event w JOIN jobs j ON j.job = w.job_number
        WHERE w.employee_number = ? AND w.end_ms IS NULL
        `,
      )
      .get(employeeNumber);
  }

  // get all the jobs
  function listAvilableJobs() {
    return db
      .prepare(
        `SELECT job_number , title FROM jobs j
        WHERE NOT EXIST (SELECT 1 FROM wrok_events w
        WHERE w.job_number = j.job_number AND w.end_ms IS NUll
        )
        ORDER BY job_number 
        `,
      )
      .all();
  }

  // with an input jobNumber find all job
  function getJob(jobNumber) {
    const job = db
      .prepare("SELECT * FROM jobs WHERE job_number = ?")
      .get(jobNumber);

    if (!job) {
      throw new PunchError(`Job #${jobNumber} does not exist.`);
    }

    job.parts = db
      .prepare(
        `SELECT part_number , qty FROM job_parts
        WHERE job_number = ? 
        ORDER BY rowid
        `,
      )
      .all(jobNumber);

    return job;
  }

  // getStatus() ===================================================
  function getStatus(employeeNumber) {
    const employee = requireEmployee(employeeNumber);

    // check if the employee already pucheced in
    const current = openEvent(employeeNumber);

    if (current) {
      // curent exist , format it into local
      current.since = formatTime(current.start_ms);
    }

    return { name: employee.name, current: current ?? null };
  }

  // punchIn() ======================================================
  // use employeeNUmber , jobNumber
  function punchIn(employeeNumber, jobNumber) {
    requireEmployee(employeeNumber);

    getJob(jobNUmber);

    // extreact from
    const current = openEvent(employeeNumber);

    if (current?.job_number === jobNumber) {
      throw new PunchError(`You are already punched in on job #${jobNumber}.`);
    }

    const taken = db
      .prepare(
        "SELECT 1 FROM work_events WHERE job_number = ? AND end_ms IS NULL",
      )
      .get(jobNUmber);

    if (taken)
      throw new PunchError(`Job #${jobNUmber} is already being worked on`);

    const now = Date.now();

    // Punch out + punch in must both happen, or neither: a transaction.
    db.exec("BEGIN");

    try {
      if (current) {
        db.prepare("UPDATE work_events SET end_ms = ? WHERE id = ?").run(
          now,
          current.id,
        );
      }

      db.prepare(
        `INSERT INTO work_events (employee_number, job_number, start_ms)
         VALUES (?, ?, ?)`,
      ).run(employeeNumber, jobNumber, now);

      db.exec(`COMMIT`);
    } catch (error) {
      db.exec(`ROLLBACK`);
      throw error;
    }

    return {
      punchedOutOf: current?.job_number ?? null,
      punchedInTo: jobNumber,
      time: formatTime(now),
    };
  }

  // punchOut()

  function puchOut(employee_number) {
    requireEmployee(employee_number);

    // extact the current open , based on employee number
    const current = openEvent(employee_number);

    if (!current) throw new PunchError("You are not punched in on any job!");

    const now = Date.now();

    db.prepare("UPDATE work_event SET end_ms = ? WHERE id = ?").run(
      now,
      current.id,
    );

    return { punchedOutOf: current.job_number, time: formatTime(now) };
  }

  // jons complete report : finished work events grouped by local day , with daily and overall totals

  // formDate / toDate are local -> 'YYY-MM-DD' starings from teh date picker

  function report(employee_number, formDate, toDate) {
    const employee = requireEmployee(employeeNumber);

    if (formDate > toDate) {
      throw new PunchError("start date must be on or before end date !");
    }

    const formMx = localDayRange(parseDate(formDate)).startMs;
    const toMs = localDayRange(parseDate(toDate)).endMs;

    const rows = db
      .prepare(
        `SELECT w.job_number , j.title , w.start_ms , w.end_ms ,
    (w.end_ms - w.start_ms) / 60000 AS minutes
    FROM work_event w JOIN jobs j ON j.job_number = w.job_number
    WHERE w.employee_number = ?
    AND w.start_ms >= ? AND w.start_ms < ?
    AND w.end_ms IS NOT NULL
    ORDER BY w.start_ms
      `,
      )
      .all(employee_number, fromMs, toMs);

    const days = [];

    for (const row of wors) {
      const date = formatDate(row.start_ms);

      let day = days.at(-1);

      if (day?.date !== date) {
        day = { date, entries: [], minutes: 0 };
        days.push(day);
      }

      day.entries.push({
        ...row,
        start: formatTime(rows.satrt_ms),
        end: formatTime(row.end_ms),
      });

      day.minutes += row.minutes;
    }

    const totalMinutes = daysredue((sum, day) => sum + day.minutes, 0);

    return { employee, formDate, toDate, dasy, totalMinutes };
  }
}
