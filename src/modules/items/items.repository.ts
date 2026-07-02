import { eq } from "drizzle-orm";
import type { db as dbClient } from "../../database/client";
import { items, type ItemRow, type NewItemRow } from "../../database/schema";

type Database = typeof dbClient;

export class ItemsRepository {
  constructor(private readonly database: Database) {}

  async findAll(): Promise<ItemRow[]> {
    return this.database.select().from(items).all();
  }

  async findById(id: string): Promise<ItemRow | undefined> {
    const rows = this.database.select().from(items).where(eq(items.id, id)).limit(1).all();

    return rows[0];
  }

  async create(item: NewItemRow): Promise<void> {
    this.database.insert(items).values(item).run();
  }

  async update(id: string, item: Partial<NewItemRow>): Promise<ItemRow | undefined> {
    const rows = this.database
      .update(items)
      .set(item)
      .where(eq(items.id, id))
      .returning()
      .all();

    return rows[0];
  }

  async upsert(item: NewItemRow): Promise<void> {
    this.database
      .insert(items)
      .values(item)
      .onConflictDoUpdate({
        target: items.id,
        set: {
          name: item.name,
          description: item.description,
          category: item.category,
          type: item.type,
          rarity: item.rarity,
          stackable: item.stackable,
          maxStack: item.maxStack,
          baseValue: item.baseValue,
          metadata: item.metadata,
          status: item.status,
          updatedAt: item.updatedAt,
        },
      })
      .run();
  }
}
