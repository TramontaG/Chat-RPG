import { and, eq, isNull, sql } from "drizzle-orm";
import type { db as dbClient } from "../../database/client";
import {
  userInventoryItems,
  userInventorySlotBonuses,
  type NewUserInventorySlotBonusRow,
  type NewUserInventoryItemRow,
  type UserInventoryItemRow,
} from "../../database/schema";

type Database = typeof dbClient;

export class InventoryRepository {
  constructor(private readonly database: Database) {}

  async countOccupiedSlots(userId: number): Promise<number> {
    const rows = this.database
      .select({ count: sql<number>`count(*)` })
      .from(userInventoryItems)
      .where(eq(userInventoryItems.userId, userId))
      .all();

    return Number(rows[0]?.count ?? 0);
  }

  async sumBonusSlots(userId: number): Promise<number> {
    const rows = this.database
      .select({ slots: sql<number>`coalesce(sum(${userInventorySlotBonuses.slots}), 0)` })
      .from(userInventorySlotBonuses)
      .where(eq(userInventorySlotBonuses.userId, userId))
      .all();

    return Number(rows[0]?.slots ?? 0);
  }

  async findStack(userId: number, itemId: string): Promise<UserInventoryItemRow | undefined> {
    const rows = this.database
      .select()
      .from(userInventoryItems)
      .where(
        and(
          eq(userInventoryItems.userId, userId),
          eq(userInventoryItems.itemId, itemId),
          isNull(userInventoryItems.metadata),
        ),
      )
      .limit(1)
      .all();

    return rows[0];
  }

  async increaseQuantity(id: number, quantity: number, updatedAt: string): Promise<void> {
    this.database
      .update(userInventoryItems)
      .set({
        quantity: sql`${userInventoryItems.quantity} + ${quantity}`,
        updatedAt,
      })
      .where(eq(userInventoryItems.id, id))
      .run();
  }

  async decreaseQuantity(id: number, quantity: number, updatedAt: string): Promise<void> {
    this.database
      .update(userInventoryItems)
      .set({
        quantity: sql`${userInventoryItems.quantity} - ${quantity}`,
        updatedAt,
      })
      .where(eq(userInventoryItems.id, id))
      .run();
  }

  async deleteById(id: number): Promise<void> {
    this.database.delete(userInventoryItems).where(eq(userInventoryItems.id, id)).run();
  }

  async findItems(userId: number, itemId: string): Promise<UserInventoryItemRow[]> {
    return this.database
      .select()
      .from(userInventoryItems)
      .where(and(eq(userInventoryItems.userId, userId), eq(userInventoryItems.itemId, itemId)))
      .all();
  }

  async create(item: NewUserInventoryItemRow): Promise<void> {
    this.database.insert(userInventoryItems).values(item).run();
  }

  async createMany(items: NewUserInventoryItemRow[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    this.database.insert(userInventoryItems).values(items).run();
  }

  async listByUserId(userId: number): Promise<UserInventoryItemRow[]> {
    return this.database
      .select()
      .from(userInventoryItems)
      .where(eq(userInventoryItems.userId, userId))
      .all();
  }

  async setSlotBonus(bonus: NewUserInventorySlotBonusRow): Promise<void> {
    this.database
      .insert(userInventorySlotBonuses)
      .values(bonus)
      .onConflictDoUpdate({
        target: [userInventorySlotBonuses.userId, userInventorySlotBonuses.source],
        set: {
          slots: bonus.slots,
          updatedAt: bonus.updatedAt,
        },
      })
      .run();
  }
}
