// Opens the SQLite file and makes sure the tables exist.
// It knows nothing about Electron: whoever calls it chooses the file path

// import :
const fs = require("node:fs"); // take teh whole module object
const path = require("node:path");

const { DatabaseSync } = require("node:sqlite"); // take One property out of it

// functions

// path.join() handles the '/' of path
function readSql(name) {
  // __dirname: the folder this file lives in
  // which is D:\..\punch-clock\lib
  // .. goes up one dir layer , so it becomes
  // D: \ ... \punch-clock\db\the_name
  // here the name is schema.sql

  // fs.readFileSync(path, "utf8"): reads the file and returns its contents as a string

  // without "utf8" , it give a buffer (row bytes) instead of text

  // Sync  neans it blocks till the file has been read . that is fine here , cause it runs once at start up
  return fs.readFileSync(path.join(__dirname, "..", "db", name), "utf8");
}

// question :  why not just "./db/schema.sql"
// as we want the path to work on any pc . we start the build of abs path from cur dir
// so it is not hard-coded , the "__dirname" is filled at runtiem with whwere the file actually is
// the anchor , __dirname gets filled in on each  machine

// readSql() isn't exported, so it's private to db.js.

/* NOTICE !
SQLite is not a server. 
It's a library running inside your own process, 
and the whole database is one ordinary file.

Because it's a local file, the calls are synchronous: no await.
*/
function openDb(filePath) {
  // DatabaseSync is a class , so new create an instance
  const db = new DatabaseSync(filePath);

  // db.exec("PRAGMA foreign_keys = ON");
  // SQLite default foreign key off -> setting is per connection !

  // without this line the REFERENCE employees(..) would be discarded
  // -> so we run this line every time db connection is open

  // exec runs a whole script
  // including several statements separated by ;
  // . (prepare only accepts a single statement.)

  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readSql("schema.sql")); // use readSql helper we previous defined to read the schema
  // we have defined isnide the schema , once run it will check if table  exist
  // if not we create them. if alredy exist do nothing

  // get them num of rows

  // as ".prepare runs only a line of SQL command "
  // here it use COUNT(*) count the number of all (as *) rows

  // use .get to extarct  one row as an object, with the column names as keys
  // name that as "count"

  // notice:
  //   console.log(row);     // { count: 5 }
  // console.log(count);   // 5
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM jobs").get();

  // when empty table , means non in db . we can run seed -> to populate the samples

  if (count === 0) {
    db.exec(readSql("seed.sql"));
  }

  return db;
}

module.exports = { openDb };
