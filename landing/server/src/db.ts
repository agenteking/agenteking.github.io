import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.js";

const url = process.env.DATABASE_URL ?? "file:./data/agencia.db";

export const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
