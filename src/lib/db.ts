import { PrismaClient } from "../generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('file:', '') 
  : path.join(process.cwd(), "dev.db");

const adapter = new PrismaBetterSqlite3({
  url: dbPath,
});

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
