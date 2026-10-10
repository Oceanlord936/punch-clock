// Times are stored in the DB as UTC epoch milliseconds (Date.now()).
// This file converts them to LOCAL time for display and for "which day" queries.

/*
Store times as UTC epoch milliseconds (Date.now() gives something like 1760000000000). 
That's a single number, so it's unambiguous, sorts correctly, 
and end - start is the duration.

Show times in local time ("09:12"), because that's what the employee understands.

A Date object holds the ms internally. 

Its getHours(), getDate() and similar methods convert to local time using the PC's time-zone setting. 

Every function in this file relies on that.
*/

// pad is "padding" , filling the extra char so a value reach a fixed width
/*
we wants:

String(5).padStart(2, "0")    // "05"   fill at the START with "0" until the length is 2
String(12).padStart(2, "0")   // "12"   already 2 long, nothing added
String(7).padStart(3, "0")    // "007"
String(5).padEnd(3, "*")      // "5**"  padEnd fills at the end instead

*/
function pad(n) {
  return String(n).padStart(2, "0"); // padStart make the string as least 2 chars long, if not fill satrt with '0'
}

// ms to  { date: "YYYY-MM-DD", time: "HH:MM" } in local time

// good news: no need for me to do the complex math convert , js already have build in helper
// can just wrap that ms number in new Date()
// and we have .getFullYear() , .getMonth() , .getDate() , .getHours() ...

function YearMonthDateHourMin(inputMs) {
  const ob = new Date(inputMs);

  const year = ob.getFullYear();
  const month = ob.getMonth();
  const date = ob.getDate();

  const hour = ob.getHours();
  const min = ob.getMinutes();

  // return as an js object like  { date: "YYYY-MM-DD", time: "HH:MM" }
  let result = {
    date: `${year}-${pad(month + 1)}-${pad(date)}`,
    time: `${pad(hour)}:${pad(min)}`,
  };

  return result;
}

// "2026-09-14", "2026-09-16" → ["2026-09-14", "2026-09-15", "2026-09-16"]
function dayList(from, to) {
  const [year, month, day] = from.split("-").map((cur) => Number(cur));
  const date = new Date(year, month - 1, day); // a Date at the from day

  const days = [];
  let cur = from; // current day as "YYYY-MM-DD"

  while (cur <= to) {
    days.push(cur);
    date.setDate(date.getDate() + 1); // move the Date one day forward
    cur = YearMonthDateHourMin(date.getTime()).date; // turn it back into "YYYY-MM-DD"
  }

  return days;
}

// Input: one "YYYY-MM-DD" string, for example "2026-10-07"
// Output: { startMs, endMs } for that local day, so that SQL can use start_ms >= startMs AND start_ms < endMs

function dateToMsRange(input) {
  // as we want a range , we also need to get the next day
  // but consider day-light saving time cannot just add ms

  // create a Date object and use setDate(date.getDate() + 1)

  // pull out year , month day -> cast each splited string into number
  const [year, month, day] = input.split("-").map((cur) => Number(cur));
  const date = new Date(year, month - 1, day); // new date object

  const startMs = date.getTime();

  // move 1 day

  date.setDate(date.getDate() + 1);

  // get end ms
  const endMs = date.getTime();

  // retrun as object

  return { startMs, endMs };
}

function afterPunchInTime() {
  const { time } = YearMonthDateHourMin(Date.now());

  // check the HH:MM
  return time >= "17:30";
}

function afterPunchOutTime() {
  const { time } = YearMonthDateHourMin(Date.now());

  // check the HH:MM
  return time >= "23:55";
}

function todayStartMs() {
  const { date } = YearMonthDateHourMin(Date.now());

  // give it YYYY-MM-DD
  // extractout the startMs , which is the 00:00 in ms of today
  const { startMs } = dateToMsRange(date);

  return startMs;
}

function thatDayFixTime(startMs) {
  const { date } = YearMonthDateHourMin(startMs);
  // YYYY-MM-DD
  const [year, month, day] = date.split("-").map((cur) => Number(cur));

  // at 5:30 pm
  const dateObj = new Date(year, month - 1, day, 17, 30);

  return dateObj.getTime();
}

module.exports = {
  YearMonthDateHourMin,
  dateToMsRange,
  afterPunchInTime,
  afterPunchOutTime,
  todayStartMs,
  thatDayFixTime,
  dayList,
};
