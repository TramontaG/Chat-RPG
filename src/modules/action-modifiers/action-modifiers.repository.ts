import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { db as dbClient } from "../../database/client";
import {
  userActionModifiers,
  type NewUserActionModifierRow,
  type UserActionModifierRow,
} from "../../database/schema";

type Database = typeof dbClient;

export class ActionModifiersRepository {
  constructor(private readonly database: Database) {}

  async listActive(userId: number, action: string, now: string): Promise<UserActionModifierRow[]> {
    return this.database
      .select()
      .from(userActionModifiers)
      .where(
        and(
          eq(userActionModifiers.userId, userId),
          eq(userActionModifiers.action, action),
          gt(userActionModifiers.remainingUses, 0),
          or(isNull(userActionModifiers.expiresAt), gt(userActionModifiers.expiresAt, now)),
        ),
      )
      .all();
  }

  async create(modifier: NewUserActionModifierRow): Promise<UserActionModifierRow> {
    const rows = this.database.insert(userActionModifiers).values(modifier).returning().all();
    const createdModifier = rows[0];

    if (!createdModifier) {
      throw new Error("Failed to create action modifier.");
    }

    return createdModifier;
  }

  async decrementUses(id: number, updatedAt: string): Promise<void> {
    this.database
      .update(userActionModifiers)
      .set({
        remainingUses: sql`${userActionModifiers.remainingUses} - 1`,
        updatedAt,
      })
      .where(eq(userActionModifiers.id, id))
      .run();
  }
}
