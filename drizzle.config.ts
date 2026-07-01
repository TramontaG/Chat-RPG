import type { Config } from "drizzle-kit";

export default {
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/chat-rpg.sqlite",
  },
} satisfies Config;
