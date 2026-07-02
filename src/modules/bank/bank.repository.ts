import { and, eq, isNull, sql } from "drizzle-orm";
import type { db as dbClient } from "../../database/client";
import {
  userBankItems,
  userBanks,
  type NewUserBankItemRow,
  type NewUserBankRow,
  type UserBankItemRow,
  type UserBankRow,
} from "../../database/schema";

type Database = typeof dbClient;

export class BankRepository {
  constructor(private readonly database: Database) {}

  async findBank(userId: number): Promise<UserBankRow | undefined> {
    const rows = this.database.select().from(userBanks).where(eq(userBanks.userId, userId)).limit(1).all();

    return rows[0];
  }

  async createBank(bank: NewUserBankRow): Promise<void> {
    this.database.insert(userBanks).values(bank).run();
  }

  async addGold(userId: number, amount: number, updatedAt: string): Promise<void> {
    this.database
      .update(userBanks)
      .set({
        gold: sql`${userBanks.gold} + ${amount}`,
        updatedAt,
      })
      .where(eq(userBanks.userId, userId))
      .run();
  }

  async spendGold(userId: number, amount: number, updatedAt: string): Promise<void> {
    this.database
      .update(userBanks)
      .set({
        gold: sql`${userBanks.gold} - ${amount}`,
        updatedAt,
      })
      .where(eq(userBanks.userId, userId))
      .run();
  }

  async findStack(userId: number, itemId: string): Promise<UserBankItemRow | undefined> {
    const rows = this.database
      .select()
      .from(userBankItems)
      .where(
        and(
          eq(userBankItems.userId, userId),
          eq(userBankItems.itemId, itemId),
          isNull(userBankItems.metadata),
        ),
      )
      .limit(1)
      .all();

    return rows[0];
  }

  async findItemById(userId: number, id: number): Promise<UserBankItemRow | undefined> {
    const rows = this.database
      .select()
      .from(userBankItems)
      .where(and(eq(userBankItems.userId, userId), eq(userBankItems.id, id)))
      .limit(1)
      .all();

    return rows[0];
  }

  async increaseItemQuantity(id: number, quantity: number, updatedAt: string): Promise<void> {
    this.database
      .update(userBankItems)
      .set({
        quantity: sql`${userBankItems.quantity} + ${quantity}`,
        updatedAt,
      })
      .where(eq(userBankItems.id, id))
      .run();
  }

  async decreaseItemQuantity(id: number, quantity: number, updatedAt: string): Promise<void> {
    this.database
      .update(userBankItems)
      .set({
        quantity: sql`${userBankItems.quantity} - ${quantity}`,
        updatedAt,
      })
      .where(eq(userBankItems.id, id))
      .run();
  }

  async deleteItemById(id: number): Promise<void> {
    this.database.delete(userBankItems).where(eq(userBankItems.id, id)).run();
  }

  async findItems(userId: number, itemId: string): Promise<UserBankItemRow[]> {
    return this.database
      .select()
      .from(userBankItems)
      .where(and(eq(userBankItems.userId, userId), eq(userBankItems.itemId, itemId)))
      .all();
  }

  async createItem(item: NewUserBankItemRow): Promise<void> {
    this.database.insert(userBankItems).values(item).run();
  }

  async createItems(items: NewUserBankItemRow[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    this.database.insert(userBankItems).values(items).run();
  }

  async listItems(userId: number): Promise<UserBankItemRow[]> {
    return this.database.select().from(userBankItems).where(eq(userBankItems.userId, userId)).all();
  }
}
