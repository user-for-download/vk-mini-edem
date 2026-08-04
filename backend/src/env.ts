import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: parseInt(process.env.BACKEND_PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_THYe8So3cVny@ep-gentle-grass-asvzyn2j-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  JWT_SECRET: process.env.JWT_SECRET || "edem-secret-key-2025",
  VK_APP_SECRET: process.env.VK_APP_SECRET || "mock-vk-secret",
};
