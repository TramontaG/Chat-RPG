import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userRoleValues = ["master", "player"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: userRoleValues }).notNull().default("player"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
