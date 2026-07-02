import { db } from "../../database/client";
import type { ItemCategory, ItemRarity, ItemRow, ItemStatus, NewItemRow } from "../../database/schema";
import { ItemsRepository } from "./items.repository";

const itemsRepository = new ItemsRepository(db);

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

export class ItemUnavailableError extends Error {
  constructor(itemId: string) {
    super(`Item is not active: ${itemId}`);
    this.name = "ItemUnavailableError";
  }
}

export class ItemAlreadyExistsError extends Error {
  constructor(itemId: string) {
    super(`Item already exists: ${itemId}`);
    this.name = "ItemAlreadyExistsError";
  }
}

export type CreateItemInput = {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  type: string;
  rarity: ItemRarity;
  stackable?: boolean;
  maxStack?: number | null;
  baseValue?: number;
  metadata?: unknown;
  status?: ItemStatus;
};

export type UpdateItemInput = Partial<Omit<CreateItemInput, "id">>;

function stringifyMetadata(metadata: unknown): string {
  return JSON.stringify(metadata ?? {});
}

export async function getItemOrThrow(itemId: string): Promise<ItemRow> {
  const item = await itemsRepository.findById(itemId);

  if (!item) {
    throw new ItemNotFoundError(itemId);
  }

  return item;
}

export async function listItems(): Promise<ItemRow[]> {
  return itemsRepository.findAll();
}

export async function createItem(input: CreateItemInput): Promise<ItemRow> {
  const existingItem = await itemsRepository.findById(input.id);

  if (existingItem) {
    throw new ItemAlreadyExistsError(input.id);
  }

  const now = new Date().toISOString();
  const item: NewItemRow = {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    type: input.type,
    rarity: input.rarity,
    stackable: input.stackable ?? true,
    maxStack: input.maxStack ?? null,
    baseValue: input.baseValue ?? 0,
    metadata: stringifyMetadata(input.metadata),
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  };

  await itemsRepository.create(item);
  return getItemOrThrow(input.id);
}

export async function updateItem(itemId: string, input: UpdateItemInput): Promise<ItemRow> {
  await getItemOrThrow(itemId);

  const updatedItem = await itemsRepository.update(itemId, {
    ...input,
    metadata: input.metadata === undefined ? undefined : stringifyMetadata(input.metadata),
    updatedAt: new Date().toISOString(),
  });

  if (!updatedItem) {
    throw new ItemNotFoundError(itemId);
  }

  return updatedItem;
}

export async function disableItem(itemId: string): Promise<ItemRow> {
  return updateItem(itemId, {
    status: "disabled",
  });
}

export async function getActiveItemOrThrow(itemId: string): Promise<ItemRow> {
  const item = await getItemOrThrow(itemId);

  if (item.status !== "active") {
    throw new ItemUnavailableError(itemId);
  }

  return item;
}

export async function upsertItemDefinition(item: NewItemRow): Promise<void> {
  await itemsRepository.upsert(item);
}
