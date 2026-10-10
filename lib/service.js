// service.js is the rules layer.
// It sits between the database (db.js) and the Electron side (main.js).
// It knows the story's rules and SQL.
// It knows nothing about windows,
//  IPC, timers or how things look on screen.

// What it has to handle (from your mock and §2 of your design)
// Questions it answers (reads only):

// import helpers

const {
  YearMonthDateHourMin,
  dateToMsRange,
  afterPunchInTime,
  afterPunchOutTime,
  todayStartMs,
  thatDayFixTime,
  dayList,
} = require("./time");

class RuleError extends Error {}

class NeedSupervisorError extends RuleError {}

// all inside createService , for later inject into the main.js

function createService(db) {
  // in work_event table , find rows with end_ms is NULL
  // exclude their job_number from the totoal job tables
  function listAvailableJobs() {
    const onGoing = db
      .prepare(
        `SELECT job_number  FROM work_events
        WHERE end_ms IS NULL;
        `,
      )
      .all();

    const jobNumbsOnGoing = onGoing.map((cur) => cur.job_number);

    const joblist = db
      .prepare(
        `SELECT job_number , title , quantity , description  ,instructions_url
        FROM jobs 
        
        `,
      )
      .all();

    // filter out the jobNumbsOnGoing
    // check if the current in the joblist is a part of to be excluded on going
    return joblist.filter((cur) => !jobNumbsOnGoing.includes(cur.job_number)); // keep the non on going
  }

  // with a jobnumber find inside the job_parts table
  // can have many rows
  function findParts(job_number) {
    const partsList = db
      .prepare(
        `SELECT part_number , qty FROM job_parts
        WHERE job_number = ? 
        `,
      )
      .all(job_number);

    return partsList;
  }

  function getCurrentJob(employee_number) {
    if (!checkEmployee(employee_number)) {
      throw new RuleError("no such employee");
    }

    // check if there is left over from previous day before today 00:00
    // (so the status box never shows yesterday's job, and punchIn never closes it with today's time)
    closeOpenRowsBefore(todayStartMs());

    // find if there is still on going jobs for that employee_number
    const taken = db
      .prepare(
        "SELECT employee_number , job_number FROM work_events WHERE employee_number = ? AND end_ms IS NULL",
      )
      .get(employee_number);

    if (!taken) {
      // no on going
      return null;
    }

    return taken.job_number; // has on going , return the on going job number
  }

  function punchIn(employee_number, job_number) {
    // as punch in is protetcted by front end , both input param are valid

    const curTime = Date.now();

    // check time first
    if (afterPunchInTime()) {
      throw new RuleError("After 5:30 ! no punch in allowed !");
    }

    // check if already has on going
    const currentJobNumber = getCurrentJob(employee_number);

    db.exec("BEGIN");

    let newRow;

    try {
      if (currentJobNumber) {
        // punch out current on going automitically
        db.prepare(
          `UPDATE work_events SET end_ms = ? 
            WHERE job_number = ? AND end_ms IS NULL 
            `,
        ).run(curTime, currentJobNumber);
      }

      // insert new job

      newRow = db
        .prepare(
          `INSERT INTO  work_events (employee_number, job_number, start_ms)
        VALUES(? , ? ,? )
        `,
        )
        .run(employee_number, job_number, curTime);

      // do trasaction
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");

      throw new NeedSupervisorError("Cannot punch in , ask your supervisor", {
        cause: err,
      });
    }

    return newRow; // indicate ok
  }

  function punchOut(employee_number) {
    if (afterPunchOutTime()) {
      throw new RuleError("too late ! will auto puch out in 5 mins ");
    }

    // check if there is left over from previous day before today 00:00
    closeOpenRowsBefore(todayStartMs());

    // fix or thorw error done
    // now can check puch out ongoing  for today
    const tobePunched = db
      .prepare(
        `SELECT id , job_number FROM work_events
         WHERE end_ms IS NULL AND employee_number = ?
        `,
      )
      .get(employee_number);

    if (!tobePunched) {
      throw new RuleError("nothing to be punched out ");
    }

    // puch out the tobePunched.id
    const result = db
      .prepare(
        `UPDATE work_events SET end_ms = ?
         WHERE id = ? 
        `,
      )
      .run(Date.now(), tobePunched.id);

    // return success punced out job_number

    return tobePunched.job_number;
  }

  function getReport(employee_number, from, to) {
    let result = [];

    // need to fill this with form , to all date in YYYY-MM-DD
    const daylist = dayList(from, to);

    // extact single day startMs , endMs

    try {
      for (const cur of daylist) {
        //each cur is "YYYY-MM-DD"
        // we take out the startMs , endMs of that day in 00:00 to next day 00:00 in ms
        const { startMs, endMs } = dateToMsRange(cur);

        // use that startMS , endMs to check table work_event

        const rows = db
          .prepare(
            `SELECT job_number , start_ms , end_ms FROM work_events
             WHERE end_ms IS NOT NULL 
             AND employee_number = ? 
             AND  start_ms >= ? AND start_ms < ?
            `,
          )
          .all(employee_number, startMs, endMs);

        // for rows , places inside inner
        let inner = [];

        for (const row of rows) {
          const { job_number, start_ms, end_ms } = row;
          const { title } = db
            .prepare(`SELECT title FROM jobs WHERE job_number = ? `)
            .get(job_number);

          inner.push({ job_number, title, start_ms, end_ms });
        }
        result.push({ date: cur, rows: inner });
      }
    } catch (err) {
      throw new NeedSupervisorError("Cannot get report , ask your supervisor", {
        cause: err,
      });
    }

    return result;
  }

  function closeOpenRowsBefore(todayStart) {
    // check in table work_event  , find the still on going ones

    const badOnGoing = db
      .prepare(
        `SELECT id, job_number, start_ms FROM work_events
        WHERE start_ms < ? AND end_ms IS NULL
        `,
      )
      .all(todayStart);

    const fixRow = db.prepare(
      `UPDATE work_events SET end_ms = ?
       WHERE id = ?
      `,
    );

    db.exec("BEGIN");

    try {
      for (const cur of badOnGoing) {
        fixRow.run(thatDayFixTime(cur.start_ms), cur.id); // FIX: pass numbers, not the row
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK"); // FIX: undo partial updates

      throw new NeedSupervisorError(
        "Cannot fix old on going , ask your supervisor",
        { cause: err },
      );
    }

    // success , return the fixed job_number
    return badOnGoing.map((cur) => cur.job_number);
  }

  // return boolean check if valid number
  function checkEmployee(employee_number) {
    const row = db
      .prepare(
        `SELECT employee_number FROM employees
        WHERE employee_number = ? 
        `,
      )
      .get(employee_number);

    return row != null;
  }

  // public functions for main.js (checkEmployee stays private)
  return {
    listAvailableJobs,
    findParts,
    getCurrentJob,
    punchIn,
    punchOut,
    getReport,
    closeOpenRowsBefore,
  };
}

module.exports = { createService, RuleError, NeedSupervisorError };
