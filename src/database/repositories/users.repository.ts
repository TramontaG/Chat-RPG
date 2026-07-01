import { eq } from "drizzle-orm";
import type { db as dbClient } from "../client";
import { users, type NewUserRow, type UserRow } from "../schema";

type Database = typeof dbClient;

export class UsersRepository {
  constructor(private readonly database: Database) {}

  async findByUsername(username: string): Promise<UserRow | undefined> {
    const rows = this.database
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
      .all();

    return rows[0];
  }

  async findById(id: number): Promise<UserRow | undefined> {
    const rows = this.database.select().from(users).where(eq(users.id, id)).limit(1).all();

    return rows[0];
  }

  async create(user: NewUserRow): Promise<void> {
    this.database.insert(users).values(user).run();
  }
}
