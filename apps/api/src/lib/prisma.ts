import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

const connectionString = env.DIRECT_URL || env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Neither DIRECT_URL nor DATABASE_URL is configured.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
