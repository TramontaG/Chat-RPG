import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/chat-rpg.sqlite"),
  JWT_SECRET: z.string().min(16),
  MASTER_PASSWORD: z.string().min(1),
});

export const env = envSchema.parse(process.env);
