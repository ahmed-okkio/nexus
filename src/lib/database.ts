import Database from "better-sqlite3";
import path from "path";

// Parse the database URL
let dbPath = process.env.DATABASE_URL || "file:./dev.db";
if (dbPath.startsWith("file:")) {
  dbPath = dbPath.substring(5);
}
if (!path.isAbsolute(dbPath)) {
  dbPath = path.join(process.cwd(), dbPath);
}

export const sqlite = new Database(dbPath);
